/**
 * The tide.
 *
 * This is an equilibrium model, so the honest thing to test is what it claims
 * to get right — the rhythm — rather than what it openly does not: the local
 * range. So: two highs per lunar day, springs at syzygy and neaps at the
 * quarters, high water tracking the moon's transit, and the fortnightly beat
 * between them.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  equilibriumTide,
  tideState,
  nextTurns,
  tidalRange,
} from '../app/src/core/tide.js';
import { moonPosition } from '../app/src/core/lunar.js';

const HOUR = 3600000;
/** A lunar day: the moon's transit-to-transit interval. */
const LUNAR_DAY_HOURS = 24.8412;

function series(lat, lon, startIso, hours, stepMinutes = 6) {
  const start = Date.parse(startIso);
  const out = [];
  for (let m = 0; m <= hours * 60; m += stepMinutes) {
    out.push({ t: start + m * 60000, h: equilibriumTide(lat, lon, start + m * 60000) });
  }
  return out;
}

function countPeaks(samples) {
  let highs = 0;
  let lows = 0;
  for (let i = 1; i < samples.length - 1; i++) {
    const [a, b, c] = [samples[i - 1].h, samples[i].h, samples[i + 1].h];
    if (b > a && b >= c) highs++;
    if (b < a && b <= c) lows++;
  }
  return { highs, lows };
}

test('there are two high waters and two low waters in a lunar day', () => {
  for (const [lat, lon] of [[51.5, -0.1], [-17.5, -149.5], [35.0, 139.0], [-33.9, 18.4]]) {
    const samples = series(lat, lon, '2024-06-22T00:00:00Z', LUNAR_DAY_HOURS);
    const { highs, lows } = countPeaks(samples);
    assert.equal(highs, 2, `${lat},${lon}: ${highs} high waters in a lunar day`);
    assert.equal(lows, 2, `${lat},${lon}: ${lows} low waters in a lunar day`);
  }
});

test('the tidal period is the semidiurnal one, near 12 h 25 min', () => {
  const lat = 20;
  const lon = 0;
  const samples = series(lat, lon, '2024-06-22T00:00:00Z', 72, 3);

  const peaks = [];
  for (let i = 1; i < samples.length - 1; i++) {
    if (samples[i].h > samples[i - 1].h && samples[i].h >= samples[i + 1].h) {
      peaks.push(samples[i].t);
    }
  }
  assert.ok(peaks.length >= 4, `expected several high waters, found ${peaks.length}`);

  const intervals = peaks.slice(1).map((t, i) => (t - peaks[i]) / HOUR);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  assert.ok(
    Math.abs(mean - 12.42) < 0.6,
    `mean interval between high waters was ${mean.toFixed(2)} h, expected ~12.42`
  );
});

test('high water follows the moon, above the horizon or below it', () => {
  // The equilibrium bulge sits under the moon and directly opposite it, so a
  // high water should coincide with the moon near transit — either its upper
  // transit overhead or its lower transit underfoot.
  const lat = 10;
  const lon = 0;
  const samples = series(lat, lon, '2024-06-22T00:00:00Z', 26, 3);

  for (let i = 1; i < samples.length - 1; i++) {
    if (samples[i].h > samples[i - 1].h && samples[i].h >= samples[i + 1].h) {
      const { hourAngle } = moonPosition(lat, lon, new Date(samples[i].t));
      // Hour angle near 0 (overhead) or near 180 (underfoot).
      const fromTransit = Math.min(
        Math.abs(hourAngle),
        Math.abs(hourAngle - 180),
        Math.abs(hourAngle - 360)
      );
      assert.ok(
        fromTransit < 35,
        `high water ${fromTransit.toFixed(0)}° from a lunar transit`
      );
    }
  }
});

test('spring tides fall at new and full moon, neaps at the quarters', () => {
  const lat = 15;
  const lon = 0;
  const rangeOn = (iso) => tidalRange(lat, lon, new Date(iso)).span;

  // June 2024: new moon on the 6th, first quarter the 14th, full on the 22nd,
  // last quarter the 28th.
  const springNew = rangeOn('2024-06-06T12:38:00Z');
  const neapFirst = rangeOn('2024-06-14T05:18:00Z');
  const springFull = rangeOn('2024-06-22T01:08:00Z');
  const neapLast = rangeOn('2024-06-28T21:53:00Z');

  assert.ok(
    springNew > neapFirst * 1.5,
    `new-moon springs ${springNew.toFixed(2)} m vs neaps ${neapFirst.toFixed(2)} m`
  );
  assert.ok(
    springFull > neapLast * 1.5,
    `full-moon springs ${springFull.toFixed(2)} m vs neaps ${neapLast.toFixed(2)} m`
  );
});

