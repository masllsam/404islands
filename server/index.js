#!/usr/bin/env node
/**
 * 404 Islands — application server.
 *
 * Zero dependencies, on purpose. This process does three jobs:
 *
 *   1. Serve the app. Static files with correct types, strong caching for
 *      fingerprinted assets, and pre-compressed responses for text.
 *   2. Stand between the atlas and Open-Meteo. One shared, TTL'd cache means a
 *      thousand visitors looking at the same island cost the upstream one
 *      request, which is both faster for them and fair to a free data source.
 *   3. Take reservations. There is no payment processor wired in — this
 *      records an intent to acquire and nothing more, and says so.
 *
 * Run: node server/index.js   (PORT, HOST, CLIMATE_TTL_MS are read from env)
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir, appendFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip, createBrotliCompress, constants as zlibConstants } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { getAtlas, getIsland, serializeIsland } from '../app/src/core/catalog.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP_DIR = join(ROOT, 'app');
const DATA_DIR = process.env.DATA_DIR || join(ROOT, '.data');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const CLIMATE_TTL_MS = Number(process.env.CLIMATE_TTL_MS || 10 * 60 * 1000);
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 12000);

const UPSTREAM = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  marine: 'https://marine-api.open-meteo.com/v1/marine',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest)|image\/svg)/;

// ── Climate cache ────────────────────────────────────────────────────────

/**
 * Keyed by the exact upstream query, so a batch of fifty islands is one entry.
 * Entries are served stale while a refresh runs, which keeps every request
 * fast even at the moment a TTL expires.
 */
const climateCache = new Map();
const inflight = new Map();
let upstreamCalls = 0;
let cacheHits = 0;

function pruneCache() {
  if (climateCache.size < 500) return;
  const cutoff = Date.now() - CLIMATE_TTL_MS * 6;
  for (const [key, entry] of climateCache) {
    if (entry.at < cutoff) climateCache.delete(key);
  }
  // Still oversized? Drop the oldest quarter.
  if (climateCache.size >= 500) {
    const sorted = [...climateCache.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < sorted.length / 4; i++) climateCache.delete(sorted[i][0]);
  }
}

