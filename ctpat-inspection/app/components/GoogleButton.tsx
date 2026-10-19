import React, { useState } from 'react';
import { describeAuthError } from '../models/authErrors';
import SupabaseAuthService from '../services/SupabaseAuthService';
import AuthButton from './AuthButton';

interface Props {
  /** The screen's own submit is running; do not start a second sign-in. */
  disabled?: boolean;
  onStart?: () => void;
  onError: (message: string) => void;
}

/**
 * "Continue with Google": signs in an existing Google user or creates the account for a new
 * one. On success the session changes and the root layout moves the user to the home screen.
 */
export default function GoogleButton({ disabled = false, onStart, onError }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (isLoading) return;
    onStart?.();
    setIsLoading(true);
    try {
      await SupabaseAuthService.signInWithGoogle();
    } catch (error) {
      onError(describeAuthError(error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return <AuthButton title="Continue with Google" variant="secondary" onPress={handlePress} isLoading={isLoading} disabled={disabled} />;
}
