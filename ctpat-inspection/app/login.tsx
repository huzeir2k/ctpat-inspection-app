import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthButton from './components/AuthButton';
import AuthDivider from './components/AuthDivider';
import AuthField from './components/AuthField';
import AuthScreen from './components/AuthScreen';
import GoogleButton from './components/GoogleButton';
import { GOOGLE_SIGN_IN_ENABLED } from './models/features';
import useAuthSubmit from './components/useAuthSubmit';
import { normalizeEmail } from './models/accountFields';
import SupabaseAuthService from './services/SupabaseAuthService';

/**
 * The first screen a signed-out user sees. Signing in updates the session, and the root
 * layout (_layout.tsx) then moves the user to the home screen by itself.
 */
export default function LoginScreen() {
  const router = useRouter();
  // Set when the user has just confirmed a new account: their email is filled in for them.
  const { email: confirmedEmail, confirmed } = useLocalSearchParams<{ email?: string; confirmed?: string }>();
  const [email, setEmail] = useState(confirmedEmail ?? '');
  const [password, setPassword] = useState('');
  const { notice, isSubmitting, submit, showError, showInfo, clearNotice } = useAuthSubmit();
  const passwordInput = useRef<TextInput>(null);

  useEffect(() => {
    if (confirmed) showInfo('Email confirmed. Sign in with your email and password.');
  }, [confirmed, showInfo]);

  const handleSignIn = () => {
    if (!email.trim() || !password) {
      showError('Enter your email and password.');
      return;
    }
    submit(async () => {
      await SupabaseAuthService.signInWithPassword(normalizeEmail(email), password);
    });
  };

  // Editing a field means the user is acting on the error, so stop showing it.
  const onChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (notice) clearNotice();
  };

  return (
    <AuthScreen title="CTPAT Inspection" subtitle="Sign in to continue" notice={notice}>
      <AuthField
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChangeText={onChange(setEmail)}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordInput.current?.focus()}
        blurOnSubmit={false}
        editable={!isSubmitting}
      />
      <AuthField
        ref={passwordInput}
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={onChange(setPassword)}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
        editable={!isSubmitting}
      />

      <AuthButton title="Sign In" onPress={handleSignIn} isLoading={isSubmitting} />

      {GOOGLE_SIGN_IN_ENABLED ? (
        <>
          <AuthDivider label="or" />
          <GoogleButton disabled={isSubmitting} onStart={clearNotice} onError={showError} />
        </>
      ) : null}

      <AuthButton title="Forgot password?" variant="link" onPress={() => router.push('/forgot-password')} />
      <AuthButton title="Create account" variant="link" onPress={() => router.push('/signup')} />
    </AuthScreen>
  );
}
