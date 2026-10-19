import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthButton from './components/AuthButton';
import AuthField from './components/AuthField';
import AuthScreen from './components/AuthScreen';
import useAuthSubmit from './components/useAuthSubmit';
import useCooldown from './components/useCooldown';
import { VERIFICATION_CODE_LENGTH, validateVerificationCode } from './models/accountFields';
import SupabaseAuthService from './services/SupabaseAuthService';

const RESEND_WAIT_SECONDS = 60;

/**
 * Asks for the code Supabase emailed after sign-up. A correct code confirms the address and
 * sends the user to the sign-in screen, with their email filled in.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const { notice, isSubmitting, submit, showError, showInfo, clearNotice } = useAuthSubmit();
  const { secondsLeft, start: startCooldown } = useCooldown(RESEND_WAIT_SECONDS);

  // The first code was sent a moment ago by the sign-up screen.
  useEffect(() => {
    startCooldown();
  }, [startCooldown]);

  if (!email) {
    return (
      <AuthScreen title="Confirm your email" subtitle="Start from the sign-up screen to get a code.">
        <AuthButton title="Back to sign up" onPress={() => router.replace('/signup')} />
      </AuthScreen>
    );
  }

  const handleVerify = () => {
    const problem = validateVerificationCode(code);
    if (problem) {
      showError(problem);
      return;
    }
    submit(async () => {
      await SupabaseAuthService.verifySignupCode(email, code.trim());
      // Confirmed. The user signs in themselves with the password they chose.
      router.replace({ pathname: '/login', params: { email, confirmed: '1' } });
    });
  };

  const handleResend = () => {
    submit(async () => {
      await SupabaseAuthService.resendSignupCode(email);
      startCooldown();
      showInfo('If the address can be registered, a new code is on its way.');
    });
  };

  return (
    <AuthScreen
      title="Confirm your email"
      subtitle={`If ${email} can be registered, we sent a ${VERIFICATION_CODE_LENGTH}-digit code to it. Enter the code below.`}
      notice={notice}
    >
      <AuthField
        label="Code"
        placeholder={'0'.repeat(VERIFICATION_CODE_LENGTH)}
        value={code}
        onChangeText={(value) => {
          setCode(value.replace(/[^0-9]/g, ''));
          if (notice) clearNotice();
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={VERIFICATION_CODE_LENGTH}
        returnKeyType="go"
        onSubmitEditing={handleVerify}
        editable={!isSubmitting}
      />

      <AuthButton title="Confirm email" onPress={handleVerify} isLoading={isSubmitting} />
      <AuthButton
        title={secondsLeft > 0 ? `Resend code (${secondsLeft}s)` : 'Resend code'}
        variant="link"
        onPress={handleResend}
        disabled={secondsLeft > 0}
      />
      <AuthButton title="Use a different email" variant="link" onPress={() => router.replace('/signup')} />
      <AuthButton title="Already confirmed? Sign in" variant="link" onPress={() => router.replace('/login')} />
    </AuthScreen>
  );
}
