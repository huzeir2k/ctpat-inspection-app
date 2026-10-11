/**
 * Builds the mobile app as a static web site into e2e/dist, pointed at the
 * local test servers (see server.js). Your real .env.local is not touched:
 * the values below are passed as environment variables, which take priority.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { API_PORT, SUPABASE_URL } = require('./config');

const appDir = path.resolve(__dirname, '../ctpat-inspection');
const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', path.join(__dirname, 'dist')], {
  cwd: appDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
    EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
  },
});
process.exit(result.status ?? 1);
