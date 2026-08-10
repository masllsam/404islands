/**
 * The renderer.
 *
 * Two ideas do most of the work here.
 *
 * **Motion is cheap, stillness is expensive.** While you are dragging, the
 * scene renders at a reduced resolution with a short march budget. The moment
 * you stop, the clock freezes and the renderer starts stacking jittered
 * samples into an accumulation buffer. Within a couple of seconds the frame
 * has converged into something with no aliasing, no noise, and enough shadow
 * detail to print. The piece rewards standing still, which is the only thing
 * a landscape has ever asked of anyone.
 *
 * **The budget is measured, not assumed.** Frame time drives the render scale
 * and the quality tier, so a five-year-old phone and a workstation both land
 * near 60 fps with the best image each can hold.
 */

import { createContext, drawFullscreen, Program, RenderTarget } from './gl.js';
import { VERTEX_SHADER, SCENE_FRAGMENT } from './shaders/scene.glsl.js';
import { PRESENT_FRAGMENT, ACCUMULATE_FRAGMENT } from './shaders/present.glsl.js';
import { islandUniforms, sceneUniforms, orbitPosition, exposureFor } from './uniforms.js';

const IDLE_BEFORE_CONVERGE_MS = 420;
const MAX_SAMPLES = 96;
const MIN_SCALE = 0.45;
const TARGET_FRAME_MS = 15.5;
/** A settling frame may cost this much before the renderer gives ground. */
const CONVERGE_BUDGET_MS = 90;

