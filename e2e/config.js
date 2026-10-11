// Shared by build-web.js, server.js and run.js. All local; nothing here is a real secret.
module.exports = {
  API_PORT: 3000, // the origin the web build calls (allowed by the backend's CORS list)
  WEB_PORT: 8081,
  SUPABASE_URL: 'http://localhost:54321', // never contacted: the session is injected
  JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-12',
  USER_ID: 'e2e00000-0000-4000-8000-000000000001',
};
