/**
 * Test servers for the browser run:
 *   - the REAL Express API (routes, validation, PDF rendering, ownership checks)
 *     with in-memory stand-ins for MongoDB and Supabase Storage;
 *   - a static file server for the web build in e2e/dist.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { API_PORT, WEB_PORT, JWT_SECRET, USER_ID } = require('./config');

const backend = path.resolve(__dirname, '../ctpat-backend');
// Use the backend's own dependency so there is a single copy of jsonwebtoken.
const jwt = require(require.resolve('jsonwebtoken', { paths: [backend] }));

// Must be set before the backend is loaded: the auth middleware reads it once.
process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

const backendRequire = (file) => require(path.join(backend, file));
const { createApp } = backendRequire('src/app');
const { getForm } = backendRequire('src/forms');
const pdfFiller = backendRequire('src/services/PdfFillerService');
const { createInspectionService } = backendRequire('src/services/InspectionService');
const { createFakeInspectionModel, createFakeStorage } = backendRequire('test/helpers/fakes');

const DIST = path.join(__dirname, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };

/** Serves e2e/dist; "/inspection" maps to inspection.html, unknown paths to index.html. */
const staticHandler = (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const candidates = [urlPath, `${urlPath}.html`, path.join(urlPath, 'index.html'), '/index.html'];
  for (const candidate of candidates) {
    const file = path.join(DIST, candidate);
    if (!file.startsWith(DIST)) break; // never serve outside dist
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.writeHead(404).end('Not found');
};

const listen = (server, port) => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const startServers = async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('e2e/dist is missing. Run: npm run build-web');
  }
  const Inspection = createFakeInspectionModel();
  const storage = createFakeStorage();
  const service = createInspectionService({
    Inspection,
    storage,
    pdfFiller,
    emailer: { sendInspectionReport: async ({ to }) => ({ messageId: 'e2e', recipient: to }) },
    getForm,
    logger: { error() {} },
  });

  const api = createApp({ inspectionService: service }).listen(API_PORT, '127.0.0.1');
  await new Promise((resolve) => api.once('listening', resolve));
  const web = http.createServer(staticHandler);
  await listen(web, WEB_PORT);

  const accessToken = jwt.sign({ sub: USER_ID, email: 'e2e@example.com' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return {
    Inspection,
    storage,
    accessToken,
    close: () => Promise.all([new Promise((r) => api.close(r)), new Promise((r) => web.close(r))]),
  };
};

module.exports = { startServers };

if (require.main === module) {
  startServers().then(() => console.log(`App: http://localhost:${WEB_PORT}  API: http://localhost:${API_PORT}`));
}