/** Halton sequence: better-distributed sub-pixel offsets than random. */
function halton(index, base) {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

const JITTER = Array.from({ length: MAX_SAMPLES + 1 }, (_, i) => [
  halton(i + 1, 2) - 0.5,
  halton(i + 1, 3) - 0.5,
]);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class IslandRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {boolean} [options.interactive] Attach pointer controls.
   * @param {number}  [options.maxPixelRatio]
   * @param {boolean} [options.autoOrbit] Drift the camera continuously; used
   *   for the title scene, where converging would be beside the point.
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.gl = createContext(canvas);
    this.supported = Boolean(this.gl);
    if (!this.supported) return;

    const gl = this.gl;
    this.maxPixelRatio = options.maxPixelRatio || 2;
    this.autoOrbit = options.autoOrbit ? 0.02 : 0;

    // Compile the interactive tier eagerly and the still tier lazily — most
    // visits to the atlas never converge a frame.
    this.programs = new Map();
    this.sceneProgram(1);
    this.presentProgram = new Program(gl, VERTEX_SHADER, PRESENT_FRAGMENT);
    this.accumProgram = new Program(gl, VERTEX_SHADER, ACCUMULATE_FRAGMENT);

    this.sceneTarget = new RenderTarget(gl, 8, 8, { float: true });
    this.accum = [
      new RenderTarget(gl, 8, 8, { float: true, mipmap: true }),
      new RenderTarget(gl, 8, 8, { float: true, mipmap: true }),
    ];
    this.accumIndex = 0;

    // Camera, in orbit coordinates.
    this.camera = {
      azimuth: 2.35,
      elevation: 0.30,
      distance: 3.35,
      target: [0, 0.10, 0],
    };
    this.velocity = { azimuth: 0, elevation: 0 };

    this.island = null;
    this.scene = null;
    this.uniforms = {};

    this.simTime = 0;
    this.samples = 0;
    this.lastInteraction = performance.now();
    this.renderScale = 1;
    this.interactiveScale = 1;
    this.convergeStrain = 0;
    this.qualityTier = 1;
    this.frameMs = 16;
    this.running = false;
    this.dirty = true;
    this.fade = 0;
    this.pixelRatio = 1;
    this.lastStats = { fps: 60, samples: 0, scale: 1, tier: 1 };

    this.#observeSize();
    if (options.interactive !== false) this.#attachControls();
  }

  // ── Programs ───────────────────────────────────────────────────────────

  sceneProgram(tier) {
    if (!this.programs.has(tier)) {
      this.programs.set(
        tier,
        new Program(this.gl, VERTEX_SHADER, SCENE_FRAGMENT, { QUALITY: tier })
      );
    }
    return this.programs.get(tier);
  }

  // ── Subject ────────────────────────────────────────────────────────────

  /** Point the renderer at an island. Resets the frame. */
  setIsland(island) {
    this.island = island;
    this.#buildIslandUniforms();
    this.invalidate();
  }

  /** Apply a scene derived from a live observation. Resets the frame. */
  setScene(scene) {
    this.scene = scene;
    this.invalidate();
  }

  #buildIslandUniforms() {
    if (!this.island) return;
    this.uniforms = islandUniforms(this.island);

    // Frame the island: tall volcanic cones want a longer lens than a sandbar.
    const t = this.island.terrain;
    this.camera.distance = clamp(2.05 + t.height * 1.2, 1.95, 3.6);
    this.camera.target[1] = t.height * 0.24;
  }

  // ── Camera ─────────────────────────────────────────────────────────────

  #cameraPosition() {
    return orbitPosition(this.camera);
  }

  /** Nudge the camera; used by keyboard controls and the tour. */
  orbit(dAzimuth, dElevation) {
    this.camera.azimuth += dAzimuth;
    this.camera.elevation = clamp(this.camera.elevation + dElevation, 0.02, 1.35);
    this.invalidate();
  }

  zoom(factor) {
    this.camera.distance = clamp(this.camera.distance * factor, 1.35, 8.0);
    this.invalidate();
  }

  /** Discard the converged frame; the next frame starts a new exposure. */
  invalidate() {
    this.samples = 0;
    this.dirty = true;
    this.lastInteraction = performance.now();
  }

  #attachControls() {
    const canvas = this.canvas;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinchDistance = 0;

    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      this.invalidate();
    };

    const move = (e) => {
      if (!dragging) return;
      const dx = (e.clientX - lastX) / canvas.clientWidth;
      const dy = (e.clientY - lastY) / canvas.clientHeight;
      lastX = e.clientX;
      lastY = e.clientY;
      this.velocity.azimuth = -dx * 3.2;
      this.velocity.elevation = dy * 2.2;
      this.orbit(this.velocity.azimuth, this.velocity.elevation);
    };

    const up = (e) => {
      dragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0011));
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        const [a, b] = e.touches;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDistance) this.zoom(pinchDistance / d);
        pinchDistance = d;
      },
      { passive: false }
    );
    canvas.addEventListener('touchend', () => {
      pinchDistance = 0;
    });

    // Keyboard: the canvas is focusable so the scene is navigable without a
    // pointer, which is the only way some visitors will ever reach it.
    canvas.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.22 : 0.08;
      switch (e.key) {
        case 'ArrowLeft': this.orbit(-step, 0); break;
        case 'ArrowRight': this.orbit(step, 0); break;
        case 'ArrowUp': this.orbit(0, step * 0.6); break;
        case 'ArrowDown': this.orbit(0, -step * 0.6); break;
        case '+': case '=': this.zoom(0.9); break;
        case '-': case '_': this.zoom(1.1); break;
        default: return;
      }
      e.preventDefault();
    });

    this.disposeControls = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    };
  }

  // ── Sizing ─────────────────────────────────────────────────────────────

  #observeSize() {
    const apply = () => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
      this.cssWidth = Math.max(1, rect.width);
      this.cssHeight = Math.max(1, rect.height);
      this.pixelRatio = dpr;
      this.#resizeTargets();
      this.invalidate();
    };

    this.resizeObserver = new ResizeObserver(apply);
    this.resizeObserver.observe(this.canvas);
    apply();
  }

  #resizeTargets() {
    const w = Math.max(1, Math.round(this.cssWidth * this.pixelRatio * this.renderScale));
    const h = Math.max(1, Math.round(this.cssHeight * this.pixelRatio * this.renderScale));

    this.canvas.width = Math.round(this.cssWidth * this.pixelRatio);
    this.canvas.height = Math.round(this.cssHeight * this.pixelRatio);

    this.sceneTarget.resize(w, h);
    this.accum[0].resize(w, h);
    this.accum[1].resize(w, h);
  }

  // ── Loop ───────────────────────────────────────────────────────────────

  start() {
    if (!this.supported || this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      this.frameHandle = requestAnimationFrame(tick);
      this.#frame(now);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }

  #frame(now) {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // Exponential moving average: one slow frame should not collapse quality.
    this.frameMs += ((now - (this.lastMeasured || now)) - this.frameMs) * 0.1;
    this.lastMeasured = now;

    if (!this.island || !this.scene) return;

    const idle = now - this.lastInteraction;
    const converging = !this.autoOrbit && idle > IDLE_BEFORE_CONVERGE_MS;

    if (this.autoOrbit) {
      this.camera.azimuth += this.autoOrbit * dt;
      this.samples = 0;
    }

    // Inertia after a flick.
    if (!converging && !this.autoOrbit) {
      const damp = Math.pow(0.02, dt);
      this.velocity.azimuth *= damp;
      this.velocity.elevation *= damp;
      if (Math.abs(this.velocity.azimuth) > 1e-4) {
        this.camera.azimuth += this.velocity.azimuth * dt * 3;
        this.camera.elevation = clamp(
          this.camera.elevation + this.velocity.elevation * dt * 3,
          0.02,
          1.35
        );
        this.samples = 0;
      }
    }

    if (!converging) {
      // The world runs while you watch it; it holds its breath while it
      // resolves.
      this.simTime += dt;
      this.samples = 0;
    }

    if (converging && this.samples >= MAX_SAMPLES) {
      // Converged. Nothing left to draw — hold the frame and give the GPU back.
      this.#publishStats(true);
      return;
    }

    this.#adaptQuality(converging);
    this.#renderFrame(converging);
    this.#publishStats(converging);
  }

  #adaptQuality(converging) {
    if (converging) {
      // A converging frame is allowed to be slower than an interactive one —
      // nothing is waiting on it — but not so slow that the page stops
      // responding. What the device managed while moving is the best evidence
      // of what it can manage while settling.
      // Both pieces of evidence matter. Scale alone is not enough at startup,
      // when it is still 1.0 because nothing has yet had a chance to lower it —
      // and the first settling frame is the one most likely to jank.
      const capable = this.interactiveScale >= 0.85 && this.frameMs < 22;
      const tier = capable ? 2 : 1;
      let scale = Math.min(1, this.interactiveScale + (capable ? 0.2 : 0.1));

      // If a converging frame blows well past a video frame, give ground.
      if (this.frameMs > CONVERGE_BUDGET_MS) {
        scale = Math.max(MIN_SCALE, scale - 0.12);
        this.convergeStrain = Math.min(3, this.convergeStrain + 1);
      }

      this.qualityTier = this.convergeStrain >= 2 ? 1 : tier;
      if (Math.abs(scale - this.renderScale) > 0.005) {
        this.renderScale = scale;
        this.#resizeTargets();
      }
      return;
    }

    this.convergeStrain = 0;

    const over = this.frameMs > TARGET_FRAME_MS * 1.35;
    const under = this.frameMs < TARGET_FRAME_MS * 0.72;

    let scale = this.interactiveScale;
    if (over) scale = Math.max(MIN_SCALE, scale - 0.06);
    else if (under) scale = Math.min(1, scale + 0.03);
    this.interactiveScale = scale;

    if (Math.abs(scale - this.renderScale) > 0.005) {
      this.renderScale = scale;
      this.#resizeTargets();
    }

    // Only drop the shader tier once the resolution lever is exhausted.
    this.qualityTier = this.interactiveScale <= MIN_SCALE + 0.01 && over ? 0 : 1;
  }

  #sceneUniforms() {
    return sceneUniforms({
      island: this.island,
      scene: this.scene,
      camera: this.camera,
      resolution: [this.sceneTarget.width, this.sceneTarget.height],
      time: this.simTime,
      jitter: this.samples > 0 ? JITTER[this.samples % JITTER.length] : [0, 0],
    });
  }

  #renderFrame(converging) {
    const gl = this.gl;

    // 1 — radiance
    const scene = this.sceneProgram(this.qualityTier).use();
    scene.set(this.#sceneUniforms());
    this.sceneTarget.bind();
    drawFullscreen(gl);

    // 2 — accumulate (weight 1 while moving, 1/(n+1) while converging)
    const read = this.accum[this.accumIndex];
    const write = this.accum[1 - this.accumIndex];
    const weight = converging ? 1 / (this.samples + 1) : 1;

    const accum = this.accumProgram.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTarget.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    accum.set({ uWeight: weight, uResolution: [write.width, write.height] });
    gl.uniform1i(accum.loc('uCurrent'), 0);
    gl.uniform1i(accum.loc('uHistory'), 1);
    write.bind();
    drawFullscreen(gl);
    write.generateMipmap();
    this.accumIndex = 1 - this.accumIndex;

    // 3 — present
    this.fade = Math.min(1, this.fade + 0.06);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.#present(write, this.canvas.width, this.canvas.height, converging);

    if (converging) this.samples++;
  }

  #present(source, width, height, converging) {
    const gl = this.gl;
    const s = this.scene;
    const present = this.presentProgram.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    present.set({
      uResolution: [width, height],
      uTime: performance.now() / 1000,
      uExposure: exposureFor(s),
      uRain: s.rain,
      uSnow: s.snow,
      uWindDir: s.windDir,
      uWindSpeed: s.windSpeed,
      uBloom: 0.55,
      uGrain: 0.028,
      uVignette: 0.30,
      uFade: this.fade,
      uConverged: converging ? Math.min(1, this.samples / 24) : 0,
    });
    gl.uniform1i(present.loc('uScene'), 0);
    drawFullscreen(gl);
  }

  #publishStats(converged) {
    this.lastStats = {
      fps: this.frameMs > 0 ? Math.round(1000 / this.frameMs) : 60,
      samples: this.samples,
      maxSamples: MAX_SAMPLES,
      scale: Number(this.renderScale.toFixed(2)),
      tier: this.qualityTier,
      converged: converged && this.samples >= MAX_SAMPLES,
    };
    this.onStats?.(this.lastStats);
  }

  // ── Export ─────────────────────────────────────────────────────────────

  /**
   * Render a still at an arbitrary resolution and return it as a PNG blob.
   * Runs one sample per animation frame so the page stays responsive during
   * what can be several seconds of work on a large export.
   */
  async capture({ width = 2400, height = 1500, samples = 64, onProgress } = {}) {
    if (!this.supported || !this.island || !this.scene) return null;

    const gl = this.gl;
    const scene = new RenderTarget(gl, width, height, { float: true });
    const accum = [
      new RenderTarget(gl, width, height, { float: true, mipmap: true }),
      new RenderTarget(gl, width, height, { float: true, mipmap: true }),
    ];
    const out = new RenderTarget(gl, width, height, { float: false });

    const program = this.sceneProgram(2);
    const savedTarget = this.sceneTarget;
    this.sceneTarget = scene; // so #sceneUniforms reports the export resolution

    // The interactive loop must stand down: it renders on the same rAF this
    // export yields to, and it would otherwise be drawing the live view at
    // export resolution between every sample.
    const wasRunning = this.running;
    this.stop();

    try {
      let index = 0;
      for (let i = 0; i < samples; i++) {
        this.samples = i;
        program.use().set(this.#sceneUniforms());
        scene.bind();
        drawFullscreen(gl);

        const read = accum[index];
        const write = accum[1 - index];
        const acc = this.accumProgram.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, scene.texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, read.texture);
        acc.set({ uWeight: 1 / (i + 1), uResolution: [width, height] });
        gl.uniform1i(acc.loc('uCurrent'), 0);
        gl.uniform1i(acc.loc('uHistory'), 1);
        write.bind();
        drawFullscreen(gl);
        index = 1 - index;

        onProgress?.((i + 1) / samples);
        // Yield so the compositor still gets frames.
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      const finalAccum = accum[index];
      finalAccum.generateMipmap();
      out.bind();
      const savedFade = this.fade;
      this.fade = 1;
      this.#present(finalAccum, width, height, true);
      this.fade = savedFade;

      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      return await toPngBlob(pixels, width, height);
    } finally {
      this.sceneTarget = savedTarget;
      scene.dispose();
      accum[0].dispose();
      accum[1].dispose();
      out.dispose();
      this.invalidate();
      if (wasRunning) this.start();
    }
  }

  dispose() {
    this.stop();
    this.resizeObserver?.disconnect();
    this.disposeControls?.();
    if (!this.supported) return;
    for (const p of this.programs.values()) p.dispose();
    this.presentProgram.dispose();
    this.accumProgram.dispose();
    this.sceneTarget.dispose();
    this.accum[0].dispose();
    this.accum[1].dispose();
  }
}

/** Flip the GL readback (origin bottom-left) and encode it as a PNG. */
async function toPngBlob(pixels, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);

  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * rowBytes;
    image.data.set(pixels.subarray(src, src + rowBytes), y * rowBytes);
  }
  ctx.putImageData(image, 0, 0);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
