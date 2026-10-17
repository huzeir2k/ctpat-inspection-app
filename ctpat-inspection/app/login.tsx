import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareScrollView from './components/KeyboardAwareScrollView';
import { describeSignInError } from './models/authErrors';
import SupabaseAuthService from './services/SupabaseAuthService';

/**
 * The first screen a signed-out user sees. Signing in updates the session, and the root
 * layout (_layout.tsx) then moves the user to the home screen by itself.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInput = useRef<TextInput>(null);

  const handleSignIn = async () => {
    if (isSubmitting) return;

    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await SupabaseAuthService.signInWithPassword(email.trim(), password);
    } catch (error) {
      setErrorMessage(describeSignInError(error).message);
      setIsSubmitting(false);
    }
    // On success this screen is removed by the layout, so there is nothing more to reset.
  };

  // Editing a field means the user is acting on the error, so stop showing it.
  const onChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (errorMessage) setErrorMessage(null);
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>CTPAT Inspection</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      {errorMessage ? (
        <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
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
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          ref={passwordInput}
          style={styles.input}
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
      </View>

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // flexGrow centres the form on tall screens; on short ones (keyboard open) it scrolls.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f5c2c0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#b3261e',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
