import { isAuthApiError, isAuthRetryableFetchError, isAuthWeakPasswordError } from '@supabase/supabase-js';
import { OAuthRedirectError } from './authRedirect';

/**
 * Turns whatever an auth call threw into a short message for the screen.
 *
 * The raw Supabase text is never shown: it is written for developers, and some of it is
 * deliberately vague (for example "Invalid login credentials" is the same for an unknown
 * email and a wrong password), so the screens must not guess which case it was.
 */
export type AuthFailureKind =
  | 'network'
  | 'service-unavailable'
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'invalid-code'
  | 'weak-password'
  | 'invalid-email'
  | 'account-exists'
  | 'signup-disabled'
  | 'google-failed'
  | 'rate-limited'
  | 'unknown';

export interface AuthFailure {
  kind: AuthFailureKind;
  message: string;
}

const MESSAGES: Record<AuthFailureKind, string> = {
  network: 'No network connection. Check your internet and try again.',
  'service-unavailable': 'The service is unavailable right now. Try again in a moment.',
  'invalid-credentials': 'Incorrect email or password.',
  'email-not-confirmed': 'Your email address has not been confirmed yet.',
  'invalid-code': 'That code is incorrect or has expired. Check it, or request a new one.',
  'weak-password': 'That password does not meet the requirements.',
  'invalid-email': 'Enter a valid email address.',
  'account-exists': 'An account may already exist for this email. Try signing in, or reset your password.',
  'signup-disabled': 'Creating accounts is turned off right now.',
  'google-failed': 'Google sign-in did not complete. Try again, or use your email instead.',
  'rate-limited': 'Too many attempts. Wait a minute and try again.',
  unknown: 'Something went wrong. Please try again.',
};

const ERROR_CODES: Record<string, AuthFailureKind> = {
  invalid_credentials: 'invalid-credentials',
  email_not_confirmed: 'email-not-confirmed',
  otp_expired: 'invalid-code',
  otp_disabled: 'invalid-code',
  weak_password: 'weak-password',
  email_address_invalid: 'invalid-email',
  validation_failed: 'invalid-email',
  user_already_exists: 'account-exists',
  email_exists: 'account-exists',
  signup_disabled: 'signup-disabled',
  over_request_rate_limit: 'rate-limited',
  over_email_send_rate_limit: 'rate-limited',
};

const classify = (error: unknown): AuthFailureKind => {
  if (error instanceof OAuthRedirectError) return 'google-failed';

  // Raised for failed requests: status 0 means the request never reached the server,
  // 502-504 means the server (or a proxy in front of it) was down.
  if (isAuthRetryableFetchError(error)) {
    return error.status === 0 || error.status === undefined ? 'network' : 'service-unavailable';
  }

  // A rejected password arrives as its own error class, not as an ordinary API error.
  if (isAuthWeakPasswordError(error)) return 'weak-password';

  if (isAuthApiError(error)) {
    if (error.code && ERROR_CODES[error.code]) return ERROR_CODES[error.code];
    if (error.status === 429) return 'rate-limited';
  }

  return 'unknown';
};

export const describeAuthError = (error: unknown): AuthFailure => {
  const kind = classify(error);
  return { kind, message: MESSAGES[kind] };
};
