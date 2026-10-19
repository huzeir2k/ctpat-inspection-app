/**
 * Checks for the sign-up form. Each returns an error message, or null when the value is fine.
 * The values are also stored in the Supabase user profile, which the user can edit and
 * which anyone could set by calling Supabase directly: treat them as labels, never as proof.
 */

export const NAME_MAX_LENGTH = 50;
export const TRUCK_NUMBER_MAX_LENGTH = 20;
export const EMAIL_MAX_LENGTH = 254;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const validateName = (value: string, label: string): string | null => {
  const name = value.trim();
  if (!name) return `Enter your ${label}.`;
  if (name.length > NAME_MAX_LENGTH) return `The ${label} is too long.`;
  if (/[0-9<>]/.test(name)) return `The ${label} contains characters that are not allowed.`;
  return null;
};

export const validateEmail = (value: string): string | null => {
  const email = normalizeEmail(value);
  if (!email) return 'Enter your email address.';
  if (email.length > EMAIL_MAX_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }
  return null;
};

export const normalizeTruckNumber = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

export const validateTruckNumber = (value: string): string | null => {
  const truckNumber = normalizeTruckNumber(value);
  if (!truckNumber) return 'Enter your truck number.';
  if (truckNumber.length > TRUCK_NUMBER_MAX_LENGTH) return 'The truck number is too long.';
  if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(truckNumber)) {
    return 'The truck number can only use letters, numbers, spaces and dashes.';
  }
  return null;
};

/** The number of digits in the emailed code. Matches the project's "Email OTP Length" setting (default 6). */
export const VERIFICATION_CODE_LENGTH = 6;

export const validateVerificationCode = (value: string): string | null =>
  new RegExp(`^[0-9]{${VERIFICATION_CODE_LENGTH}}$`).test(value.trim())
    ? null
    : `Enter the ${VERIFICATION_CODE_LENGTH}-digit code from the email.`;
