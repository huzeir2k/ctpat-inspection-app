/**
 * Supabase Auth Service
 * Real user accounts (email/password) backing both backends' JWT verification.
 * Session is persisted via a custom storage adapter: AES key in expo-secure-store,
 * encrypted session blob in AsyncStorage (SecureStore alone is capped at 2KB, too
 * small for a JWT session payload).
 */
import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';
import { OAuthRedirectError, parseAuthRedirect } from '../models/authRedirect';

// Lets the sign-in browser window hand its result back to the app (needed on web; harmless on phones).
WebBrowser.maybeCompleteAuthSession();

// expo-secure-store falls back to unencrypted storage on web anyway, so just use AsyncStorage there.
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — auth will not work until configured in .env.local'
  );
}

// `typeof window === 'undefined'` guards Expo Router's SSR/static-export render pass;
// Platform.OS is not reliable there (it doesn't report 'web' during that pass).
const authStorage =
  typeof window === 'undefined' ? undefined : Platform.OS === 'web' ? AsyncStorage : new LargeSecureStore();

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's token auto-refresh timer only ticks while the app is foregrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

type SessionListener = (session: Session | null) => void;

export interface SignUpDetails {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  truckNumber: string;
}

class SupabaseAuthService {
  private listeners = new Set<SessionListener>();
  private isListening = false;
  // While an emailed code is being used, Supabase briefly signs the user in. The app must not
  // treat that as a finished sign-in: after a reset it waits for the new password to be saved,
  // and after confirming a new account the user signs in themselves.
  private isHoldingSessionEvents = false;

  async signInWithPassword(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw error || new Error('Sign-in did not return a session');
    }
    return data.session;
  }

  /**
   * Creates the account and makes Supabase email a verification code. The account cannot
   * sign in until the code is entered (the project's "Confirm email" setting must be on).
   * Supabase gives the same answer for an address that already has an account, so callers
   * must not tell the user whether the address was new.
   */
  async signUp({ email, password, firstName, lastName, truckNumber }: SignUpDetails): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, truck_number: truckNumber } },
    });
    if (error) throw error;
  }

  /**
   * Confirms the email with the emailed code. The user is not left signed in: they go to the
   * sign-in screen and use the email and password they chose.
   */
  async verifySignupCode(email: string, code: string): Promise<void> {
    this.isHoldingSessionEvents = true;
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error) throw error;
      // The code itself signs the user in; end that session on this device.
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      this.isHoldingSessionEvents = false;
      this.notify(await this.getSession());
    }
  }

  /**
   * Opens Google's sign-in page in the system browser and, when the user comes back, signs
   * them in with the session Supabase returns. First-time Google users get an account here;
   * Google has already verified their email address.
   * Closing the browser without finishing is not an error.
   */
  async signInWithGoogle(): Promise<void> {
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data.url) throw error ?? new OAuthRedirectError('No sign-in address was returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;

    const { accessToken, refreshToken, error: problem } = parseAuthRedirect(result.url);
    if (!accessToken || !refreshToken) {
      throw new OAuthRedirectError(problem ?? 'The sign-in did not return a session');
    }
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) throw sessionError;
  }

  async resendSignupCode(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }

  /** Emails a reset code if the address has an account. Supabase gives the same answer either way. */
  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  /**
   * Checks the emailed code and saves the new password. On success the user ends up signed in.
   * If the password cannot be saved, the temporary sign-in is dropped, so nobody is left
   * signed in without having chosen a password.
   */
  async resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
    this.isHoldingSessionEvents = true;
    try {
      const { error: codeError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (codeError) throw codeError;

      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        await supabase.auth.signOut({ scope: 'local' });
        throw passwordError;
      }
    } finally {
      this.isHoldingSessionEvents = false;
      this.notify(await this.getSession());
    }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error retrieving Supabase session:', error);
      return null;
    }
    return data.session;
  }

  /**
   * Subscribe to sign-in/sign-out/token-refresh events. Returns an unsubscribe function.
   */
  onAuthStateChange(callback: SessionListener): () => void {
    this.listeners.add(callback);
    this.listenToSupabase();
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Subscribed on first use rather than at import, so the static-export render pass never starts it.
  private listenToSupabase() {
    if (this.isListening) return;
    this.isListening = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!this.isHoldingSessionEvents) this.notify(session);
    });
  }

  private notify(session: Session | null) {
    this.listeners.forEach((listener) => listener(session));
  }
}

export default new SupabaseAuthService();
