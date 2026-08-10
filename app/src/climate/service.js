/**
 * The live feed.
 *
 * Every island in this atlas is anchored to a real coordinate, and this is
 * where the real weather at that coordinate arrives. Data comes from
 * Open-Meteo (open data, no key, CC-BY-4.0) — the forecast API for the
 * atmosphere, the marine API for the sea state.
 *
 * Three rules govern this module:
 *
 *   1. Never block the art. A frame is never delayed waiting on a network.
 *   2. Never lie. Every record carries its provenance and its age; when the
 *      feed is unreachable the atlas says "modelled", out loud.
 *   3. Never hammer the source. Requests are batched, cached, deduplicated and
 *      revalidated in the background, and a same-origin proxy is preferred so
 *      that many visitors cost the upstream one call.
 */

import { simulateClimate } from './simulate.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'rain',
  'snowfall',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];

const MARINE_FIELDS = ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature'];

/** How many coordinates ride in one upstream request. */
const BATCH_SIZE = 50;
/** A record older than this is refetched when something asks for it. */
const DEFAULT_TTL = 12 * 60 * 1000;
/** Beyond this a cached record is not even worth showing while revalidating. */
const STALE_LIMIT = 6 * 60 * 60 * 1000;

const STORAGE_KEY = '404islands.climate.v1';

