import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Turns whatever sign-in threw into a short message for the login screen.
 *
 * The raw Supabase text is never shown: it is written for developers, and "Invalid login
 * credentials" is deliberately the same for an unknown email and a wrong password, so the
 * screen must not say which of the two it was.
 */
export type SignInFailureKind =
  | 'network'
  | 'service-unavailable'
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'rate-limited'
  | 'unknown';

export interface SignInFailure {
  kind: SignInFailureKind;
  message: string;
}

const FAILURES: Record<SignInFailureKind, string> = {
  network: 'No network connection. Check your internet and try again.',
  'service-unavailable': 'The sign-in service is unavailable right now. Try again in a moment.',
  'invalid-credentials': 'Incorrect email or password.',
  'email-not-confirmed': 'Your email address has not been confirmed yet.',
  'rate-limited': 'Too many attempts. Wait a minute and try again.',
  unknown: 'Sign-in failed. Please try again.',
};

const classify = (error: unknown): SignInFailureKind => {
  // Raised for failed requests: status 0 means the request never reached the server,
  // 502-504 means the server (or a proxy in front of it) was down.
  if (isAuthRetryableFetchError(error)) {
    return error.status === 0 || error.status === undefined ? 'network' : 'service-unavailable';
  }

  if (isAuthApiError(error)) {
    if (error.code === 'invalid_credentials') return 'invalid-credentials';
    if (error.code === 'email_not_confirmed') return 'email-not-confirmed';
    if (error.status === 429 || error.code === 'over_request_rate_limit') return 'rate-limited';
  }

  return 'unknown';
};

export const describeSignInError = (error: unknown): SignInFailure => {
  const kind = classify(error);
  return { kind, message: FAILURES[kind] };
};
