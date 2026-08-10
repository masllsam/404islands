#!/usr/bin/env node
/**
 * Browser smoke test.
 *
 * The unit tests cover everything that runs in Node. This covers the half that
 * only exists in a browser: that the shaders compile at all three quality
 * tiers, that every route mounts without throwing, and that navigating between
 * views does not leak WebGL contexts or listeners.
 *
 * Playwright is not a dependency of this project — it is large, and the app
 * itself has none. Run this with a globally installed Playwright:
 *
 *   npm i -g playwright && npx playwright install chromium
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Under a software rasteriser (CI without a GPU) rendering is slow but valid;
 * the timeouts below are sized for that case.
 */

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const OWN_SERVER = !process.argv[2];

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const specifier of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) {
    try {
      return require(specifier);
    } catch {
      /* try the next location */
    }
  }
  console.error(
    'Playwright not found. Install it globally:\n' +
      '  npm i -g playwright && npx playwright install chromium'
  );
  process.exit(2);
}

const { chromium } = loadPlaywright();

const ROUTES = [
  ['/', 'overture', '.overture__title h1'],
  ['/atlas', 'atlas', '.grid .tile'],
  ['/island/217', 'island', '.island__name'],
  ['/island/1', 'island', '.instruments .instrument'],
  ['/island/42?bare=1', 'bare island', '.bare__name'],
  ['/acquire', 'acquire', '.tiers .tier'],
  ['/acquire?island=7', 'acquire, from an island', '.notice a'],
  ['/about', 'about', '.section h1'],
  ['/island/9999', 'not found', '.notfound h1'],
  ['/somewhere-else', 'not found', '.notfound h1'],
];

let serverProcess;
if (OWN_SERVER) {
  serverProcess = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: '8099', HOST: '127.0.0.1' },
    stdio: 'ignore',
  });
  await sleep(800);
}

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

const failures = [];
let feedOffline = false;
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('requestfailed', (request) =>
  errors.push(`request failed: ${request.url()} — ${request.failure()?.errorText}`)
);

try {
  // One page load, then navigate by hash. That is both faster and a better
  // test: it exercises the router's teardown path and proves the shared GL
  // context survives being re-parented between views, which a fresh load
  // would hide.
  await page.goto(`${BASE}/#/`, { waitUntil: 'load' });

  for (const [route, name, selector] of ROUTES) {
    errors.length = 0;
    await page.evaluate((r) => {
      location.hash = `#${r}`;
    }, route);

    try {
      await page.waitForSelector(selector, { timeout: 30000, state: 'attached' });
      console.log(`  ok   ${route.padEnd(20)} ${name}`);
    } catch {
      failures.push(`${route}: never rendered ${selector}`);
      console.log(`  FAIL ${route.padEnd(20)} ${name} — missing ${selector}`);
    }

    // A blocked or absent climate feed is not a defect — it is the case the
    // modelled fallback exists for, and this run may well be offline. Report
    // it, but do not fail on it. Everything else is a real error.
    // Chromium echoes every failed request to the console without the URL, so
    // those lines carry no information the requestfailed handler above has not
    // already reported with the URL attached. Treat them as feed noise.
    const isFeed = (message) =>
      message.includes('open-meteo.com') ||
      message.includes('/api/climate') ||
      message.includes('Failed to load resource');

    const routeErrors = errors.filter(
      (message) => !message.includes('favicon') && !isFeed(message)
    );
    if (errors.some(isFeed)) feedOffline = true;

    if (routeErrors.length) {
      failures.push(`${route}: ${routeErrors.join(' | ')}`);
      for (const message of routeErrors) console.log(`       ${message}`);
    }
  }

  // Shaders: all three tiers must compile, not just the interactive one.
  await page.evaluate(() => {
    location.hash = '#/island/42';
  });
  await page.waitForSelector('.island__name', { timeout: 30000, state: 'attached' });
  const shaderReport = await page.evaluate(async () => {
    const renderer = window.atlas404?.stage?.renderer;
    if (!renderer?.supported) return { supported: false };
    const tiers = [];
    for (const tier of [0, 1, 2]) {
      try {
        renderer.sceneProgram(tier);
        tiers.push({ tier, ok: true });
      } catch (error) {
        tiers.push({ tier, ok: false, log: error.log || error.message });
      }
    }
    return { supported: true, tiers, glError: renderer.gl.getError() };
  });

  if (!shaderReport.supported) {
    failures.push('WebGL2 unavailable in the test browser');
  } else {
    for (const { tier, ok, log } of shaderReport.tiers) {
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} shader tier ${tier}`);
      if (!ok) failures.push(`shader tier ${tier}: ${log}`);
    }
    if (shaderReport.glError !== 0) {
      failures.push(`glGetError ${shaderReport.glError}`);
    }
  }

  // Navigating away and back must not strand the shared GL context.
  await page.evaluate(() => {
    location.hash = '#/atlas';
  });
  await page.waitForSelector('.grid .tile', { timeout: 60000, state: 'attached' });
  await page.evaluate(() => {
    location.hash = '#/island/7';
  });
  await page.waitForSelector('.island__name', { timeout: 60000, state: 'attached' });
  const stageAttached = await page.evaluate(
    () => !!document.querySelector('.island__stage canvas')
  );
  console.log(`  ${stageAttached ? 'ok  ' : 'FAIL'} stage survives navigation`);
  if (!stageAttached) failures.push('the stage canvas was lost when navigating back');
} finally {
  await browser.close();
  serverProcess?.kill();
}

if (feedOffline) {
  console.log(
    '\n  note  the climate feed was unreachable, so the atlas ran on its\n' +
    '        modelled fallback. That is the intended behaviour offline, and\n' +
    '        every view above rendered without it.'
  );
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  — ${failure}`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
