/**
 * The ground, presented.
 *
 * Two sections on the island page. The first is what the island is doing right
 * now as a landform — four competing rates in millimetres per year, one of
 * which is driven by the rainfall actually falling on it. The second is the
 * column beneath it, all the way down, with the pressure and temperature at
 * every boundary a person has heard of.
 *
 * Both are stated in units geologists actually use, and both name their
 * assumptions where they have any.
 */

import { h } from './dom.js';
import * as fmt from './format.js';
import { crossSection, BOUNDARIES } from '../core/interior.js';
import { islandHistory, impliedPressureGradient } from '../core/geology.js';
import { islandPhysics } from '../core/geodesy.js';

/** Relief in metres, from the island's terrain height. */
export function reliefOf(island) {
  return Math.round(island.terrain.height * 900);
}

/** Approximate basal radius in metres, from the coast parameter. */
export function radiusOf(island) {
  return Math.round(island.terrain.coast * 12000);
}

function rateRow(label, mmPerYear, note, positive) {
  const magnitude = Math.abs(mmPerYear);
  // A log-ish bar: these rates span three orders of magnitude.
  const width = Math.max(1, Math.min(100, (Math.log10(magnitude * 1000 + 1) / 4) * 100));

  return h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: '9rem 1fr 7rem', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0' } },
    h('span', { class: 'label', style: { color: 'var(--fg-dim)' } }, label),
    h(
      'div',
      { style: { height: '3px', background: 'var(--hair)', position: 'relative' } },
      h('div', {
        style: {
          position: 'absolute',
          inset: '0 auto 0 0',
          width: `${width}%`,
          background: positive ? 'var(--live)' : 'var(--alert)',
        },
      })
    ),
    h(
      'span',
      { class: 'mono', style: { fontSize: '0.78rem', textAlign: 'right' } },
      `${positive ? '+' : '−'}${magnitude < 0.01 ? magnitude.toFixed(4) : magnitude.toFixed(3)}`,
      h('span', { class: 'faint' }, ' mm/yr')
    ),
    note ? h('span.faint', { style: { gridColumn: '1 / -1', fontSize: '0.7rem', marginTop: '-0.35rem' } }, note) : null
  );
}

/**
 * How the island is being built and unbuilt — the answer to "how do mountains
 * form", in this island's own numbers.
 */
