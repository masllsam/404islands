/**
 * A very small WebGL2 layer.
 *
 * No framework, no scene graph, no matrices — this app draws exactly two
 * things: a full-screen triangle, and another full-screen triangle. What it
 * needs from a GL abstraction is program compilation with honest error
 * messages, cached uniform locations, and render targets that can hold values
 * brighter than white.
 */

/** Thrown with the shader's own error log and the offending source lines. */
export class ShaderError extends Error {
  constructor(message, source, log) {
    super(message);
    this.name = 'ShaderError';
    this.source = source;
    this.log = log;
  }
}

function annotate(source, log) {
  const lineMatch = /ERROR:\s*\d+:(\d+)/.exec(log || '');
  if (!lineMatch) return log;
  const line = Number(lineMatch[1]);
  const lines = source.split('\n');
  const from = Math.max(0, line - 4);
  const to = Math.min(lines.length, line + 3);
  const excerpt = lines
    .slice(from, to)
    .map((text, i) => `${String(from + i + 1).padStart(4)} | ${text}`)
    .join('\n');
  return `${log}\n${excerpt}`;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new ShaderError(`Failed to compile ${kind} shader`, source, annotate(source, log));
  }
  return shader;
}

/** A linked program with lazily-resolved, cached uniform locations. */
export class Program {
  constructor(gl, vertexSource, fragmentSource, defines = {}) {
    this.gl = gl;
    this.defines = defines;

    const header = Object.entries(defines)
      .map(([k, v]) => `#define ${k} ${v}`)
      .join('\n');

    // `#version` must stay on line one, so defines are spliced in after it.
    const inject = (src) =>
      header ? src.replace(/^(#version[^\n]*\n)/, `$1${header}\n`) : src;

    const vs = compile(gl, gl.VERTEX_SHADER, inject(vertexSource));
    const fs = compile(gl, gl.FRAGMENT_SHADER, inject(fragmentSource));

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new ShaderError('Failed to link program', fragmentSource, log);
    }

    this.program = program;
    this.locations = new Map();
  }

  use() {
    this.gl.useProgram(this.program);
    return this;
  }

  loc(name) {
    if (!this.locations.has(name)) {
      this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.locations.get(name);
  }

  /**
   * Set uniforms from a plain object. Types are inferred: numbers become
   * float, arrays become vecN, booleans become int, and a name ending in `I`
   * or `Seed` is treated as integer/unsigned. Uniforms the shader optimised
   * away are silently skipped.
   */
  set(values) {
    const gl = this.gl;
    for (const [name, value] of Object.entries(values)) {
      const location = this.loc(name);
      if (location === null) continue;

      if (typeof value === 'boolean') {
        gl.uniform1i(location, value ? 1 : 0);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value) && (name.endsWith('I') || INT_UNIFORMS.has(name))) {
          gl.uniform1i(location, value);
        } else if (UINT_UNIFORMS.has(name)) {
          gl.uniform1ui(location, value >>> 0);
        } else {
          gl.uniform1f(location, value);
        }
      } else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        if (value.length === 2) gl.uniform2fv(location, value);
        else if (value.length === 3) gl.uniform3fv(location, value);
        else if (value.length === 4) gl.uniform4fv(location, value);
        else if (value.length === 9) gl.uniformMatrix3fv(location, false, value);
        else if (value.length === 16) gl.uniformMatrix4fv(location, false, value);
      }
    }
    return this;
  }

  dispose() {
    this.gl.deleteProgram(this.program);
    this.locations.clear();
  }
}

const INT_UNIFORMS = new Set(['uArchetype', 'uOctaves', 'uLobes', 'uQuality']);
const UINT_UNIFORMS = new Set(['uNoiseSeed']);

/**
 * A colour render target. Half-float where supported, because the sun disc and
 * the specular glitter on water genuinely exceed 1.0 and clipping them makes
 * every sunset look the same.
 */
export class RenderTarget {
  constructor(gl, width, height, { float = true, mipmap = false } = {}) {
    this.gl = gl;
    this.width = Math.max(1, width | 0);
    this.height = Math.max(1, height | 0);
    this.mipmap = mipmap;
    this.float = float && Boolean(gl.getExtension('EXT_color_buffer_float'));

    this.texture = gl.createTexture();
    this.framebuffer = gl.createFramebuffer();
    this.#allocate();
  }

  #allocate() {
    const gl = this.gl;
    const internal = this.float ? gl.RGBA16F : gl.RGBA8;
    const type = this.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, this.width, this.height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      this.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(width, height) {
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    if (w === this.width && h === this.height) return false;
    this.width = w;
    this.height = h;
    this.#allocate();
    return true;
  }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }

  generateMipmap() {
    if (!this.mipmap) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  bindTexture(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    return unit;
  }

  dispose() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}

/**
 * Create a WebGL2 context configured the way this piece wants it: no depth
 * buffer (nothing is rasterised), no antialias (the renderer supersamples
 * itself), and a preserved drawing buffer only when asked, since export needs
 * it and everything else pays for it.
 */
export function createContext(canvas, { preserveDrawingBuffer = false } = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer,
    powerPreference: 'high-performance',
    desynchronized: true,
  });
  if (!gl) return null;

  // A VAO must be bound in WebGL2 even when drawing without attributes.
  gl.bindVertexArray(gl.createVertexArray());
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  return gl;
}

/** Draw the full-screen triangle the vertex shader synthesises. */
export function drawFullscreen(gl) {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
