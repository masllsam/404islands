/**
 * The stage.
 *
 * Exactly one WebGL context draws the big picture, and it is moved between
 * views rather than recreated. Browsers cap the number of live contexts at
 * around sixteen and reclaim the oldest without warning; an atlas that spawned
 * a context per navigation would start losing its own canvas after a dozen
 * clicks. So: one canvas, re-parented.
 */

import { IslandRenderer } from '../gl/renderer.js';
import { h } from './dom.js';

export class Stage {
  constructor() {
    this.canvas = h('canvas', {
      tabIndex: 0,
      role: 'img',
      'aria-label': 'Live rendering of the selected island',
    });
    this.renderer = new IslandRenderer(this.canvas, { maxPixelRatio: 2 });
    this.supported = this.renderer.supported;
    this.host = null;
    this.onStats = null;

    if (this.supported) {
      this.renderer.onStats = (stats) => this.onStats?.(stats);
    }

    // Stop burning GPU on a tab nobody is looking at.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.renderer.stop?.();
      else if (this.host) this.renderer.start?.();
    });
  }

  /**
   * Move the canvas into a container and start drawing.
   * @param {HTMLElement} host
   * @param {object} [options]
   * @param {boolean} [options.autoOrbit] Drift continuously instead of settling.
   */
  attach(host, { autoOrbit = false } = {}) {
    if (!this.supported) {
      host.appendChild(
        h('div.fallback', [
          h('div.label', 'WebGL 2 unavailable'),
          h('p', [
            'This browser cannot run the renderer, so the islands cannot be drawn here. ',
            'Everything else — the catalogue, the live readings, the coordinates — still works.',
          ]),
        ])
      );
      return;
    }

    this.host = host;
    host.appendChild(this.canvas);
    this.renderer.autoOrbit = autoOrbit ? 0.021 : 0;
    this.renderer.fade = 0;
    this.renderer.invalidate();
    this.renderer.start();
  }

  detach() {
    if (!this.supported) return;
    this.renderer.stop();
    this.canvas.remove();
    this.host = null;
    this.onStats = null;
  }

  show(island, scene) {
    if (!this.supported) return;
    this.renderer.setIsland(island);
    this.renderer.setScene(scene);
  }

  /** Update only the sky; keeps the camera and the current exposure framing. */
  updateScene(scene) {
    if (!this.supported) return;
    this.renderer.setScene(scene);
  }
}
