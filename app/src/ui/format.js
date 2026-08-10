/**
 * Formatting.
 *
 * Instrument panels live or die on their typography. Numbers here are always
 * rendered with a fixed number of decimals so a column of readings does not
 * jitter as values change, and units are separated from figures so they can be
 * set at a different weight.
 */

const nbsp = ' '; // narrow no-break space

export function num(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

export function temperature(c, decimals = 1) {
  if (c === null || c === undefined) return '—';
  return `${num(c, decimals)}${nbsp}°C`;
}

export function speed(kmh) {
  if (kmh === null || kmh === undefined) return '—';
  return `${num(kmh, 0)}${nbsp}km/h`;
}

export function metres(m, decimals = 2) {
  if (m === null || m === undefined) return '—';
  return `${num(m, decimals)}${nbsp}m`;
}

export function percent(v) {
  if (v === null || v === undefined) return '—';
  return `${num(v, 0)}${nbsp}%`;
}

export function pressure(hPa) {
  if (hPa === null || hPa === undefined) return '—';
  return `${num(hPa, 0)}${nbsp}hPa`;
}

export function degrees(d) {
  if (d === null || d === undefined) return '—';
  return `${num(d, 0)}°`;
}

/** "just now", "4 min ago", "2 h ago" — deliberately coarse. */
export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return 'unknown';
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}${nbsp}min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}${nbsp}h ago`;
  const days = Math.round(hours / 24);
  return `${days}${nbsp}d ago`;
}

/** Local clock at an island's longitude, as HH:MM. */
export function solarClock(lon, date = new Date()) {
  const utcMinutes = ((date.getTime() / 60000) % 1440 + 1440) % 1440;
  const local = ((utcMinutes + lon * 4) % 1440 + 1440) % 1440;
  const hours = Math.floor(local / 60);
  const minutes = Math.floor(local % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Minutes past midnight → HH:MM. */
export function clockFromMinutes(minutes, lon = 0) {
  if (minutes === null || minutes === undefined) return '—';
  const local = ((minutes + lon * 4) % 1440 + 1440) % 1440;
  const h = Math.floor(local / 60);
  const m = Math.floor(local % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function duration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}${nbsp}h ${String(m).padStart(2, '0')}${nbsp}min`;
}

/** Money, in whole units. Prices in this piece are never fractional. */
export function money(amount, currency = 'EUR') {
  const symbols = { EUR: '€', USD: '$', GBP: '£' };
  return `${symbols[currency] || ''}${amount.toLocaleString('en-GB')}`;
}
