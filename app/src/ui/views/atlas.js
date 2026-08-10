/**
 * The atlas.
 *
 * All 404 tiles in one scrolling grid, each a live render. Three things keep
 * it fast:
 *
 *   — Only visible tiles own a canvas. An IntersectionObserver mounts and
 *     unmounts them, so a scroll through the whole atlas never holds more than
 *     a couple of dozen surfaces.
 *   — Tiles are drawn by the shared thumbnail factory on a per-frame budget,
 *     so scrolling stays smooth no matter how many appear at once.
 *   — Filtering rebuilds the grid but never re-sorts the world; the catalogue
 *     is computed once and only ever read.
 */

import { h, clear, disposable, on } from '../dom.js';
import { colophon } from '../components.js';
import * as fmt from '../format.js';
import { OCEAN_ORDER } from '../../core/geo.js';
import { ARCHETYPES } from '../../core/archetypes.js';

const SORTS = {
  number: { label: 'Catalogue order', compare: (a, b) => a.number - b.number },
  warmest: { label: 'Warmest now', climate: true, compare: (a, b) => b._t - a._t },
  coldest: { label: 'Coldest now', climate: true, compare: (a, b) => a._t - b._t },
  wildest: { label: 'Roughest sea', climate: true, compare: (a, b) => b._w - a._w },
  calmest: { label: 'Calmest', climate: true, compare: (a, b) => a._w - b._w },
  singular: { label: 'Most singular', compare: (a, b) => b.singularity - a.singularity },
  north: { label: 'Northmost', compare: (a, b) => b.lat - a.lat },
  south: { label: 'Southmost', compare: (a, b) => a.lat - b.lat },
};

