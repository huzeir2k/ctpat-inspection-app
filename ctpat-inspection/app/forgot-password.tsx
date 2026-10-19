import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import AuthButton from './components/AuthButton';
import AuthField from './components/AuthField';
import AuthScreen from './components/AuthScreen';
import useAuthSubmit from './components/useAuthSubmit';
import { normalizeEmail, validateEmail } from './models/accountFields';
import SupabaseAuthService from './services/SupabaseAuthService';

/**
 * Step 1 of a password reset: ask for the email. Supabase sends a code only if the address
 * has an account, and answers the same way either way, so this screen never says which.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const { notice, isSubmitting, submit, showError, clearNotice } = useAuthSubmit();

  const handleSend = () => {
    const problem = validateEmail(email);
    if (problem) {
      showError(problem);
      return;
    }
    const address = normalizeEmail(email);
    submit(async () => {
      await SupabaseAuthService.requestPasswordReset(address);
      router.push({ pathname: '/reset-password', params: { email: address } });
    });
  };

  return (
    <AuthScreen
      title="Reset password"
      subtitle="Enter your email. If it has an account, we will send a code to reset the password."
      notice={notice}
    >
      <AuthField
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (notice) clearNotice();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="go"
        onSubmitEditing={handleSend}
        editable={!isSubmitting}
      />

      <AuthButton title="Send reset code" onPress={handleSend} isLoading={isSubmitting} />
      <AuthButton title="Back to sign in" variant="link" onPress={() => router.replace('/login')} />
    </AuthScreen>
  );
}
