import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthButton from './components/AuthButton';
import AuthField from './components/AuthField';
import AuthScreen from './components/AuthScreen';
import PasswordRules from './components/PasswordRules';
import useAuthSubmit from './components/useAuthSubmit';
import useCooldown from './components/useCooldown';
import { VERIFICATION_CODE_LENGTH, validateVerificationCode } from './models/accountFields';
import { PASSWORD_MAX_LENGTH, checkPassword } from './models/passwordRules';
import SupabaseAuthService from './services/SupabaseAuthService';

const RESEND_WAIT_SECONDS = 60;

/**
 * Step 2 of a password reset: the emailed code plus the new password. On success the user
 * is signed in with the new password and the root layout moves them to the home screen.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { notice, isSubmitting, submit, showError, showInfo, clearNotice } = useAuthSubmit();
  const { secondsLeft, start: startCooldown } = useCooldown(RESEND_WAIT_SECONDS);
  const passwordInput = useRef<TextInput>(null);

  // The first code was sent a moment ago by the previous screen.
  useEffect(() => {
    startCooldown();
  }, [startCooldown]);

  if (!email) {
    return (
      <AuthScreen title="Reset password" subtitle="Start from the forgot password screen to get a code.">
        <AuthButton title="Back" onPress={() => router.replace('/forgot-password')} />
      </AuthScreen>
    );
  }

  const handleReset = () => {
    const problem = validateVerificationCode(code) ?? checkPassword(password).message;
    if (problem) {
      showError(problem);
      return;
    }
    submit(() => SupabaseAuthService.resetPasswordWithCode(email, code.trim(), password));
  };

  const handleResend = () => {
    submit(async () => {
      await SupabaseAuthService.requestPasswordReset(email);
      startCooldown();
      showInfo('If the address has an account, a new code is on its way.');
    });
  };

  return (
    <AuthScreen
      title="Choose a new password"
      subtitle={`If ${email} has an account, we sent a ${VERIFICATION_CODE_LENGTH}-digit code to it.`}
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
        returnKeyType="next"
        onSubmitEditing={() => passwordInput.current?.focus()}
        blurOnSubmit={false}
        editable={!isSubmitting}
      />
      <AuthField
        ref={passwordInput}
        label="New password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (notice) clearNotice();
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH + 1}
        returnKeyType="go"
        onSubmitEditing={handleReset}
        editable={!isSubmitting}
        action={{ label: showPassword ? 'Hide' : 'Show', onPress: () => setShowPassword((shown) => !shown) }}
      />
      <PasswordRules password={password} />

      <AuthButton title="Set new password" onPress={handleReset} isLoading={isSubmitting} />
      <AuthButton
        title={secondsLeft > 0 ? `Resend code (${secondsLeft}s)` : 'Resend code'}
        variant="link"
        onPress={handleResend}
        disabled={secondsLeft > 0}
      />
      <AuthButton title="Back to sign in" variant="link" onPress={() => router.replace('/login')} />
    </AuthScreen>
  );
}