export function processPanel(island, readings) {
  const relief = reliefOf(island);
  // Annual rainfall inferred from the current rate. Stated as such: an hour of
  // rain is not a climatology, and the panel does not pretend otherwise.
  const precipitationMmYr = Math.max(120, (readings.precipitation || 0) * 24 * 365 * 0.08 + 900);
  const seaTemperatureC = readings.seaSurfaceTemperature ?? readings.temperature;

  const history = islandHistory(island, { precipitationMmYr, seaTemperatureC, reliefMetres: relief });
  const r = history.ratesMmYr;

  return h(
    'section',
    { style: { marginTop: '2.5rem' } },
    h('div.label', 'How this island is being made'),

    h(
      'div',
      { style: { margin: '1rem 0 0.5rem' } },
      h('div', { class: 'serif', style: { fontSize: '1.25rem' } }, history.stage.name),
      h('p', { class: 'dim', style: { fontSize: '0.88rem', marginTop: '0.4rem' } }, history.stage.detail)
    ),

    h(
      'div',
      { style: { margin: '1.2rem 0', borderTop: '1px solid var(--hair)', borderBottom: '1px solid var(--hair)', padding: '0.5rem 0' } },
      rateRow('Volcanism', r.building, r.building > 0 ? 'still over its magma source' : 'the hotspot has moved on', true),
      rateRow('Subsidence', r.subsidence, 'the plate cooling and sinking beneath it', false),
      rateRow('Erosion', r.erosion, `at about ${Math.round(precipitationMmYr)} mm of rain a year`, false)
    ),

    // The reef is kept out of that sum on purpose: coral grows up to sea level
    // and stops, so it cannot raise a summit. What it can do is hold a ring at
    // the surface while the volcano under it disappears — which is a race, and
    // is shown as one.
    history.reefCapable
      ? h(
          'div',
          { style: { margin: '1.2rem 0' } },
          h('div.label', 'The reef’s race'),
          h('p', { class: 'dim', style: { fontSize: '0.85rem', marginTop: '0.5rem' } }, [
            `Coral is building upward at ${r.reefAccretion.toFixed(2)} mm/yr against `,
            `${r.subsidence.toFixed(3)} mm/yr of sinking — `,
            history.reefWinning
              ? h('strong', `winning by ${history.reefMarginMmYr.toFixed(2)} mm/yr.`)
              : h('strong', 'losing.'),
            history.reefWinning
              ? ' The ring stays at the surface even after the volcano beneath it has gone under. That is how an atoll is made.'
              : ' If that holds, the reef drowns and what is left is a flat-topped seamount.',
          ])
        )
      : h(
          'div',
          { style: { margin: '1.2rem 0' } },
          h('div.label', 'No reef'),
          h('p', { class: 'dim', style: { fontSize: '0.85rem', marginTop: '0.5rem' } },
            'The water here is too cold for coral, so nothing is building upward to ' +
            'replace what erosion and subsidence take. This island has no second act: ' +
            'it wears down and then it is gone.')
        ),

    h(
      'dl.dl',
      h('dt', 'Net'), h('dd', { class: 'mono' },
        `${r.net >= 0 ? '+' : '−'}${Math.abs(r.net).toFixed(4)} mm/yr — the land ${r.net >= 0 ? 'gaining' : 'losing'} height`),
      h('dt', 'Dominant'), h('dd', `${history.dominant.name}, at ${history.dominant.rateMmYr.toFixed(3)} mm/yr`),
      h('dt', 'Age'), h('dd', `${history.ageMyr.toFixed(1)} million years`),
      h('dt', 'Drifted'), h('dd', `${Math.round(history.driftKm)} km from where it was built`),
      h('dt', 'Sunk'), h('dd', `${Math.round(history.subsidenceSinceFormationM)} m since it formed, with the plate`),
      h('dt', 'Seafloor'), h('dd', `${Math.round(history.seafloorDepthM)} m below the surface around it`),
      history.yearsRemaining < 1e9
        ? h('dt', 'Remaining')
        : null,
      history.yearsRemaining < 1e9
        ? h('dd', `${(history.yearsRemaining / 1e6).toFixed(1)} Myr above water at the present rate`)
        : null
    ),

    h('div.notice', { style: { fontSize: '0.78rem' } }, [
      h('strong', 'On these rates. '),
      'Plate cooling follows Parsons & Sclater (1977); denudation is a stream-power ',
      'law calibrated against measured rates on Hawaii and Réunion; reef accretion ',
      'uses the standard warm-water maximum. The island’s age is implied by its form ',
      'rather than measured, and the annual rainfall is extrapolated from the current ',
      'hour — an hour of weather is not a climatology.',
    ])
  );
}

/**
 * The column beneath, from the summit to the centre. Everything here is
 * integrated from PREM rather than tabulated.
 */
