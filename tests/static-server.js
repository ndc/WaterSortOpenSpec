// tests/static-server.js
// Minimal static file server used by Playwright's webServer during E2E
// tests. Needed because index.html loads app.js as an ES module
// (<script type="module">), and Chromium refuses to load module scripts over
// the file:// protocol - so tests must be served over http:// instead.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = process.env.PORT ? Number(process.env.PORT) : 4173;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

// Resolves a request URL to an absolute file path within rootDir, refusing
// anything that would escape it (e.g. via "..").
function resolveRequestPath(url) {
    const decoded = decodeURIComponent((url || '/').split('?')[0]);
    const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
    const resolved = path.resolve(rootDir, relative);
    if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) return null;
    return resolved;
}

const server = http.createServer((req, res) => {
    const filePath = resolveRequestPath(req.url);
    if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(port, () => {
    console.log(`Static server listening on http://127.0.0.1:${port}`);
});
