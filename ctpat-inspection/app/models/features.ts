/**
 * Features that can be switched on or off for a build, without changing code.
 *
 * Each reads an environment variable that is fixed when the app is built, so turning one on
 * means setting the variable (in eas.json, under the build profile's "env") and building again.
 */

/**
 * "Continue with Google" on the sign-in and sign-up screens. Off by default: it only works
 * once Google Cloud and the Supabase Google provider are set up (see SUPABASE_AUTH_SETUP.md,
 * section 3b). Turn on with EXPO_PUBLIC_GOOGLE_SIGN_IN=true.
 */
export const GOOGLE_SIGN_IN_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN === 'true';