export function interiorPanel(island, readings) {
  const relief = reliefOf(island);
  const physics = islandPhysics(island, {
    relief,
    radius: radiusOf(island),
    pressureHpa: readings.pressure,
    temperatureC: readings.temperature,
  });

  const section = crossSection();
  const gradient = impliedPressureGradient(island.lat, readings.windSpeed / 3.6, physics.air.airDensity);

  return h(
    'section',
    { style: { marginTop: '2.5rem' } },
    h('div.label', 'The column beneath'),

    h('p', { class: 'dim', style: { fontSize: '0.88rem', margin: '0.9rem 0 1.2rem' } }, [
      'Pressure and gravity below are not looked up. They are integrated from the ',
      'PREM density profile by hydrostatic equilibrium — which is why the numbers ',
      'come out at the values seismology measures.',
    ]),

    h(
      'div',
      { style: { display: 'grid', gap: '1px', background: 'var(--hair)', border: '1px solid var(--hair)', borderRadius: 'var(--radius)', overflow: 'hidden' } },
      ...section.map((entry) =>
        h(
          'div',
          { style: { background: 'var(--ink-raised)', padding: '0.55rem 0.8rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'baseline' } },
          h(
            'div',
            h('div', { style: { fontSize: '0.82rem' } }, entry.name),
            h('div.faint', { class: 'mono', style: { fontSize: '0.66rem' } },
              `${entry.depthKm < 1 ? entry.depthKm.toFixed(1) : Math.round(entry.depthKm)} km · ${Math.round(entry.density)} kg/m³ · g ${entry.gravity.toFixed(2)}`)
          ),
          h(
            'div',
            { class: 'mono', style: { textAlign: 'right', fontSize: '0.78rem', whiteSpace: 'nowrap' } },
            entry.pressureGPa < 1
              ? `${(entry.pressurePa / 1e6).toFixed(1)} MPa`
              : `${entry.pressureGPa.toFixed(1)} GPa`,
            h('div.faint', { style: { fontSize: '0.66rem' } }, `${Math.round(entry.temperatureK)} K`)
          )
        )
      )
    ),

    h('div.label', { style: { marginTop: '2rem' } }, 'Here, specifically'),
    h(
      'dl.dl',
      h('dt', 'Gravity'), h('dd', { class: 'mono' },
        `${physics.gravity.toFixed(5)} m/s²`),
      h('dt', 'At the summit'), h('dd',
        `${physics.summitGravity.toFixed(5)} m/s² — an 80 kg person is ${physics.weightLossGrams.toFixed(0)} g lighter up there`),
      h('dt', 'Isostatic root'), h('dd',
        `${Math.round(physics.root.rootMetres)} m of crust below, holding up ${relief} m above (Airy, ×${physics.root.ratio.toFixed(2)})`),
      h('dt', 'Pressure there'), h('dd',
        `${(physics.beneath.totalPa / 1e6).toFixed(0)} MPa — ${Math.round(physics.beneath.atmospheres).toLocaleString('en-GB')} atmospheres`),
      h('dt', 'Edifice'), h('dd',
        `about ${Math.round(physics.edifice.volumeKm3).toLocaleString('en-GB')} km³, ${(physics.edifice.massKg / 1e12).toFixed(1)} billion tonnes (cone estimate)`),
      h('dt', 'To the centre'), h('dd',
        `${Math.round(physics.geocentricRadiusKm).toLocaleString('en-GB')} km straight down`),
      h('dt', 'Coriolis'), h('dd',
        Number.isFinite(physics.inertialPeriodHours)
          ? `f = ${physics.coriolis.toExponential(2)} s⁻¹ — a free-drifting parcel turns a full circle in ${physics.inertialPeriodHours.toFixed(1)} h`
          : 'f = 0 on the equator: nothing here turns, and no cyclone can form'),
      h('dt', 'Air column'), h('dd',
        `${Math.round(physics.air.columnMassKgPerM2).toLocaleString('en-GB')} kg of atmosphere on every square metre; ${physics.air.summitHpa.toFixed(0)} hPa at the summit, ${physics.air.dropHpa.toFixed(0)} hPa less than at the shore`),
      h('dt', 'Water boils'), h('dd',
        `at ${physics.air.boilingPointC.toFixed(1)} °C on the summit, from the pressure measured here now`),
      h('dt', 'Pressure gradient'), h('dd',
        gradient.valid
          ? `${gradient.hPaPer100km.toFixed(1)} hPa per 100 km, inferred from the wind by geostrophic balance`
          : gradient.reason)
    )
  );
}
