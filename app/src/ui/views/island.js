/**
 * A single island.
 *
 * The stage holds still on the left while the label scrolls on the right — the
 * arrangement a gallery uses, for the same reason. Everything in the label is
 * either fixed by the island's seed or measured at its coordinate in the last
 * few minutes, and the panel says which is which.
 */

import { h, clear, disposable, on } from '../dom.js';
import { instrumentPanel, compass, exposureMeter, colophon } from '../components.js';
import * as fmt from '../format.js';
import { getIsland } from '../../core/catalog.js';
import { haversineKm } from '../../core/geo.js';
import { daylight } from '../../core/solar.js';
import { Router } from '../router.js';
import { notFound } from './notfound.js';
import { processPanel, interiorPanel } from '../geology-panel.js';

/** The three catalogued islands physically nearest this one. */
function neighbours(app, island, limit = 3) {
  return app.islands
    .filter((other) => other.number !== island.number)
    .map((other) => ({
      island: other,
      km: haversineKm(island.lat, island.lon, other.lat, other.lon),
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/**
 * Full-bleed, chrome-free: one island, its name, and the time where it is.
 * Meant to be left running on a wall.
 */
function mountBare(app, island, dispose, outlet) {
  document.body.classList.add('bare');
  dispose(() => document.body.classList.remove('bare'));

  const stageHost = h('div.stage.bare__stage');
  const caption = h('div.bare__caption');

  const paint = () => {
    const readings = app.readingsFor(island);
    caption.replaceChildren(
      h('div.bare__name', island.name),
      h('div.bare__meta', [
        `No. ${island.id} · ${island.coordLabel}`,
        h('br'),
        `${fmt.solarClock(island.lon)} local · ${fmt.temperature(readings.temperature)} · ${readings.condition}`,
        h('br'),
        `${readings.windFrom} ${fmt.speed(readings.windSpeed)} · ${readings.sea.label} sea`,
      ])
    );
    app.stage.updateScene(app.sceneFor(island));
  };

  outlet.appendChild(h('div.bare', stageHost, caption));

  app.stage.show(island, app.sceneFor(island));
  app.stage.attach(stageHost);
  app.refresh([island]);
  paint();

  const onClimate = () => paint();
  app.addEventListener('climate', onClimate);
  app.addEventListener('tick', onClimate);
  const poll = setInterval(() => app.refresh([island]), 5 * 60 * 1000);

  dispose(() => {
    app.removeEventListener('climate', onClimate);
    app.removeEventListener('tick', onClimate);
    clearInterval(poll);
    app.stage.detach();
  });

  return dispose.dispose;
}

export function islandView(app) {
  return (context, outlet) => {
    const dispose = disposable();
    const island = getIsland(Number(context.params[0]));

    // Render not-found in place rather than redirecting. A redirect would
    // race the router's own teardown, throw away the URL the visitor typed,
    // and lose the number that lets the page say which island does not exist.
    if (!island) {
      return notFound(app)(context, outlet);
    }

    clear(outlet);
    window.scrollTo(0, 0);

    // The bare view: the island and nothing else. This is what the Guardian
    // tier promises, so it has to actually exist.
    if (context.query.get('bare') === '1') {
      return mountBare(app, island, dispose, outlet);
    }

    const stageHost = h('div.stage.island__stage');
    const meter = exposureMeter();

    const stageWrap = h(
      'div.island__frame',
      stageHost,
      h('div.stage__hint', meter.node, h('span', 'drag to orbit · scroll to zoom'))
    );

    const panel = h('div.island__panel');
    outlet.appendChild(h('div.island', stageWrap, panel));
    outlet.appendChild(colophon());

    // ── Panel ────────────────────────────────────────────────────────────

    const instrumentsHost = h('div');
    const geologyHost = h('div');
    const windHost = h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' },
    });

    const downloadButton = h('button', { type: 'button' }, 'Download this exposure');
    const copyButton = h('button.button--quiet', { type: 'button' }, 'Copy link');

    const light = daylight(island.lat, island.lon);

    // Built as a filtered list rather than passed straight to append(), which
    // stringifies a null child into the literal word "null" — and most islands
    // have no epithet.
    const panelParts = [
      h('div.island__number', `Island No. ${island.id} of 404`),
      h('h1.island__name', island.name),
      island.epithet ? h('div.island__epithet', island.epithet) : null,
      h('div.island__coords', [
        island.coordLabel,
        h('br'),
        `${island.region.name} · ${island.ocean} · ${island.band}`,
      ]),
      h('p.island__blurb', island.archetype.detail),
      h('div.label', { style: { marginTop: '2rem' } }, 'Conditions on site'),
      instrumentsHost,
      windHost,
      h(
        'ul.traits',
        ...island.traits.map((t) => h('li', t.label)),
        h('li', island.archetype.name)
      ),
      h('div.island__actions', downloadButton, copyButton,
        h('a.button.button--quiet', {
          href: `#/island/${island.number}?bare=1`,
          title: 'The island alone, with none of this interface',
        }, 'Full bleed'),
        h('a.button.button--primary', { href: `#/acquire?island=${island.number}` }, 'Acquire this island')),
      h('div.label', 'Fixed properties'),
      h(
        'dl.dl',
        h('dt', 'Seed'), h('dd', { class: 'mono' }, `0x${island.seed.toString(16).padStart(8, '0')}`),
        h('dt', 'Form'), h('dd', `${island.archetype.name} — ${island.archetype.blurb}`),
        h('dt', 'Relief'), h('dd', `${Math.round(island.terrain.height * 900)} m from waterline to summit`),
        h('dt', 'Aspect'), h('dd', island.terrain.anisotropy > 1.35 ? 'Elongate' : 'Compact'),
        h('dt', 'Daylight'), h('dd',
          light.midnightSun ? 'The sun does not set today'
            : light.polarNight ? 'The sun does not rise today'
            : `${fmt.clockFromMinutes(light.sunrise, island.lon)} – ${fmt.clockFromMinutes(light.sunset, island.lon)} local`),
        h('dt', 'Singularity'), h('dd', `${Math.round(island.singularity * 100)} of 100`)
      ),
      h('div.notice', { style: { fontSize: '0.8rem' } }, [
        h('strong', 'On the tide. '),
        'The rhythm is astronomy: high water follows the moon\u2019s transit, springs ',
        'fall at new and full moon, neaps at the quarters. The range is not — this is ',
        'the equilibrium tide, the forcing rather than a local prediction. Real ',
        'ranges run from 0.1 m in the Mediterranean to 16 m in the Bay of Fundy, and ',
        'that depends on how each basin resonates.',
      ]),
      geologyHost,
      h('div.label', { style: { marginTop: '2.5rem' } }, 'Nearest in the atlas'),
      h(
        'div.neighbours',
        ...neighbours(app, island).map(({ island: other, km }) =>
          h(
            'a.neighbour',
            { href: `#/island/${other.number}` },
            h('b', other.name),
            `No. ${other.id} · ${Math.round(km)} km`
          )
        )
      ),
    ];
    panel.append(...panelParts.filter(Boolean));

    // ── Live wiring ──────────────────────────────────────────────────────

    function paint() {
      const readings = app.readingsFor(island);
      instrumentsHost.replaceChildren(instrumentPanel(island, readings));
      geologyHost.replaceChildren(processPanel(island, readings), interiorPanel(island, readings));
      windHost.replaceChildren(
        compass(readings.windDirection, readings.windSpeed),
        h(
          'div',
          h('div.label', 'Wind'),
          h('div', { class: 'mono', style: { fontSize: '0.95rem' } },
            `${readings.windFrom} · ${fmt.speed(readings.windSpeed)}`),
          h('div.faint', { style: { fontSize: '0.76rem' } },
            `${readings.wind.label}, gusting ${fmt.speed(readings.windGusts)}`)
        )
      );
      app.stage.updateScene(app.sceneFor(island));
    }

    app.stage.show(island, app.sceneFor(island));
    app.stage.attach(stageHost);
    app.stage.onStats = (stats) => meter.update(stats);
    app.refresh([island]);
    paint();

    const onClimate = () => paint();
    app.addEventListener('climate', onClimate);
    app.addEventListener('tick', onClimate);
    dispose(() => {
      app.removeEventListener('climate', onClimate);
      app.removeEventListener('tick', onClimate);
    });

    const poll = setInterval(() => app.refresh([island]), 5 * 60 * 1000);
    dispose(() => clearInterval(poll));

    // ── Actions ──────────────────────────────────────────────────────────

    dispose(
      on(downloadButton, 'click', async () => {
        if (!app.stage.supported) {
          app.toast('This browser cannot render an exposure to download.', { bad: true });
          return;
        }
        downloadButton.disabled = true;
        const original = downloadButton.textContent;
        try {
          const blob = await app.stage.renderer.capture({
            width: 2400,
            height: 1500,
            samples: 48,
            onProgress: (p) => {
              downloadButton.textContent = `Exposing ${Math.round(p * 100)}%`;
            },
          });
          if (!blob) throw new Error('capture failed');

          const url = URL.createObjectURL(blob);
          const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
          const link = h('a', {
            href: url,
            download: `404islands-${island.id}-${island.name.replace(/\s+/g, '-').toLowerCase()}-${stamp}.png`,
          });
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          app.toast(`Exposure saved — ${island.name}, as it was at ${stamp.slice(11)} UTC.`);
        } catch (err) {
          app.toast('The exposure could not be completed on this device.', { bad: true });
        } finally {
          downloadButton.disabled = false;
          downloadButton.textContent = original;
        }
      })
    );

    dispose(
      on(copyButton, 'click', async () => {
        const url = `${location.origin}${location.pathname}#/island/${island.number}`;
        try {
          await navigator.clipboard.writeText(url);
          app.toast('Link copied.');
        } catch {
          app.toast(url);
        }
      })
    );

    // Left/right arrows walk the catalogue when the canvas is not focused.
    dispose(
      on(window, 'keydown', (event) => {
        if (event.target !== document.body) return;
        if (event.key === '[' || event.key === 'PageUp') {
          Router.go(`/island/${island.number > 1 ? island.number - 1 : 404}`);
        } else if (event.key === ']' || event.key === 'PageDown') {
          Router.go(`/island/${island.number < 404 ? island.number + 1 : 1}`);
        }
      })
    );

    dispose(() => {
      app.stage.onStats = null;
      app.stage.detach();
    });

    return dispose.dispose;
  };
}
