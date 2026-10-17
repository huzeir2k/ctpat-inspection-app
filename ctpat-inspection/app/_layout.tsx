import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import ApiService from './services/ApiService';
import SupabaseAuthService from './services/SupabaseAuthService';

const SETTINGS_STORAGE_KEY = 'ctpat_app_settings';

// Keep the native splash screen up until we know whether someone is signed in, so the
// home screen never flashes before the login screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Applies a user-configured backend URL (Settings screen), if one was saved. */
const loadBackendUrlOverride = async () => {
  try {
    const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const backendUrl = savedSettings ? JSON.parse(savedSettings).backendUrl : null;
    if (backendUrl) {
      ApiService.setBaseUrl(backendUrl);
    }
  } catch (error) {
    console.warn('Could not load backend URL override:', error);
  }
};

/** Keeps ApiService's bearer token in step with the signed-in session. */
const applySession = (session: Session | null) => {
  if (session) {
    ApiService.initialize(session.access_token);
  } else {
    ApiService.setToken('');
  }
};

export default function RootLayout() {
  // undefined = still checking, null = signed out, Session = signed in
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      await loadBackendUrlOverride();

      let initial: Session | null = null;
      try {
        initial = await SupabaseAuthService.getSession();
      } catch (error) {
        console.error('Error reading the saved session:', error);
      }

      if (cancelled) return;
      applySession(initial);
      setSession(initial);
      SplashScreen.hideAsync().catch(() => {});

      // Informational only: do not make the user wait for it (a sleeping server can take a while).
      if (initial) {
        ApiService.healthCheck().then((healthy) => {
          if (!healthy) console.warn('Backend may not be available');
        });
      }
    };

    start();

    // Sign-in, sign-out and token refresh all arrive here.
    const unsubscribe = SupabaseAuthService.onAuthStateChange((next) => {
      applySession(next);
      setSession(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Render nothing while the splash screen is still showing.
  if (session === undefined) {
    return null;
  }

  const isSignedIn = session !== null;

  // Stack.Protected removes the screens that do not apply: signed out, only "login" exists;
  // signed in, "login" is gone. When the session changes the router moves to the first
  // screen that is still available, so no screen navigates to another by hand.
  return (
    <Stack>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="inspection" />
        <Stack.Screen name="history" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
