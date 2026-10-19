import React, { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Text from './components/AppText';
import AuthButton from './components/AuthButton';
import AuthDivider from './components/AuthDivider';
import AuthField from './components/AuthField';
import AuthScreen from './components/AuthScreen';
import GoogleButton from './components/GoogleButton';
import PasswordRules from './components/PasswordRules';
import useAuthSubmit from './components/useAuthSubmit';
import {
  NAME_MAX_LENGTH,
  TRUCK_NUMBER_MAX_LENGTH,
  normalizeEmail,
  normalizeTruckNumber,
  validateEmail,
  validateName,
  validateTruckNumber,
} from './models/accountFields';
import { GOOGLE_SIGN_IN_ENABLED } from './models/features';
import { PASSWORD_MAX_LENGTH, checkPassword } from './models/passwordRules';
import SupabaseAuthService from './services/SupabaseAuthService';

/**
 * Creates an account. Supabase then emails a verification code, which the next screen
 * asks for; the account only works after that.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { notice, isSubmitting, submit, showError, clearNotice } = useAuthSubmit();

  const lastNameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const truckInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);

  const handleSignUp = () => {
    const problem =
      validateName(firstName, 'first name') ??
      validateName(lastName, 'last name') ??
      validateEmail(email) ??
      validateTruckNumber(truckNumber) ??
      checkPassword(password).message;
    if (problem) {
      showError(problem);
      return;
    }

    const verifiedEmail = normalizeEmail(email);
    submit(async () => {
      await SupabaseAuthService.signUp({
        email: verifiedEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        truckNumber: normalizeTruckNumber(truckNumber),
      });
      router.replace({ pathname: '/verify-email', params: { email: verifiedEmail } });
    });
  };

  const onChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (notice) clearNotice();
  };

  const next = (target: React.RefObject<TextInput | null>) => () => target.current?.focus();

  return (
    <AuthScreen
      title="Create account"
      subtitle={GOOGLE_SIGN_IN_ENABLED ? 'Use your Google account, or your email address' : 'Register with your email address'}
      notice={notice}
    >
      {GOOGLE_SIGN_IN_ENABLED ? (
        <>
          <GoogleButton disabled={isSubmitting} onStart={clearNotice} onError={showError} />
          <AuthDivider label="or sign up with email" />
        </>
      ) : null}

      <AuthField
        label="First name"
        value={firstName}
        onChangeText={onChange(setFirstName)}
        autoCapitalize="words"
        autoComplete="given-name"
        maxLength={NAME_MAX_LENGTH}
        returnKeyType="next"
        onSubmitEditing={next(lastNameInput)}
        blurOnSubmit={false}
        editable={!isSubmitting}
      />
      <AuthField
        ref={lastNameInput}
        label="Last name"
        value={lastName}
        onChangeText={onChange(setLastName)}
        autoCapitalize="words"
        autoComplete="family-name"
        maxLength={NAME_MAX_LENGTH}
        returnKeyType="next"
        onSubmitEditing={next(emailInput)}
        blurOnSubmit={false}
        editable={!isSubmitting}
      />
      <AuthField
        ref={emailInput}
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChangeText={onChange(setEmail)}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={next(truckInput)}
        blurOnSubmit={false}
        editable={!isSubmitting}
      />
      <AuthField
        ref={truckInput}
        label="Truck number"
        value={truckNumber}
        onChangeText={onChange(setTruckNumber)}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={TRUCK_NUMBER_MAX_LENGTH}
        returnKeyType="next"
        onSubmitEditing={next(passwordInput)}
        blurOnSubmit={false}
        editable={!isSubmitting}
      />
      <AuthField
        ref={passwordInput}
        label="Password"
        value={password}
        onChangeText={onChange(setPassword)}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH + 1}
        returnKeyType="go"
        onSubmitEditing={handleSignUp}
        editable={!isSubmitting}
        action={{ label: showPassword ? 'Hide' : 'Show', onPress: () => setShowPassword((shown) => !shown) }}
      />
      <PasswordRules password={password} />

      <AuthButton title="Create account" onPress={handleSignUp} isLoading={isSubmitting} />
      <Text style={styles.hint}>We will email you a code to confirm your address.</Text>
      <AuthButton title="I already have an account" variant="link" onPress={() => router.replace('/login')} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: 8, textAlign: 'center', fontSize: 13, color: '#666' },
});
