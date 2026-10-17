const { SUPABASE_URL, USER_ID } = require('./config');

/** supabase-js keeps its session in localStorage under sb-<host>-auth-token. */
const sessionScript = (accessToken) => {
  const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER_ID, email: 'e2e@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  return `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(session))});`;
};

module.exports = { sessionScript };