export function atlas(app) {
  return (context, outlet) => {
    const dispose = disposable();
    clear(outlet);
    app.stage.detach();

    const state = {
      query: context.query.get('q') || '',
      ocean: context.query.get('ocean') || '',
      form: context.query.get('form') || '',
      sort: context.query.get('sort') || 'number',
      night: context.query.get('night') === '1',
    };

    const search = h('input', {
      type: 'search',
      placeholder: 'Search name, region, coordinate…',
      value: state.query,
      'aria-label': 'Search the atlas',
    });

    const oceanSelect = h(
      'select',
      { 'aria-label': 'Filter by ocean' },
      h('option', { value: '' }, 'All oceans'),
      ...OCEAN_ORDER.map((o) => h('option', { value: o, selected: state.ocean === o }, o))
    );

    const formSelect = h(
      'select',
      { 'aria-label': 'Filter by form' },
      h('option', { value: '' }, 'All forms'),
      ...ARCHETYPES.map((a) =>
        h('option', { value: a.id, selected: state.form === a.id }, a.name)
      )
    );

    const sortSelect = h(
      'select',
      { 'aria-label': 'Sort' },
      ...Object.entries(SORTS).map(([key, s]) =>
        h('option', { value: key, selected: state.sort === key }, s.label)
      )
    );

    const nightToggle = h(
      'button.button--quiet',
      { type: 'button', 'aria-pressed': String(state.night) },
      'Dark side only'
    );

    const count = h('div.filters__count');
    const grid = h('div.grid', { role: 'list' });
    const empty = h('div.atlas__empty', { hidden: true });

    const filters = h(
      'div.filters',
      { role: 'search' },
      search,
      oceanSelect,
      formSelect,
      sortSelect,
      nightToggle,
      count
    );

    outlet.appendChild(
      h(
        'div.atlas',
        h(
          'div.atlas__head',
          h(
            'div',
            h('div.label', 'The catalogue'),
            h('h1', 'All 404'),
            h('p.dim', { style: { marginTop: '0.8rem', maxWidth: '46ch' } }, [
              'Every tile is rendered on your machine, under the sky currently ',
              'reported at that island’s coordinate. Nothing here is cached artwork.',
            ])
          )
        ),
        filters,
        grid,
        empty,
        colophon()
      )
    );

    // ── Tile lifecycle ───────────────────────────────────────────────────

    const mounted = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tile = entry.target;
          const island = tile._island;
          if (entry.isIntersecting) mount(tile, island);
          else unmount(tile, island);
        }
      },
      // Start work a screen early so tiles are painted before they arrive.
      { rootMargin: '400px 0px' }
    );
    dispose(() => observer.disconnect());

    function mount(tile, island) {
      if (mounted.has(island.number)) return;
      const canvas = h('canvas', { width: 384, height: 256, 'aria-hidden': 'true' });
      tile.insertBefore(canvas, tile.firstChild);
      mounted.set(island.number, canvas);

      app.thumbnails.request(island, app.sceneFor(island), canvas, (ok) => {
        if (ok) {
          const placeholder = tile.querySelector('.tile__placeholder');
          if (placeholder) placeholder.remove();
        }
      });
    }

    function unmount(tile, island) {
      const canvas = mounted.get(island.number);
      if (!canvas) return;
      app.thumbnails.cancel(island.number);
      canvas.remove();
      mounted.delete(island.number);
      if (!tile.querySelector('.tile__placeholder')) {
        tile.insertBefore(h('div.tile__placeholder'), tile.firstChild);
      }
    }

    // ── Rendering the grid ───────────────────────────────────────────────

    function matches(island) {
      if (state.ocean && island.ocean !== state.ocean) return false;
      if (state.form && island.archetype.id !== state.form) return false;
      if (state.night) {
        const scene = app.sceneFor(island);
        if (scene.sunElevation > -2) return false;
      }
      if (state.query) {
        const q = state.query.toLowerCase();
        const hay = `${island.number} ${island.id} ${island.name} ${island.epithet || ''} ${island.region.name} ${island.ocean} ${island.archetype.name} ${island.coordLabel} ${island.band}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }

    function build() {
      const sort = SORTS[state.sort] || SORTS.number;
      let list = app.islands.filter(matches);

      if (sort.climate) {
        for (const island of list) {
          const c = app.climateFor(island);
          island._t = c.temperature;
          island._w = c.waveHeight ?? c.windSpeed / 40;
        }
      }
      list = list.slice().sort(sort.compare);

      observer.disconnect();
      mounted.clear();
      clear(grid);

      for (const island of list) grid.appendChild(tileFor(island));

      count.textContent = `${list.length} of ${app.islands.length}`;
      empty.hidden = list.length > 0;
      if (!list.length) {
        clear(empty);
        empty.append(
          h('p', 'No island in the atlas matches that.'),
          h('button', { onclick: reset }, 'Clear filters')
        );
      }

      for (const tile of grid.children) observer.observe(tile);
      syncUrl();
    }

    function tileFor(island) {
      const readings = app.readingsFor(island);
      const tile = h(
        'a.tile',
        {
          href: `#/island/${island.number}`,
          role: 'listitem',
          'aria-label': `Island ${island.id}, ${island.name}, ${island.region.name}. ${fmt.temperature(readings.temperature)}, ${readings.condition}.`,
        },
        h('div.tile__placeholder'),
        h(
          'div.tile__body',
          h(
            'div',
            h('div.tile__number', island.id),
            h('div.tile__name', island.name),
            h('div.tile__region', `${island.archetype.name} · ${island.region.name}`)
          ),
          h('div.tile__reading', [
            fmt.temperature(readings.temperature),
            h('br'),
            `${readings.windFrom} ${fmt.speed(readings.windSpeed)}`,
            h('br'),
            readings.isDay ? 'day' : 'night',
          ])
        )
      );
      tile._island = island;
      return tile;
    }

    function syncUrl() {
      const params = new URLSearchParams();
      if (state.query) params.set('q', state.query);
      if (state.ocean) params.set('ocean', state.ocean);
      if (state.form) params.set('form', state.form);
      if (state.sort !== 'number') params.set('sort', state.sort);
      if (state.night) params.set('night', '1');
      const suffix = params.toString();
      history.replaceState(null, '', `#/atlas${suffix ? `?${suffix}` : ''}`);
    }

    function reset() {
      state.query = '';
      state.ocean = '';
      state.form = '';
      state.night = false;
      search.value = '';
      oceanSelect.value = '';
      formSelect.value = '';
      nightToggle.setAttribute('aria-pressed', 'false');
      build();
    }

    // ── Wiring ───────────────────────────────────────────────────────────

    let debounce;
    dispose(
      on(search, 'input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          state.query = search.value.trim();
          build();
        }, 160);
      })
    );
    dispose(on(oceanSelect, 'change', () => { state.ocean = oceanSelect.value; build(); }));
    dispose(on(formSelect, 'change', () => { state.form = formSelect.value; build(); }));
    dispose(on(sortSelect, 'change', () => { state.sort = sortSelect.value; build(); }));
    dispose(
      on(nightToggle, 'click', () => {
        state.night = !state.night;
        nightToggle.setAttribute('aria-pressed', String(state.night));
        build();
      })
    );

    // Fetch observations for what is on screen, in view order, in batches.
    const refreshVisible = () => {
      const visible = [...mounted.keys()]
        .map((n) => app.atlas.byNumber.get(n))
        .filter(Boolean);
      if (visible.length) app.refresh(visible.slice(0, 100));
    };
    const refreshTimer = setInterval(refreshVisible, 4000);
    dispose(() => clearInterval(refreshTimer));

    // When observations land, redraw only the tiles that changed.
    const onClimate = (event) => {
      const changed = new Set(event.detail.islands || []);
      for (const [number, canvas] of mounted) {
        if (changed.size && !changed.has(number)) continue;
        const island = app.atlas.byNumber.get(number);
        if (island) app.thumbnails.request(island, app.sceneFor(island), canvas);
      }
    };
    app.addEventListener('climate', onClimate);
    dispose(() => app.removeEventListener('climate', onClimate));

    build();
    setTimeout(refreshVisible, 250);

    return dispose.dispose;
  };
}
