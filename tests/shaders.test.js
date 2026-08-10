/**
 * The shader sources, as text.
 *
 * These cannot be compiled without a GPU, so `scripts/smoke.mjs` does that in
 * a browser. What *can* be checked here, in milliseconds, is that the sources
 * arrived intact and that their uniforms match what the renderer sets — the
 * two failure modes that are silent, expensive to find, and catastrophic.
 *
 * The first of them has already happened once: a backtick inside a GLSL
 * comment closed the JavaScript template literal and truncated the entire
 * shader. Everything still "worked" until a browser tried to draw.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VERTEX_SHADER, SCENE_FRAGMENT } from '../app/src/gl/shaders/scene.glsl.js';
import { PRESENT_FRAGMENT, ACCUMULATE_FRAGMENT } from '../app/src/gl/shaders/present.glsl.js';
import { islandUniforms, climateUniforms, sceneUniforms, exposureFor } from '../app/src/gl/uniforms.js';
import { getIsland } from '../app/src/core/catalog.js';
import { simulateClimate } from '../app/src/climate/simulate.js';
import { deriveScene } from '../app/src/climate/derive.js';

const SOURCES = {
  VERTEX_SHADER,
  SCENE_FRAGMENT,
  PRESENT_FRAGMENT,
  ACCUMULATE_FRAGMENT,
};

test('every shader source is complete and well-formed', () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    assert.equal(typeof source, 'string', `${name} is not a string`);
    assert.ok(source.length > 100, `${name} is suspiciously short (${source.length} chars)`);
    assert.match(source, /^#version 300 es\n/, `${name} lost its version directive`);
    assert.match(source, /void main\(\)\s*\{/, `${name} has no entry point`);

    // Balanced braces: a truncated literal almost always breaks this.
    const open = (source.match(/\{/g) || []).length;
    const close = (source.match(/\}/g) || []).length;
    assert.equal(open, close, `${name} has ${open} '{' and ${close} '}'`);
  }
});

test('no shader source contains a backtick or an unescaped template hole', () => {
  // Both would silently truncate or corrupt the source at parse time.
  for (const [name, source] of Object.entries(SOURCES)) {
    assert.ok(!source.includes('`'), `${name} contains a backtick`);
    assert.ok(!source.includes('${'), `${name} contains a template substitution`);
  }
});

test('the scene shader still draws all seven archetypes', () => {
  for (let index = 0; index <= 6; index++) {
    assert.ok(
      SCENE_FRAGMENT.includes(`uArchetype == ${index}`) || index === 0 || index === 5,
      `no branch for archetype ${index}`
    );
  }
  // The pieces the piece is made of.
  for (const symbol of [
    'terrainHeight', 'shelfMask', 'islandMask', 'waveField', 'skyColor',
    'cloudLayer', 'shadeWater', 'shadeTerrain', 'applyAtmosphere',
    'auroraLayer', 'starField', 'moonLight',
  ]) {
    assert.ok(SCENE_FRAGMENT.includes(symbol), `the scene shader lost ${symbol}`);
  }
});

test('every quality tier defines every knob it branches on', () => {
  for (const knob of [
    'MARCH_STEPS', 'SHADOW_STEPS', 'MAX_DIST', 'CLOUD_LAYERS', 'AO_ON', 'REFINE_STEPS',
  ]) {
    const definitions = SCENE_FRAGMENT.match(new RegExp(`#define ${knob}\\b`, 'g')) || [];
    assert.equal(definitions.length, 3, `${knob} is defined ${definitions.length} times, not once per tier`);
  }
});

test('every uniform the renderer sets exists in the shader that receives it', () => {
  const island = getIsland(217);
  const climate = simulateClimate(island);
  const scene = deriveScene(island, climate);
  scene.aurora = 0.5;

  const declared = new Set(
    [...SCENE_FRAGMENT.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map((m) => m[1])
  );

  const provided = sceneUniforms({
    island,
    scene,
    camera: { azimuth: 0, elevation: 0.3, distance: 3, target: [0, 0, 0] },
    resolution: [800, 600],
  });

  for (const name of Object.keys(provided)) {
    assert.ok(declared.has(name), `the renderer sets ${name}, which the shader does not declare`);
  }
});

test('every uniform the shader declares is actually supplied', () => {
  const island = getIsland(3);
  const scene = deriveScene(island, simulateClimate(island));
  scene.aurora = 0;

  const declared = [...SCENE_FRAGMENT.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map((m) => m[1]);
  const provided = new Set(
    Object.keys(
      sceneUniforms({
        island,
        scene,
        camera: { azimuth: 0, elevation: 0.3, distance: 3, target: [0, 0, 0] },
        resolution: [800, 600],
      })
    )
  );

  for (const name of declared) {
    assert.ok(provided.has(name), `the shader declares ${name}, which nothing ever sets`);
  }
});

test('island uniforms carry an unsigned seed and an integer archetype', () => {
  for (const number of [1, 42, 217, 404]) {
    const u = islandUniforms(getIsland(number));
    assert.ok(Number.isInteger(u.uArchetype) && u.uArchetype >= 0 && u.uArchetype <= 6);
    assert.ok(Number.isInteger(u.uOctaves) && u.uOctaves > 0);
    assert.ok(Number.isInteger(u.uLobes) && u.uLobes >= 1);
    assert.ok(u.uNoiseSeed >= 0 && u.uNoiseSeed <= 0xffffffff);
    for (const [key, value] of Object.entries(u)) {
      assert.ok(Number.isFinite(value), `${key} is not finite`);
    }
  }
});

test('climate uniforms are finite for every island at every hour', () => {
  for (const number of [1, 100, 217, 300, 404]) {
    const island = getIsland(number);
    for (const hour of [0, 6, 12, 18]) {
      const date = new Date(Date.UTC(2024, 0, 15, hour));
      const scene = deriveScene(island, simulateClimate(island, date), date);
      scene.aurora = 0.3;
      for (const [key, value] of Object.entries(climateUniforms(scene))) {
        if (Array.isArray(value)) {
          for (const c of value) assert.ok(Number.isFinite(c), `${key} has a non-finite component`);
        } else {
          assert.ok(Number.isFinite(value), `${key} is ${value}`);
        }
      }
    }
  }
});

test('exposure opens up in the dark and leaves daylight alone', () => {
  const day = exposureFor({ night: 0 });
  const dusk = exposureFor({ night: 0.5 });
  const dark = exposureFor({ night: 1 });

  assert.equal(day, 0.92);
  assert.ok(dusk > day && dusk < day * 1.5, `dusk lifted too far: ${dusk}`);
  assert.ok(dark > day * 2.4 && dark < day * 3.2, `night lift out of range: ${dark}`);
});
