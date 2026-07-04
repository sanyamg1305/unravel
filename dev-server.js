// Local development only. Not used by Vercel in production (Vercel runs
// api/*.js as serverless functions automatically). This just lets us serve
// the static site AND exercise the /api/generate route with one command,
// using the same handler Vercel would call.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;

// load .env.local by hand (no dependency on dotenv)
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { default: generateHandler } = await import('./api/generate.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(__dirname, decodeURIComponent(filePath));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/generate' && req.method === 'POST') {
    try {
      req.body = await readJsonBody(req);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
      return;
    }
    const fakeRes = {
      status(code) { res.statusCode = code; return this; },
      json(obj) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
      },
    };
    await generateHandler(req, fakeRes);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Local dev server (static + /api/generate) running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.log('Warning: GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key.');
  }
});
