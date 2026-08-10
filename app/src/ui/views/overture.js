/**
 * The overture.
 *
 * One island, full bleed, drifting slowly under its own real sky, with the
 * fewest possible words in front of it. The featured island changes with the
 * hour so that a return visit is not the same visit — and because the point of
 * the piece is that none of this is a still image.
 */

import { h, clear, disposable, prefersReducedMotion } from '../dom.js';
import { colophon, nowShowing } from '../components.js';
import * as fmt from '../format.js';
import { ISLAND_COUNT } from '../../core/catalog.js';
import { REGIONS } from '../../core/geo.js';

/**
 * Which island leads the page right now. Deterministic from the hour, so
 * everyone in the world sees the same one at the same time — which makes it a
 * shared object rather than a personalised feed.
 */
function featuredIsland(islands, date = new Date()) {
  const hoursSinceEpoch = Math.floor(date.getTime() / 3600000);
  // A large step keeps consecutive hours far apart in the catalogue.
  return islands[(hoursSinceEpoch * 137) % islands.length];
}

export function overture(app) {
  return (context, outlet) => {
    const dispose = disposable();
    clear(outlet);

    const island = featuredIsland(app.islands);
    const stageHost = h('div.stage.overture__stage');

    const readings = app.readingsFor(island);
    let showing = nowShowing(island, readings);

    const hero = h(
      'section',
      { style: { position: 'relative' } },
      stageHost,
      h('div.stage__scrim'),
      showing,
      h(
        'div.overture__title.fade-in',
        h('h1', h('span', 'A living atlas of the ocean'), '404 Islands'),
        h('p.overture__lede', [
          'Four hundred and four islands that do not exist, anchored to four hundred ',
          'and four coordinates that do. Each one is lit, weathered and worn by the ',
          'conditions actually reported at that spot, this hour.',
        ]),
        h(
          'div.overture__actions',
          h('a.button.button--primary', { href: '#/atlas' }, 'Enter the atlas'),
          h('a.button', { href: `#/island/${island.number}` }, `Visit ${island.name}`)
        )
      )
    );

    outlet.appendChild(hero);
    outlet.appendChild(manifesto(app));
    outlet.appendChild(howItWorks());
    outlet.appendChild(colophon());

    app.stage.show(island, app.sceneFor(island));
    app.stage.attach(stageHost, { autoOrbit: !prefersReducedMotion() });
    app.refresh([island]);

    const onClimate = () => {
      app.stage.updateScene(app.sceneFor(island));
      const next = nowShowing(island, app.readingsFor(island));
      showing.replaceWith(next);
      showing = next;
    };
    app.addEventListener('climate', onClimate);
    dispose(() => app.removeEventListener('climate', onClimate));

    dispose(() => app.stage.detach());
    return dispose.dispose;
  };
}

function manifesto(app) {
  const oceans = new Set(app.islands.map((i) => i.ocean));
  const archetypes = new Set(app.islands.map((i) => i.archetype.id));

  return h(
    'section.section.section--split',
    h(
      'div',
      h('div.label.section__label', 'The work'),
      h('h2', 'Nothing here is a photograph, and nothing here is invented.')
    ),
    h(
      'div',
      h('p.lede', [
        'The land is mathematics — fractal noise, folded and eroded by a shader ',
        'that runs entirely on your machine. The sky is not. Every cloud, every ',
        'wave height, every degree of temperature and every angle of sunlight is ',
        'taken from live meteorological data for the exact coordinate the island ',
        'sits on.',
      ]),
      h('p', { class: 'dim' }, [
        'Which means an island in the Greenland Sea is dark for months, and you ',
        'will find it dark. An island on the Tuamotu shelf is warm and lit at a ',
        'low angle at six in the morning, and you will find it that way, at six ',
        'in the morning, its time. Stand still and the render keeps refining ',
        'until it is clean enough to print.',
      ]),
      h(
        'div.facts',
        fact(String(ISLAND_COUNT), 'islands, fixed forever'),
        fact(String(REGIONS.length), 'real archipelagic regions'),
        fact(String(archetypes.size), 'forms of land'),
        fact(String(oceans.size), 'oceans')
      )
    )
  );
}

function fact(value, label) {
  return h('div.fact', h('span.fact__value', value), h('span.fact__label', label));
}

function howItWorks() {
  const steps = [
    [
      'Generated once',
      'Each island is derived from a single 32-bit seed. The same seed produces ' +
        'the same coastline on every device, forever. There is no server holding ' +
        'the shapes — your browser recomputes them from first principles in under ' +
        'ten milliseconds.',
    ],
    [
      'Lit by the real sky',
      'Sun position comes from the NOAA solar equations for the island’s latitude ' +
        'and longitude at the current instant. Weather and sea state come from ' +
        'Open-Meteo, refreshed every few minutes and cached so the source is never ' +
        'hammered.',
    ],
    [
      'Refined while you look',
      'Moving the camera renders fast and rough. Letting go freezes the clock and ' +
        'stacks up to ninety-six jittered samples into one frame — an exposure, in ' +
        'the photographic sense. What you can then download is that exposure.',
    ],
  ];

  return h(
    'section.section',
    h('div.label.section__label', 'How it is made'),
    h(
      'div',
      { style: { display: 'grid', gap: '1px', background: 'var(--hair)', border: '1px solid var(--hair)', borderRadius: 'var(--radius)', overflow: 'hidden', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' } },
      ...steps.map(([title, body], index) =>
        h(
          'div',
          { style: { background: 'var(--ink)', padding: '2rem 1.6rem' } },
          h('div.label', fmt.num(index + 1, 0).padStart(2, '0')),
          h('h3', { style: { margin: '0.8rem 0 0.9rem' } }, title),
          h('p', { class: 'dim', style: { fontSize: '0.9rem', margin: 0 } }, body)
        )
      )
    )
  );
}
