/**
 * Reading the address Supabase sends the user back to after "Continue with Google".
 *
 * Supabase appends its answer to the address in the part after "#" (or, for some errors,
 * after "?"), for example
 *   ctpatinspection://auth-callback#access_token=...&refresh_token=...&expires_in=3600
 * or, when the user said no or Google refused,
 *   ctpatinspection://auth-callback#error=access_denied&error_description=...
 */

export interface AuthRedirect {
  accessToken?: string;
  refreshToken?: string;
  /** Present when Supabase or Google reported a problem. */
  error?: string;
}

/** The sign-in came back without a usable session. */
export class OAuthRedirectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthRedirectError';
  }
}

const decode = (text: string) => {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
};

const parseParameters = (text: string): Record<string, string> => {
  const parameters: Record<string, string> = {};
  for (const pair of text.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = decode(separator === -1 ? pair : pair.slice(0, separator));
    parameters[key] = separator === -1 ? '' : decode(pair.slice(separator + 1));
  }
  return parameters;
};

export const parseAuthRedirect = (url: string): AuthRedirect => {
  const hashStart = url.indexOf('#');
  const hash = hashStart === -1 ? '' : url.slice(hashStart + 1);
  const beforeHash = hashStart === -1 ? url : url.slice(0, hashStart);
  const queryStart = beforeHash.indexOf('?');
  const query = queryStart === -1 ? '' : beforeHash.slice(queryStart + 1);

  // The fragment wins: that is where the tokens are.
  const parameters = { ...parseParameters(query), ...parseParameters(hash) };

  return {
    accessToken: parameters.access_token || undefined,
    refreshToken: parameters.refresh_token || undefined,
    error: parameters.error_description || parameters.error || undefined,
  };
};
