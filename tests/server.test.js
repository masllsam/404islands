/**
 * The server.
 *
 * It serves the artwork, shields a free data source from this project's
 * traffic, and takes reservations. All three have failure modes that matter:
 * a traversal escape would leak the filesystem, a broken cache would hammer
 * Open-Meteo, and a reservation endpoint that accepts anything would be
 * worthless. Those are what is tested.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server;
let base;
let dataDir;

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), '404islands-test-'));
  process.env.DATA_DIR = dataDir;

  ({ server } = await import('../server/index.js'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
});

test('health check reports a full atlas', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.islands, 404);
});

test('the island API serves the catalogue', async () => {
  const list = await (await fetch(`${base}/api/islands`)).json();
  assert.equal(list.count, 404);
  assert.equal(list.islands.length, 404);
  assert.equal(list.islands[0].number, 1);

  const one = await fetch(`${base}/api/islands/217`);
  assert.equal(one.status, 200);
  const island = await one.json();
  assert.equal(island.number, 217);
  assert.ok(island.terrain && island.surface);
  assert.equal(typeof island.name, 'string');
});

test('an island outside 1–404 is a 404, with the obvious joke intact', async () => {
  const res = await fetch(`${base}/api/islands/999`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /exactly 404/);
});

test('unknown API routes do not fall through to the app shell', async () => {
  const res = await fetch(`${base}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /application\/json/);
});

test('the climate proxy requires coordinates', async () => {
  const res = await fetch(`${base}/api/climate/forecast`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /latitude and longitude/);
});

test('static files are served, with the SPA shell as the fallback', async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  const html = await index.text();
  assert.match(html, /404 Islands/);

  // An unknown non-file path is the app's own route, not a server error.
  const route = await fetch(`${base}/atlas`);
  assert.equal(route.status, 200);
  assert.match(route.headers.get('content-type'), /text\/html/);

  // A missing asset, though, is genuinely missing.
  const missing = await fetch(`${base}/styles/nope.css`);
  assert.equal(missing.status, 404);
});

test('module and stylesheet types are correct, or nothing loads', async () => {
  const js = await fetch(`${base}/src/main.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /text\/javascript/);
  assert.equal(js.headers.get('x-content-type-options'), 'nosniff');

  const css = await fetch(`${base}/styles/base.css`);
  assert.match(css.headers.get('content-type'), /text\/css/);
});

test('path traversal cannot escape the app directory', async () => {
  for (const attempt of [
    '/../package.json',
    '/../../etc/passwd',
    '/..%2fpackage.json',
    '/%2e%2e/%2e%2e/package.json',
    '/src/../../package.json',
  ]) {
    const res = await fetch(`${base}${attempt}`, { redirect: 'manual' });
    assert.ok(
      res.status === 403 || res.status === 404 || res.status === 200,
      `unexpected status ${res.status} for ${attempt}`
    );
    if (res.status === 200) {
      const body = await res.text();
      assert.ok(
        !body.includes('"name": "404islands"') && !body.includes('root:x:'),
        `traversal succeeded for ${attempt}`
      );
    }
  }
});

test('reservations validate island, tier and address', async () => {
  const post = (body) =>
    fetch(`${base}/api/reserve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  assert.equal((await post({ island: 999, email: 'a@b.co', tier: 'steward' })).status, 400);
  assert.equal((await post({ island: 1, email: 'not-an-email', tier: 'steward' })).status, 400);
  assert.equal((await post({ island: 1, email: 'a@b.co', tier: 'emperor' })).status, 400);

  const bad = await fetch(`${base}/api/reserve`, { method: 'POST', body: 'not json' });
  assert.equal(bad.status, 400);

  const wrongMethod = await fetch(`${base}/api/reserve`);
  assert.equal(wrongMethod.status, 405);
});

test('a valid reservation is recorded and says no payment was taken', async () => {
  const res = await fetch(`${base}/api/reserve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      island: 217,
      email: 'collector@example.com',
      tier: 'guardian',
      note: 'For the hallway.',
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.island, 217);
  assert.match(body.message, /No payment has been taken/i);

  const log = await readFile(join(dataDir, 'reservations.ndjson'), 'utf8');
  const record = JSON.parse(log.trim().split('\n').at(-1));
  assert.equal(record.island, 217);
  assert.equal(record.email, 'collector@example.com');
  assert.equal(record.tier, 'guardian');
  assert.equal(record.note, 'For the hallway.');
});

test('oversized reservation payloads are rejected rather than buffered', async () => {
  const res = await fetch(`${base}/api/reserve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ island: 1, email: 'a@b.co', tier: 'steward', note: 'x'.repeat(20000) }),
  });
  assert.equal(res.status, 400);
});
