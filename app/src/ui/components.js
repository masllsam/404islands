/**
 * Shared pieces of interface.
 *
 * The instrument panel is the second half of the artwork: it is what turns a
 * pretty render into a reading of somewhere real. These components exist so
 * that a temperature is presented identically wherever it appears.
 */

import { h } from './dom.js';
import * as fmt from './format.js';
import { daylight } from '../core/solar.js';

/** Provenance pill: live, modelled, or offline. Never ambiguous. */
export function statusPill(provenance) {
  const { state, label, record } = provenance;
  const age = record?.observedAt ? fmt.relativeTime(record.observedAt) : '';
  const node = h(
    `span.pill.pill--${state}`,
    { title: state === 'live'
        ? 'Observation from Open-Meteo for this island’s coordinate'
        : state === 'modelled'
        ? 'Physically modelled from latitude, season and time of day — not an observation'
        : 'No connection; showing a modelled sky' },
    h('span.pill__dot'),
    h('span', label),
    age ? h('span.faint', `· ${age}`) : null
  );
  return node;
}

/** A compass rose whose needle points where the wind is coming from. */
export function compass(directionDeg, speedKmh) {
  const needle = h(
    'g.compass__needle',
    { style: { transform: `rotate(${directionDeg}deg)` } },
    h('path', {
      d: 'M27 8 L31.5 30 L27 26 L22.5 30 Z',
      fill: 'currentColor',
      opacity: '0.9',
    })
  );

  return h(
    'svg.compass',
    {
      viewBox: '0 0 54 54',
      role: 'img',
      'aria-label': `Wind from ${fmt.degrees(directionDeg)} at ${fmt.speed(speedKmh)}`,
      style: { color: 'var(--brass)' },
    },
    h('circle', { cx: 27, cy: 27, r: 24, fill: 'none', stroke: 'var(--hair)', 'stroke-width': 1 }),
    h('circle', { cx: 27, cy: 27, r: 1.6, fill: 'var(--fg-faint)' }),
    ...[0, 90, 180, 270].map((a) =>
      h('line', {
        x1: 27, y1: 4, x2: 27, y2: 8,
        stroke: 'var(--fg-faint)',
        'stroke-width': 1,
        transform: `rotate(${a} 27 27)`,
      })
    ),
    needle
  );
}

function instrument(label, value, note, extraClass = '') {
  return h(
    `div.instrument${extraClass}`,
    h('span.instrument__label', label),
    h('span.instrument__value', value),
    note ? h('span.instrument__note', note) : null
  );
}

/**
 * The full instrument panel for an island. Everything shown here is either a
 * live measurement or a stated derivation of one.
 */
export function instrumentPanel(island, readings) {
  const light = daylight(island.lat, island.lon);
  const dayLabel = light.midnightSun
    ? 'Midnight sun'
    : light.polarNight
    ? 'Polar night'
    : fmt.duration(light.dayLengthMinutes);

  return h(
    'div.instruments',
    instrument('Air', fmt.temperature(readings.temperature),
      `feels ${fmt.temperature(readings.apparent)}`),
    instrument('Sea', fmt.temperature(readings.seaSurfaceTemperature),
      readings.seaSurfaceTemperature == null ? 'not reported here' : 'surface'),
    instrument('Sky', readings.condition, `${fmt.percent(readings.cloudCover)} cloud`),
    instrument('Wind', fmt.speed(readings.windSpeed),
      `${readings.windFrom} · force ${readings.wind.force}`),
    instrument('Gusting', fmt.speed(readings.windGusts), readings.wind.label),
    instrument('Sea state', readings.sea.label,
      readings.waveHeight != null ? `${fmt.metres(readings.waveHeight, 1)} significant` : 'unreported'),
    instrument('Swell period', readings.wavePeriod != null ? `${fmt.num(readings.wavePeriod, 1)} s` : '—',
      'between crests'),
    instrument('Pressure', fmt.pressure(readings.pressure),
      readings.pressure < 1000 ? 'low' : readings.pressure > 1020 ? 'high' : 'settled'),
    instrument('Humidity', fmt.percent(readings.humidity),
      readings.precipitation > 0 ? `${fmt.num(readings.precipitation, 1)} mm/h falling` : 'dry'),
    instrument('Sun', `${fmt.num(readings.sunElevation, 1)}°`,
      readings.sunElevation > 0 ? `bearing ${fmt.degrees(readings.sunAzimuth)}` : 'below horizon'),
    instrument('Local time', fmt.solarClock(island.lon), 'apparent solar'),
    instrument('Daylight', dayLabel, 'today')
  );
}