async function fetchUpstream(kind, query) {
  const url = `${UPSTREAM[kind]}?${query}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': '404islands/1.0 (atlas)' },
    });
    if (!res.ok) throw new Error(`${kind} upstream ${res.status}`);
    upstreamCalls++;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getClimate(kind, query) {
  const key = `${kind}?${query}`;
  const entry = climateCache.get(key);
  const now = Date.now();

  if (entry && now - entry.at < CLIMATE_TTL_MS) {
    cacheHits++;
    return { payload: entry.payload, age: now - entry.at, fresh: true };
  }

  const running = inflight.get(key);
  if (running) {
    if (entry) return { payload: entry.payload, age: now - entry.at, fresh: false };
    return { payload: await running, age: 0, fresh: true };
  }

  const promise = fetchUpstream(kind, query)
    .then((payload) => {
      climateCache.set(key, { payload, at: Date.now() });
      pruneCache();
      return payload;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);

  // Serve the stale copy immediately rather than making the visitor wait.
  if (entry) {
    promise.catch(() => {});
    return { payload: entry.payload, age: now - entry.at, fresh: false };
  }
  return { payload: await promise, age: 0, fresh: true };
}

// ── Responses ────────────────────────────────────────────────────────────

function sendJson(req, res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  sendText(req, res, status, text, {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
}

function sendText(req, res, status, text, headers = {}) {
  const buffer = Buffer.from(text);
  const accept = req.headers['accept-encoding'] || '';
  const type = headers['content-type'] || 'text/plain; charset=utf-8';

  if (buffer.length > 1024 && COMPRESSIBLE.test(type)) {
    if (/\bbr\b/.test(accept)) {
      res.writeHead(status, { ...headers, 'content-encoding': 'br', vary: 'accept-encoding' });
      const gz = createBrotliCompress({
        params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
      });
      gz.pipe(res);
      gz.end(buffer);
      return;
    }
    if (/\bgzip\b/.test(accept)) {
      res.writeHead(status, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' });
      const gz = createGzip({ level: 6 });
      gz.pipe(res);
      gz.end(buffer);
      return;
    }
  }

  res.writeHead(status, { ...headers, 'content-length': buffer.length });
  res.end(buffer);
}

async function serveStatic(req, res, pathname) {
  // Resolve inside APP_DIR only; `normalize` plus the prefix check defeats
  // `..` traversal and encoded variants alike.
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(APP_DIR, relative);
  if (!filePath.startsWith(APP_DIR)) {
    sendText(req, res, 403, 'Forbidden');
    return;
  }

  let info;
  try {
    info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath);
    }
  } catch {
    // Single-page app: unknown paths fall through to the shell, which routes
    // them client-side. A missing asset still 404s.
    if (extname(filePath)) {
      sendText(req, res, 404, 'Not found');
      return;
    }
    filePath = join(APP_DIR, 'index.html');
    try {
      info = await stat(filePath);
    } catch {
      sendText(req, res, 404, 'Not found');
      return;
    }
  }

  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(36)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag });
    res.end();
    return;
  }

  const immutable = /\.[0-9a-f]{8,}\./.test(filePath);
  const headers = {
    'content-type': type,
    etag,
    'cache-control': immutable
      ? 'public, max-age=31536000, immutable'
      : ext === '.html'
      ? 'no-cache'
      : 'public, max-age=300, must-revalidate',
    'x-content-type-options': 'nosniff',
  };

  const accept = req.headers['accept-encoding'] || '';
  if (COMPRESSIBLE.test(type) && info.size > 1024 && /\bgzip\b/.test(accept)) {
    res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' });
    await pipeline(createReadStream(filePath), createGzip({ level: 6 }), res).catch(() => {});
    return;
  }

  res.writeHead(200, { ...headers, 'content-length': info.size });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  await pipeline(createReadStream(filePath), res).catch(() => {});
}

// ── Reservations ─────────────────────────────────────────────────────────

async function readBody(req, limit = 8192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function handleReserve(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJson(req, res, 400, { error: 'Malformed request.' });
    return;
  }

  const island = getIsland(payload.island);
  const email = String(payload.email || '').trim();
  const tier = String(payload.tier || '').trim();

  if (!island) {
    sendJson(req, res, 400, { error: 'Unknown island.' });
    return;
  }
  if (!EMAIL.test(email) || email.length > 254) {
    sendJson(req, res, 400, { error: 'That email address does not look right.' });
    return;
  }
  if (!['steward', 'guardian', 'print'].includes(tier)) {
    sendJson(req, res, 400, { error: 'Unknown tier.' });
    return;
  }

  const record = {
    at: new Date().toISOString(),
    island: island.number,
    islandName: island.name,
    tier,
    email,
    note: String(payload.note || '').slice(0, 500),
  };

  try {
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(join(DATA_DIR, 'reservations.ndjson'), `${JSON.stringify(record)}\n`);
  } catch (err) {
    sendJson(req, res, 500, { error: 'Could not record that. Try again shortly.' });
    return;
  }

  sendJson(req, res, 200, {
    ok: true,
    island: island.number,
    tier,
    // Said plainly, because it is true: nothing has been charged.
    message:
      'Recorded. No payment has been taken and none is scheduled — this is a ' +
      'reservation of intent, and you will be written to before anything else happens.',
  });
}

// ── Routing ──────────────────────────────────────────────────────────────

const started = Date.now();

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  res.setHeader('x-frame-options', 'SAMEORIGIN');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

  if (pathname === '/healthz') {
    sendJson(req, res, 200, {
      ok: true,
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
      islands: getAtlas().islands.length,
      climate: { cached: climateCache.size, upstreamCalls, cacheHits },
    });
    return;
  }

  if (pathname === '/api/islands') {
    const islands = getAtlas().islands.map(serializeIsland);
    sendJson(req, res, 200, { count: islands.length, islands }, {
      'cache-control': 'public, max-age=86400',
    });
    return;
  }

  const islandMatch = /^\/api\/islands\/(\d+)$/.exec(pathname);
  if (islandMatch) {
    const island = getIsland(Number(islandMatch[1]));
    if (!island) {
      sendJson(req, res, 404, { error: 'No such island. There are exactly 404.' });
      return;
    }
    sendJson(req, res, 200, serializeIsland(island), {
      'cache-control': 'public, max-age=86400',
    });
    return;
  }

  const climateMatch = /^\/api\/climate\/(forecast|marine)$/.exec(pathname);
  if (climateMatch) {
    const kind = climateMatch[1];
    const query = url.searchParams.toString();
    if (!url.searchParams.get('latitude') || !url.searchParams.get('longitude')) {
      sendJson(req, res, 400, { error: 'latitude and longitude are required.' });
      return;
    }
    try {
      const { payload, age, fresh } = await getClimate(kind, query);
      sendJson(req, res, 200, payload, {
        'cache-control': `public, max-age=${Math.round(CLIMATE_TTL_MS / 1000)}`,
        'x-cache-age-ms': String(age),
        'x-cache': fresh ? 'fresh' : 'stale-while-revalidate',
      });
    } catch (err) {
      // The client has a modelled fallback; tell it plainly rather than
      // pretending we have data.
      sendJson(req, res, 502, { error: 'Upstream climate data unavailable.', detail: String(err.message) });
    }
    return;
  }

  if (pathname === '/api/reserve') {
    if (req.method !== 'POST') {
      sendJson(req, res, 405, { error: 'POST only.' }, { allow: 'POST' });
      return;
    }
    await handleReserve(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(req, res, 404, { error: 'No such endpoint.' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(req, res, 405, 'Method not allowed', { allow: 'GET, HEAD' });
    return;
  }

  await serveStatic(req, res, pathname);
}

export const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('unhandled', err);
    if (!res.headersSent) sendText(req, res, 500, 'Internal error');
    else res.end();
  });
});

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  server.listen(PORT, HOST, () => {
    console.log(`404 Islands — http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`  atlas: ${getAtlas().islands.length} islands`);
    console.log(`  climate cache TTL: ${Math.round(CLIMATE_TTL_MS / 1000)}s`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