test('the range stays within what equilibrium theory actually predicts', () => {
  // Roughly ±0.55 m normally, and never beyond about ±0.9 m even at the
  // largest perigean springs. Anything outside that is a bug, not a tide.
  const start = Date.parse('2024-01-01T00:00:00Z');
  let extreme = 0;

  for (const [lat, lon] of [[0, 0], [45, 90], [-45, -90], [70, 20], [-70, 160]]) {
    for (let h = 0; h < 400; h += 1) {
      const value = equilibriumTide(lat, lon, start + h * HOUR);
      extreme = Math.max(extreme, Math.abs(value));
      assert.ok(Number.isFinite(value), `non-finite tide at ${lat},${lon}`);
    }
  }
  assert.ok(extreme < 0.95, `extreme tide ${extreme.toFixed(2)} m is too large`);
  assert.ok(extreme > 0.5, `extreme tide ${extreme.toFixed(2)} m is implausibly small`);
});

test('the state reports flooding and ebbing consistently with the height', () => {
  const lat = -17.5;
  const lon = -149.5;
  const start = Date.parse('2024-06-22T00:00:00Z');

  for (let m = 0; m < 24 * 60; m += 20) {
    const t = start + m * 60000;
    const state = tideState(lat, lon, t);
    const later = equilibriumTide(lat, lon, t + 15 * 60000);

    assert.equal(state.source, 'equilibrium', 'the tide must always declare itself modelled');
    assert.ok(Number.isFinite(state.height) && Number.isFinite(state.rate));

    if (!state.slack) {
      // Rising water must actually be higher a quarter of an hour on.
      if (state.flooding) {
        assert.ok(later > state.height, `said flooding at ${new Date(t).toISOString()} but fell`);
      } else {
        assert.ok(later < state.height, `said ebbing at ${new Date(t).toISOString()} but rose`);
      }
    }
    assert.match(state.phase, /Flooding|Ebbing|Slack|Standing/);
  }
});

test('the next turns are found, ordered, and inside the window', () => {
  const lat = 35;
  const lon = 139;
  const now = Date.parse('2024-06-22T03:00:00Z');
  const { high, low } = nextTurns(lat, lon, now);

  assert.ok(high, 'no next high water found');
  assert.ok(low, 'no next low water found');
  for (const turn of [high, low]) {
    assert.ok(turn.at > now, 'a turn was reported in the past');
    assert.ok(turn.at - now < 15 * HOUR, 'a turn was reported outside the search window');
  }

  // A high water really should be higher than the low water either side of it.
  assert.ok(high.height > low.height, 'high water was not above low water');
});

test('the normalized range is a usable 0..1 for the renderer', () => {
  const start = Date.parse('2024-06-22T00:00:00Z');
  for (let h = 0; h < 26; h++) {
    const { normalized, span, min, max } = tidalRange(20, 30, start + h * HOUR);
    assert.ok(normalized >= 0 && normalized <= 1, `normalized ${normalized} out of range`);
    assert.ok(span >= 0 && max >= min);
  }
});

test('slack water is labelled by which turn has just happened', () => {
  // Real output caught this inverted: a spring high of +0.84 m was being
  // reported as "Slack, near low". Water that has stopped rising is at high
  // water; water that has stopped falling is at low.
  //
  // The check is against the local extremum rather than the day's midpoint,
  // because diurnal inequality means the higher of a day's two low waters can
  // genuinely sit above the midpoint — the first draft of this test asserted
  // otherwise and was wrong about the ocean, not about the code.
  const lat = -13.7;
  const lon = 168.5;
  const start = Date.parse('2024-06-22T00:00:00Z');
  const window = 40 * 60000;
  let checked = 0;

  for (let m = 0; m < 26 * 60; m += 5) {
    const t = start + m * 60000;
    const state = tideState(lat, lon, t);
    if (!state.slack) continue;

    const before = equilibriumTide(lat, lon, t - window);
    const after = equilibriumTide(lat, lon, t + window);
    checked++;

    if (state.phase === 'Slack, near high') {
      assert.ok(
        state.height >= before && state.height >= after,
        `called near high at ${state.height.toFixed(3)} m, but it is not a local maximum`
      );
    } else if (state.phase === 'Slack, near low') {
      assert.ok(
        state.height <= before && state.height <= after,
        `called near low at ${state.height.toFixed(3)} m, but it is not a local minimum`
      );
    } else {
      // A stand: stationary water that is not at a turn at all.
      assert.equal(state.phase, 'Standing');
      assert.ok(
        !(state.height >= before && state.height >= after) &&
          !(state.height <= before && state.height <= after),
        'called a stand at what is actually a turn'
      );
    }
  }

  assert.ok(checked > 4, `expected several slack-water samples, saw ${checked}`);
});
