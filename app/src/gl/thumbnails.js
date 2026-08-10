/**
 * Atlas thumbnails.
 *
 * Four hundred and four tiles, each a real render of a real island under its
 * real current sky — not a sprite sheet, not a placeholder.
 *
 * One shared GL context renders a small queue of tiles per animation frame and
 * blits each result straight into the tile's own 2D canvas. Nothing is cached
 * as an ImageBitmap, because a full atlas of cached bitmaps would cost more
 * memory than the whole rest of the page; re-rendering a tile on scroll-back
 * costs about a millisecond, which is cheaper than remembering it.
 */

import { createContext, drawFullscreen, Program, RenderTarget } from './gl.js';
import { VERTEX_SHADER, SCENE_FRAGMENT } from './shaders/scene.glsl.js';
import { PRESENT_FRAGMENT, ACCUMULATE_FRAGMENT } from './shaders/present.glsl.js';
import { sceneUniforms } from './uniforms.js';

/** Sub-pixel offsets for the few samples a tile can afford. */
const TILE_JITTER = [
  [0, 0],
  [-0.25, 0.25],
  [0.25, -0.25],
  [0.25, 0.25],
];

export class ThumbnailFactory {
  /**
   * @param {object} [options]
   * @param {number} [options.width]   Render width in device pixels.
   * @param {number} [options.height]
   * @param {number} [options.samples] Jittered samples per tile; three is
   *   enough to clean up a coastline at this size.
   * @param {number} [options.budgetMs] GPU work to spend per animation frame.
   */
  constructor(options = {}) {
    this.width = options.width || 384;
    this.height = options.height || 256;
    this.samples = options.samples || 3;
    this.budgetMs = options.budgetMs || 7;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.gl = createContext(this.canvas, { preserveDrawingBuffer: true });
    this.supported = Boolean(this.gl);
    if (!this.supported) return;

    const gl = this.gl;
    this.sceneProgram = new Program(gl, VERTEX_SHADER, SCENE_FRAGMENT, { QUALITY: 0 });
    this.presentProgram = new Program(gl, VERTEX_SHADER, PRESENT_FRAGMENT);
    this.accumProgram = new Program(gl, VERTEX_SHADER, ACCUMULATE_FRAGMENT);

    this.sceneTarget = new RenderTarget(gl, this.width, this.height, { float: true });
    this.accum = [
      new RenderTarget(gl, this.width, this.height, { float: true, mipmap: true }),
      new RenderTarget(gl, this.width, this.height, { float: true, mipmap: true }),
    ];

    /** @type {Map<number, {island, scene, canvas, onDone}>} */
    this.queue = new Map();
    this.scheduled = false;
  }

  /** A stable, slightly varied camera so the grid does not look stamped out. */
  #camera(island) {
    const t = island.terrain;
    const spin = (island.seed % 1024) / 1024;
    const lift = ((island.seed >>> 10) % 128) / 128;
    return {
      azimuth: spin * Math.PI * 2,
      elevation: 0.17 + lift * 0.20,
      distance: 1.95 + t.height * 1.05,
      target: [0, t.height * 0.24, 0],
    };
  }

  /**
   * Queue a tile. The most recent request for an island wins, so a tile that
   * is re-requested with a fresher observation redraws with it.
   *
   * @param {object} island
   * @param {object} scene   Derived scene for this island's live climate.
   * @param {HTMLCanvasElement} canvas  Destination; drawn into on completion.
   * @param {Function} [onDone]
   */
  request(island, scene, canvas, onDone) {
    if (!this.supported) {
      onDone?.(false);
      return;
    }
    this.queue.set(island.number, { island, scene, canvas, onDone });
    this.#schedule();
  }

  /** Drop a queued tile that scrolled away before it was drawn. */
  cancel(number) {
    const entry = this.queue.get(number);
    if (!entry) return;
    this.queue.delete(number);
    entry.onDone?.(false);
  }

  #schedule() {
    if (this.scheduled || !this.queue.size) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      const start = performance.now();
      // Insertion order is view order: the atlas re-queues as tiles appear.
      for (const [number, entry] of this.queue) {
        this.queue.delete(number);
        try {
          this.#render(entry.island, entry.scene);
          this.#blit(entry.canvas);
          entry.onDone?.(true);
        } catch (err) {
          entry.onDone?.(false, err);
        }
        if (performance.now() - start > this.budgetMs) break;
      }
      this.#schedule();
    });
  }

  #blit(target) {
    if (!target || !target.isConnected) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(this.canvas, 0, 0, target.width, target.height);
  }

  #render(island, scene) {
    const gl = this.gl;
    const camera = this.#camera(island);
    const resolution = [this.width, this.height];
    let index = 0;

    for (let i = 0; i < this.samples; i++) {
      this.sceneProgram.use().set(
        sceneUniforms({
          island,
          scene,
          camera,
          resolution,
          // A fixed per-island moment in the swell: tiles must not shimmer.
          time: island.number * 7.3,
          jitter: TILE_JITTER[i % TILE_JITTER.length],
        })
      );
      this.sceneTarget.bind();
      drawFullscreen(gl);

      const read = this.accum[index];
      const write = this.accum[1 - index];
      const acc = this.accumProgram.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, read.texture);
      acc.set({ uWeight: 1 / (i + 1), uResolution: resolution });
      gl.uniform1i(acc.loc('uCurrent'), 0);
      gl.uniform1i(acc.loc('uHistory'), 1);
      write.bind();
      drawFullscreen(gl);
      index = 1 - index;
    }

    const finalTarget = this.accum[index];
    finalTarget.generateMipmap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    const present = this.presentProgram.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTarget.texture);
    present.set({
      uResolution: resolution,
      uTime: island.number * 3.1,
      uExposure: 0.92,
      uRain: scene.rain,
      uSnow: scene.snow,
      uWindDir: scene.windDir,
      uWindSpeed: scene.windSpeed,
      uBloom: 0.45,
      uGrain: 0.018,
      uVignette: 0.24,
      uFade: 1,
      uConverged: 1,
    });
    gl.uniform1i(present.loc('uScene'), 0);
    drawFullscreen(gl);
  }

  dispose() {
    if (!this.supported) return;
    this.queue.clear();
    this.sceneProgram.dispose();
    this.presentProgram.dispose();
    this.accumProgram.dispose();
    this.sceneTarget.dispose();
    this.accum[0].dispose();
    this.accum[1].dispose();
  }
}
