/**
 * The work.
 *
 * A colophon in long form. If someone is going to buy a piece of this, they
 * are entitled to know exactly how it is made, what is real, what is modelled,
 * and where the seams are.
 */

import { h, clear } from '../dom.js';
import { colophon } from '../components.js';
import { ISLAND_COUNT } from '../../core/catalog.js';
import { REGIONS } from '../../core/geo.js';
import { ARCHETYPES } from '../../core/archetypes.js';

export function about(app) {
  return (context, outlet) => {
    clear(outlet);
    app.stage.detach();
    window.scrollTo(0, 0);

    outlet.appendChild(
      h(
        'div',
        { style: { paddingTop: '4.6rem' } },

        h(
          'section.section',
          h('div.label.section__label', 'The work'),
          h('h1', { style: { maxWidth: '20ch' } }, 'Half of this is arithmetic. Half of it is the weather.'),
          h('p.lede', { style: { marginTop: '2rem' } }, [
            'Every landmass here is a mathematical object: fractal noise, domain-warped, ',
            'masked into a coastline and raymarched by a shader on your own graphics ',
            'card. Nothing was modelled by hand and nothing was drawn. Give the same ',
            'seed to any machine and you get the same island, down to the last cove.',
          ]),
          h('p', { class: 'dim' }, [
            'Everything above the waterline that moves, though, is measured. The sun ',
            'is where the sun is. The clouds are the clouds reported over that patch of ',
            'ocean in the last hour. The swell is the swell. The snowline on a fjordland ',
            'island slides up and down its own flank as the temperature at 68° north ',
            'changes through the day. None of that is decoration; it is the subject.',
          ])
        ),

        section('Where the islands are', [
          `The ${ISLAND_COUNT} islands are distributed across ${REGIONS.length} real archipelagic regions, ` +
            'from the Tuamotu shelf to the Greenland Sea, weighted so that the atlas feels the ' +
            'way the ocean does — crowded in the tropics, lonely at the poles.',
          'Each island holds a specific latitude and longitude inside its region. That ' +
            'coordinate is what the climate feed is queried with, which is why islands ' +
            'near each other share weather, and islands on opposite sides of the world ' +
            'are never in daylight together.',
        ]),

        section('Seven forms of land', [
          'Terrain is not one formula with the knobs turned. Each island belongs to one of ' +
            `${ARCHETYPES.length} archetypes, and each archetype answers the question ` +
            '"where does the island stop" differently: a ring of reef around a lagoon, a ' +
            'table of limestone cut off clean, a scatter of lobes on a shared shelf, a mass ' +
            'that ice went through and left open.',
        ]),

        h(
          'section.section',
          h('div.label.section__label', 'The forms'),
          h(
            'div',
            { style: { display: 'grid', gap: '1px', background: 'var(--hair)', border: '1px solid var(--hair)', borderRadius: 'var(--radius)', overflow: 'hidden' } },
            ...ARCHETYPES.map((a) =>
              h(
                'div',
                { style: { background: 'var(--ink)', padding: '1.4rem 1.6rem', display: 'grid', gridTemplateColumns: 'minmax(120px, 160px) 1fr', gap: '1.5rem', alignItems: 'baseline' } },
                h('div', h('h3', { style: { fontSize: '1.15rem' } }, a.name),
                  h('div.faint', { style: { fontSize: '0.72rem', marginTop: '0.3rem' } },
                    `${app.islands.filter((i) => i.archetype.id === a.id).length} in the atlas`)),
                h('div', h('p', { class: 'dim', style: { fontSize: '0.9rem', margin: 0 } }, a.detail))
              )
            )
          )
        ),

        section('Exposure', [
          'While you move the camera, the renderer draws fast and rough — fewer marching ' +
            'steps, a reduced resolution, whatever the device can hold at sixty frames a ' +
            'second. The moment you stop, the simulation clock freezes and the renderer ' +
            'begins stacking jittered samples of the identical instant into one frame.',
          'This is an exposure in the photographic sense, and it behaves like one: noise ' +
            'anneals away, edges resolve, shadow detail arrives. Ninety-six samples later ' +
            'the image is clean enough to print at size. That is what the download button ' +
            'gives you — not a screenshot, but the long exposure, re-rendered at 2400 × 1500.',
        ]),

        section('Honesty about the data', [
          'Weather and sea state come from Open-Meteo, an open API licensed CC BY 4.0. ' +
            'Requests are batched fifty coordinates at a time, cached for ten minutes on ' +
            'the server, and served stale while they revalidate, so a thousand visitors ' +
            'looking at the same island cost the source one call.',
          'When the feed cannot be reached, the atlas does not freeze and it does not lie. ' +
            'It falls back to a physical model — seasonal temperature by latitude, trade ' +
            'winds and westerlies, convection over the ITCZ, fully-developed sea from wind ' +
            'speed — and the status pill in the masthead turns amber and says "modelled" ' +
            'until real observations return.',
          'Solar position is never fetched. It is computed locally from the NOAA equations ' +
            'and is accurate to about a tenth of a degree, which is far finer than a ' +
            'horizon line can show.',
        ]),

        section('Performance, as a design constraint', [
          'A piece that stutters is not beautiful, so the renderer measures its own frame ' +
            'time and spends what it has: render scale first, then shader tier. On a phone ' +
            'it renders at reduced resolution and still settles into a clean still. On a ' +
            'workstation it never leaves full resolution.',
          'The whole application is about 120 KB of JavaScript with no dependencies, no ' +
            'build step and no framework. The catalogue of 404 islands is computed in the ' +
            'browser in under ten milliseconds. Nothing is downloaded that could be derived.',
        ]),

        section('Licence', [
          'The generator, the shaders and this interface are MIT licensed. Exposures you ' +
            'export are yours with no conditions. Climate data is © Open-Meteo contributors, ' +
            'CC BY 4.0.',
        ]),

        colophon()
      )
    );

    return () => {};
  };
}

function section(title, paragraphs) {
  return h(
    'section.section.section--split',
    h('div', h('div.label.section__label', 'On'), h('h2', title)),
    h('div', ...paragraphs.map((text, i) => h('p', { class: i === 0 ? 'lede' : 'dim' }, text)))
  );
}
