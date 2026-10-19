/**
 * Password rules for new accounts. These must stay in step with the project's Supabase
 * Auth settings (Authentication > Sign In / Providers > Email > Password requirements),
 * which are the real enforcement: anyone can call Supabase directly and skip this app.
 * The checks here only give the user instant feedback.
 */

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt, which Supabase uses to store passwords, ignores everything past 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;

// The symbols Supabase counts as "special" for its required-characters setting.
const SPECIAL_CHARACTERS = `!@#$%^&*()_+-=[]{};'\\:"|<>?,./\`~`;

export interface PasswordRule {
  id: string;
  label: string;
  isMet: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, isMet: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'uppercase', label: 'One capital letter', isMet: (p) => /[A-Z]/.test(p) },
  // Supabase's strictest setting always asks for a lowercase letter too, so this app does as well.
  { id: 'lowercase', label: 'One lowercase letter', isMet: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', isMet: (p) => /[0-9]/.test(p) },
  {
    id: 'special',
    label: 'One special character (! @ # $ % ...)',
    isMet: (p) => [...p].some((character) => SPECIAL_CHARACTERS.includes(character)),
  },
];

export interface PasswordCheck {
  isValid: boolean;
  unmet: PasswordRule[];
  message: string | null;
}

export const checkPassword = (password: string): PasswordCheck => {
  const unmet = PASSWORD_RULES.filter((rule) => !rule.isMet(password));

  if (password.length > PASSWORD_MAX_LENGTH) {
    return { isValid: false, unmet, message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  if (unmet.length > 0) {
    return { isValid: false, unmet, message: 'The password does not meet all the requirements below.' };
  }
  return { isValid: true, unmet, message: null };
};