const clampNum = (v, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const orNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Normalize one Open-Meteo location response into the atlas's own record
 * shape. Open-Meteo returns nulls for fields a grid cell cannot supply, so
 * every read is defensive.
 */
function normalize(island, weather, marine, now) {
  const c = (weather && weather.current) || {};
  const m = (marine && marine.current) || {};
  const observed = c.time ? Date.parse(`${c.time}Z`) : now;

  return {
    islandNumber: island.number,
    lat: island.lat,
    lon: island.lon,
    source: 'observed',
    observedAt: Number.isFinite(observed) ? observed : now,
    fetchedAt: now,
    temperature: clampNum(c.temperature_2m, 15),
    apparentTemperature: clampNum(c.apparent_temperature, clampNum(c.temperature_2m, 15)),
    humidity: clampNum(c.relative_humidity_2m, 70),
    precipitation: clampNum(c.precipitation, 0),
    rain: clampNum(c.rain, 0),
    snowfall: clampNum(c.snowfall, 0),
    weatherCode: clampNum(c.weather_code, 0),
    cloudCover: clampNum(c.cloud_cover, 0),
    pressure: clampNum(c.pressure_msl, 1013),
    windSpeed: clampNum(c.wind_speed_10m, 8),
    windDirection: clampNum(c.wind_direction_10m, 90),
    windGusts: clampNum(c.wind_gusts_10m, clampNum(c.wind_speed_10m, 8) * 1.3),
    isDay: c.is_day === undefined ? null : Boolean(c.is_day),
    seaSurfaceTemperature: orNull(m.sea_surface_temperature),
    waveHeight: orNull(m.wave_height),
    wavePeriod: orNull(m.wave_period),
    waveDirection: orNull(m.wave_direction),
    elevation: orNull(weather && weather.elevation),
  };
}

/**
 * Open-Meteo returns a bare object for a single coordinate and an array for
 * several. Normalise that away.
 */
function asList(payload, expected) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') return expected === 1 ? [payload] : [payload];
  return [];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export class ClimateService extends EventTarget {
  /**
   * @param {object} [options]
   * @param {string|null} [options.proxy] Same-origin endpoint that mirrors the
   *   Open-Meteo response shape. Tried first; on any failure the service falls
   *   back to calling Open-Meteo directly, so a purely static deployment works.
   * @param {number} [options.ttl] Milliseconds before a record is refetched.
   * @param {boolean} [options.marine] Request sea state as well as weather.
   */
  constructor(options = {}) {
    super();
    this.proxy = options.proxy === undefined ? '/api/climate' : options.proxy;
    this.ttl = options.ttl || DEFAULT_TTL;
    this.wantMarine = options.marine !== false;

    /** @type {Map<number, object>} */
    this.records = new Map();
    /** @type {Map<number, Promise<object>>} */
    this.inflight = new Map();
    this.proxyAvailable = this.proxy ? null : false; // null = untried
    this.online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    this.lastError = null;
    this.persistTimer = null;

    this.#restore();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online = true;
        this.dispatchEvent(new CustomEvent('connectivity', { detail: { online: true } }));
      });
      window.addEventListener('offline', () => {
        this.online = false;
        this.dispatchEvent(new CustomEvent('connectivity', { detail: { online: false } }));
      });
    }
  }

  // ── Reading ────────────────────────────────────────────────────────────

  /** The best record currently held for an island, modelled if nothing else. */
  get(island) {
    const rec = this.records.get(island.number);
    if (rec && Date.now() - rec.observedAt < STALE_LIMIT) return rec;
    return simulateClimate(island);
  }

  /** True when a stored record exists and is fresh enough not to refetch. */
  isFresh(number) {
    const rec = this.records.get(number);
    return Boolean(rec && rec.source === 'observed' && Date.now() - rec.fetchedAt < this.ttl);
  }

  /** Age of the held record in milliseconds, or Infinity. */
  ageOf(number) {
    const rec = this.records.get(number);
    return rec ? Date.now() - rec.observedAt : Infinity;
  }

  // ── Fetching ───────────────────────────────────────────────────────────

  /**
   * Make sure the given islands have fresh observations. Resolves once the
   * network work is done; callers that only want to paint should not await it.
   */
  async ensure(islands) {
    const needed = islands.filter((i) => !this.isFresh(i.number) && !this.inflight.has(i.number));
    if (!needed.length) return;
    if (!this.online) {
      this.dispatchEvent(new CustomEvent('update', { detail: { islands: [], offline: true } }));
      return;
    }

    const batches = chunk(needed, BATCH_SIZE);
    const promise = Promise.all(batches.map((b) => this.#fetchBatch(b)));
    for (const island of needed) {
      this.inflight.set(island.number, promise);
    }

    try {
      await promise;
    } finally {
      for (const island of needed) this.inflight.delete(island.number);
    }
  }

  async #fetchBatch(islands) {
    const lats = islands.map((i) => i.lat.toFixed(4)).join(',');
    const lons = islands.map((i) => i.lon.toFixed(4)).join(',');

    const weatherParams = new URLSearchParams({
      latitude: lats,
      longitude: lons,
      current: CURRENT_FIELDS.join(','),
      timezone: 'UTC',
      wind_speed_unit: 'kmh',
      forecast_days: '1',
    });

    const marineParams = new URLSearchParams({
      latitude: lats,
      longitude: lons,
      current: MARINE_FIELDS.join(','),
      timezone: 'UTC',
      forecast_days: '1',
    });

    try {
      const [weather, marine] = await Promise.all([
        this.#request('forecast', FORECAST_URL, weatherParams),
        this.wantMarine
          ? this.#request('marine', MARINE_URL, marineParams).catch(() => null)
          : Promise.resolve(null),
      ]);

      const wList = asList(weather, islands.length);
      const mList = marine ? asList(marine, islands.length) : [];
      const now = Date.now();
      const updated = [];

      islands.forEach((island, idx) => {
        const w = wList[idx];
        if (!w) return;
        const rec = normalize(island, w, mList[idx], now);
        this.records.set(island.number, rec);
        updated.push(island.number);
      });

      this.lastError = null;
      this.#schedulePersist();
      this.dispatchEvent(
        new CustomEvent('update', { detail: { islands: updated, offline: false } })
      );
      return updated;
    } catch (err) {
      this.lastError = err;
      this.dispatchEvent(new CustomEvent('error', { detail: { error: err } }));
      return [];
    }
  }

  /**
   * One upstream call. Prefers the same-origin proxy — it caches across all
   * visitors and sidesteps both CORS and per-client rate limits — and remembers
   * if the proxy is absent so a static deployment only pays that cost once.
   */
  async #request(kind, directUrl, params) {
    if (this.proxy && this.proxyAvailable !== false) {
      try {
        const url = `${this.proxy}/${kind}?${params.toString()}`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (res.ok) {
          this.proxyAvailable = true;
          return await res.json();
        }
        // A 4xx from our own proxy means it is there but unhappy; only a
        // missing proxy should demote us to direct calls.
        if (res.status === 404 || res.status === 501) this.proxyAvailable = false;
        else throw new Error(`proxy ${kind}: ${res.status}`);
      } catch (err) {
        if (this.proxyAvailable === null) this.proxyAvailable = false;
        else throw err;
      }
    }

    const res = await fetch(`${directUrl}?${params.toString()}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`open-meteo ${kind}: ${res.status}`);
    return res.json();
  }

  // ── Persistence ────────────────────────────────────────────────────────

  #restore() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const cutoff = Date.now() - STALE_LIMIT;
      for (const rec of parsed.records || []) {
        if (rec && rec.observedAt > cutoff) this.records.set(rec.islandNumber, rec);
      }
    } catch {
      // A corrupt cache is not worth a broken page.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage disabled entirely */
      }
    }
  }

  #schedulePersist() {
    if (typeof localStorage === 'undefined' || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ v: 1, records: [...this.records.values()] })
        );
      } catch {
        /* quota or private mode; the in-memory cache still works */
      }
    }, 2000);
  }

  /** Drop everything held, in memory and on disk. */
  clear() {
    this.records.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to do */
    }
  }
}
