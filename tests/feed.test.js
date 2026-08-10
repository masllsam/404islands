/**
 * The live feed, against a fake Open-Meteo.
 *
 * The real API cannot be reached from a test run, and should not be — a test
 * suite has no business making requests to a free public service. So this
 * stands up a server that replies in Open-Meteo's documented shape, including
 * the parts that are easy to get wrong: an array response for a multi-location
 * query, nulls for fields a marine grid cell cannot supply, and timestamps
 * without a zone designator.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { ClimateService } from '../app/src/climate/service.js';
import { getAtlas, getIsland } from '../app/src/core/catalog.js';

let upstream;
let base;
const seen = { forecast: [], marine: [] };
let failNext = false;

/**
 * Open-Meteo emits local ISO time with no zone designator. The observation has
 * to be recent, because a record older than six hours is deliberately treated
 * as unusable and replaced with a modelled sky.
 */
function nowStamp() {
  return new Date().toISOString().slice(0, 16);
}

/** One location's worth of an Open-Meteo `/v1/forecast` reply. */
function forecastFor(index) {
  return {
    latitude: 0,
    longitude: 0,
    generationtime_ms: 0.2,
    utc_offset_seconds: 0,
    timezone: 'GMT',
    elevation: 12,
    current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
    current: {
      time: nowStamp(),
      interval: 900,
      temperature_2m: 20 + index,
      relative_humidity_2m: 71,
      apparent_temperature: 22 + index,
      is_day: index % 2,
      precipitation: 0.3,
      rain: 0.3,
      snowfall: 0,
      weather_code: 61,
      cloud_cover: 64,
      pressure_msl: 1008.4,
      wind_speed_10m: 23.7,
      wind_direction_10m: 212,
      wind_gusts_10m: 41.2,
    },
  };
}

function marineFor(index) {
  return {
    latitude: 0,
    longitude: 0,
    current_units: { wave_height: 'm' },
    current: {
      time: nowStamp(),
      // A grid cell over land reports nothing; the client must survive it.
      wave_height: index === 1 ? null : 1.8,
      wave_direction: index === 1 ? null : 210,
      wave_period: index === 1 ? null : 7.4,
      sea_surface_temperature: index === 1 ? null : 18.6,
    },
  };
}