/** The card that names whichever island the overture is currently showing. */
export function nowShowing(island, readings) {
  return h(
    'aside.nowshowing',
    h('div.label', 'Now showing'),
    h('div.nowshowing__name', island.name),
    h('div.nowshowing__meta', [
      `No. ${island.id} · ${island.archetype.name}`,
      h('br'),
      island.region.name,
      h('br'),
      island.coordLabel,
    ]),
    h('div.nowshowing__reading', [
      `${fmt.temperature(readings.temperature)} · ${readings.condition}`,
      h('br'),
      `${readings.windFrom} ${fmt.speed(readings.windSpeed)} · ${readings.sea.label} sea`,
    ])
  );
}

/** Exposure meter: how far the current still has converged. */
export function exposureMeter() {
  const fill = h('div.exposure__fill');
  const text = h('span', 'exposing');
  const root = h(
    'div.exposure',
    { title: 'Hold still and the render keeps refining. This is the exposure.' },
    h('div.exposure__track', fill),
    text
  );

  return {
    node: root,
    update(stats) {
      if (!stats) return;
      const ratio = Math.min(1, stats.samples / (stats.maxSamples || 96));
      fill.style.width = `${ratio * 100}%`;
      if (stats.converged) {
        root.classList.add('exposure--done');
        text.textContent = 'settled';
      } else if (stats.samples === 0) {
        root.classList.remove('exposure--done');
        text.textContent = `${stats.fps} fps`;
      } else {
        root.classList.remove('exposure--done');
        text.textContent = 'exposing';
      }
    },
  };
}

/** Masthead, shared by every view. */
export function masthead(app) {
  const nav = h(
    'nav.masthead__nav',
    { 'aria-label': 'Primary' },
    h('a', { href: '#/atlas' }, 'Atlas'),
    h('a', { href: '#/acquire' }, 'Acquire'),
    h('a', { href: '#/about' }, 'The work')
  );

  const pillHost = h('span');

  const root = h(
    'header.masthead',
    h('a.masthead__mark', { href: '#/' }, h('b', '404'), ' Islands'),
    pillHost,
    nav
  );

  const setPill = (provenance) => {
    pillHost.replaceChildren(provenance ? statusPill(provenance) : '');
  };

  const setCurrent = (path) => {
    for (const link of nav.querySelectorAll('a')) {
      const href = link.getAttribute('href').slice(1);
      const active = href === '/' ? path === '/' : path.startsWith(href);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };

  const onScroll = () => {
    root.classList.toggle('masthead--solid', window.scrollY > 24);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return { node: root, setPill, setCurrent };
}

/** Footer. Credits the data source, because the data is half the work. */
export function colophon() {
  return h(
    'footer.colophon',
    h('div', [
      h('h4', 'The atlas'),
      h('p', [
        '404 islands, generated once and fixed forever. Each is anchored to a real ',
        'coordinate in the world ocean and lit by the weather actually happening there.',
      ]),
    ]),
    h('div', [
      h('h4', 'Live data'),
      h('p', [
        'Atmospheric and marine observations from ',
        h('a', { href: 'https://open-meteo.com', rel: 'noopener noreferrer', target: '_blank' }, 'Open-Meteo'),
        ', licensed CC BY 4.0. Solar geometry computed locally from the NOAA equations.',
      ]),
    ]),
    h('div', [
      h('h4', 'Elsewhere'),
      h('p', [
        h('a', { href: '#/about' }, 'How it is made'), h('br'),
        h('a', { href: '#/acquire' }, 'Acquisition'), h('br'),
        h('a', { href: '#/atlas' }, 'Browse all 404'),
      ]),
    ])
  );
}
