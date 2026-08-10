/**
 * Application context.
 *
 * Holds the four long-lived things — the catalogue, the live feed, the stage,
 * and the thumbnail factory — and hands out derived scenes. Views are pure
 * functions of this plus a route.
 */

import { getAtlas } from '../core/catalog.js';
import { ClimateService } from '../climate/service.js';
import { deriveScene, readouts } from '../climate/derive.js';
import { auroraStrength } from '../gl/uniforms.js';
import { ThumbnailFactory } from '../gl/thumbnails.js';
import { Stage } from './stage.js';
import { h, clear } from './dom.js';

/** How long a derived scene is reused before it is recomputed. */
const SCENE_TTL_MS = 20 * 1000;

export class App extends EventTarget {
  constructor() {
    super();
    this.atlas = getAtlas();
    this.islands = this.atlas.islands;
    this.climate = new ClimateService();
    this.stage = new Stage();
    this.thumbnails = new ThumbnailFactory({ width: 384, height: 256 });
    this.sceneCache = new Map();
    this.toastHost = null;

    // A new observation changes the light: drop derived scenes so the next
    // paint uses it, and let views decide what to redraw.
    this.climate.addEventListener('update', (event) => {
      for (const number of event.detail.islands) this.sceneCache.delete(number);
      this.dispatchEvent(new CustomEvent('climate', { detail: event.detail }));
    });
    this.climate.addEventListener('connectivity', () => {
      this.dispatchEvent(new CustomEvent('climate', { detail: { islands: [] } }));
    });

    // The sun moves whether or not the weather does. Half a minute is finer
    // than the eye can catch and coarse enough to cost nothing.
    setInterval(() => {
      this.sceneCache.clear();
      this.dispatchEvent(new CustomEvent('tick'));
    }, 30 * 1000);
  }

  /** The live (or modelled) record for an island. */
  climateFor(island) {
    return this.climate.get(island);
  }

  /** Renderer-ready scene for an island, memoised for a few seconds. */
  sceneFor(island, date = new Date()) {
    const cached = this.sceneCache.get(island.number);
    if (cached && Date.now() - cached.at < SCENE_TTL_MS) return cached.scene;

    const climate = this.climateFor(island);
    const scene = deriveScene(island, climate, date);
    scene.aurora = auroraStrength(island, scene);
    this.sceneCache.set(island.number, { scene, at: Date.now() });
    return scene;
  }

  /** Human-facing instrument readings for an island. */
  readingsFor(island, date = new Date()) {
    return readouts(island, this.climateFor(island), date);
  }

  /** Ask the feed for fresh observations; never awaited by a render path. */
  refresh(islands) {
    this.climate.ensure(islands).catch(() => {});
  }

  /** Provenance of what is currently on screen, for the status pill. */
  provenance(island) {
    const record = this.climateFor(island);
    if (!this.climate.online) return { state: 'offline', label: 'Offline — modelled sky', record };
    if (record.source === 'observed') return { state: 'live', label: 'Live observation', record };
    return { state: 'modelled', label: 'Modelled sky', record };
  }

  // ── Toasts ─────────────────────────────────────────────────────────────

  toast(message, { bad = false, ms = 4200 } = {}) {
    if (!this.toastHost) {
      this.toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(this.toastHost);
    }
    const node = h(`div.toast${bad ? '.toast--bad' : ''}`, message);
    this.toastHost.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity 300ms';
      setTimeout(() => node.remove(), 320);
    }, ms);
  }

  clearToasts() {
    if (this.toastHost) clear(this.toastHost);
  }
}