before(async () => {
  upstream = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const kind = url.pathname.includes('marine') ? 'marine' : 'forecast';
    const count = (url.searchParams.get('latitude') || '').split(',').length;
    seen[kind].push({ count, query: url.searchParams });

    if (failNext) {
      res.writeHead(503).end('upstream down');
      return;
    }

    const build = kind === 'marine' ? marineFor : forecastFor;
    // Open-Meteo returns a bare object for one coordinate, an array for many.
    const body =
      count === 1 ? build(0) : Array.from({ length: count }, (_, i) => build(i));

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${upstream.address().port}`;
});

after(async () => {
  await new Promise((resolve) => upstream.close(resolve));
});

function makeService(options = {}) {
  return new ClimateService({
    proxy: null,
    persist: false,
    forecastUrl: `${base}/v1/forecast`,
    marineUrl: `${base}/v1/marine`,
    ...options,
  });
}

test('an observation is parsed into the atlas record shape', async () => {
  seen.forecast.length = 0;
  const service = makeService();
  const island = getIsland(42);

  await service.ensure([island]);
  const record = service.get(island);

  assert.equal(record.source, 'observed');
  assert.equal(record.islandNumber, 42);
  assert.equal(record.temperature, 20);
  assert.equal(record.apparentTemperature, 22);
  assert.equal(record.humidity, 71);
  assert.equal(record.weatherCode, 61);
  assert.equal(record.cloudCover, 64);
  assert.equal(record.windSpeed, 23.7);
  assert.equal(record.windDirection, 212);
  assert.equal(record.windGusts, 41.2);
  assert.equal(record.pressure, 1008.4);
  assert.equal(record.isDay, false);
  assert.equal(record.waveHeight, 1.8);
  assert.equal(record.seaSurfaceTemperature, 18.6);

  // A zone-less timestamp must be read as UTC, not as the runner's local time.
  // Anything else would put half the atlas an hour out of step with its sun.
  assert.ok(
    Math.abs(record.observedAt - Date.now()) < 90 * 1000,
    'the observation time was not parsed as UTC'
  );
});

test('marine nulls degrade to null, never to zero', async () => {
  const service = makeService();
  const islands = [getIsland(10), getIsland(11)];
  await service.ensure(islands);

  const withoutSea = service.get(islands[1]);
  assert.equal(withoutSea.source, 'observed');
  assert.equal(withoutSea.waveHeight, null);
  assert.equal(withoutSea.seaSurfaceTemperature, null);
  assert.equal(withoutSea.wavePeriod, null);
  // Still a usable record: the atmosphere came through.
  assert.equal(withoutSea.temperature, 21);
});

test('the whole atlas is fetched in batches of fifty', async () => {
  seen.forecast.length = 0;
  const service = makeService();

  await service.ensure(getAtlas().islands);

  const counts = seen.forecast.map((r) => r.count);
  assert.equal(counts.reduce((a, b) => a + b, 0), 404);
  assert.equal(counts.length, 9, `expected 9 batches, got ${counts.length}`);
  assert.ok(counts.every((c) => c <= 50), `a batch exceeded 50: ${counts}`);

  // Every island ends up with an observation.
  const observed = getAtlas().islands.filter((i) => service.isFresh(i.number));
  assert.equal(observed.length, 404);
});

test('the requested fields are the ones the renderer needs', async () => {
  seen.forecast.length = 0;
  seen.marine.length = 0;
  const service = makeService();
  await service.ensure([getIsland(1)]);

  const current = seen.forecast[0].query.get('current').split(',');
  for (const field of [
    'temperature_2m', 'relative_humidity_2m', 'is_day', 'precipitation',
    'weather_code', 'cloud_cover', 'pressure_msl', 'wind_speed_10m',
    'wind_direction_10m', 'wind_gusts_10m',
  ]) {
    assert.ok(current.includes(field), `missing ${field} from the forecast query`);
  }
  assert.equal(seen.forecast[0].query.get('timezone'), 'UTC');
  assert.equal(seen.forecast[0].query.get('wind_speed_unit'), 'kmh');

  const marine = seen.marine[0].query.get('current').split(',');
  assert.ok(marine.includes('wave_height'));
  assert.ok(marine.includes('sea_surface_temperature'));
});

test('a fresh record is not refetched', async () => {
  const service = makeService();
  const island = getIsland(88);

  await service.ensure([island]);
  seen.forecast.length = 0;
  await service.ensure([island]);

  assert.equal(seen.forecast.length, 0, 'refetched a record that was still fresh');
});

test('concurrent requests for the same island share one fetch', async () => {
  seen.forecast.length = 0;
  const service = makeService();
  const islands = [getIsland(120), getIsland(121)];

  await Promise.all([
    service.ensure(islands),
    service.ensure(islands),
    service.ensure(islands),
  ]);

  assert.equal(seen.forecast.length, 1, 'the same batch was fetched more than once');
});

test('an upstream failure falls back to a modelled sky, and says so', async () => {
  const service = makeService();
  const island = getIsland(300);
  const errors = [];
  service.addEventListener('error', (event) => errors.push(event.detail.error));

  failNext = true;
  try {
    await service.ensure([island]);
  } finally {
    failNext = false;
  }

  assert.equal(errors.length, 1, 'a failure must be announced, not swallowed');

  const record = service.get(island);
  assert.equal(record.source, 'modelled');
  assert.ok(Number.isFinite(record.temperature));
  assert.equal(service.isFresh(island.number), false);
});

test('an update event names exactly the islands that changed', async () => {
  const service = makeService();
  const islands = [getIsland(200), getIsland(201), getIsland(202)];
  const updates = [];
  service.addEventListener('update', (event) => updates.push(event.detail.islands));

  await service.ensure(islands);

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].slice().sort((a, b) => a - b), [200, 201, 202]);
});
