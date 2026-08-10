/**
 * The hyperscript.
 *
 * Every view in the app is built out of this one function, so a fault in it is
 * a fault in everything. It has already had one: `h('div', 'text')` treated
 * the string as a props object, and since `Object.entries('text')` yields
 * `['0', 't']`, it tried to set an attribute named "0" and threw. Every view
 * failed to mount. Nothing in Node caught it, because Node has no DOM.
 *
 * So this file brings a DOM to Node — a small, honest one — and exercises the
 * shapes the views actually use.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The narrowest DOM that can tell the truth about `h()`: enough of Element to
 * distinguish a property assignment from an attribute, and an attribute-name
 * check strict enough to reproduce the original failure.
 */
class FakeNode {
  constructor() {
    this.childNodes = [];
  }
  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join('');
  }
}

class FakeText extends FakeNode {
  constructor(data) {
    super();
    this.data = String(data);
  }
  get textContent() {
    return this.data;
  }
}

/**
 * Which IDL properties each tag really has. `h()` chooses between a property
 * assignment and setAttribute with an `in` check, so the fake has to own the
 * same names the real element would or the test proves nothing.
 */
const IDL = {
  a: { href: '', id: '' },
  input: { value: '', type: 'text', checked: false, placeholder: '', required: false },
  textarea: { value: '', rows: 2, placeholder: '' },
  option: { value: '', selected: false },
  button: { type: 'submit', disabled: false },
  canvas: { width: 300, height: 150 },
  select: { value: '' },
  form: { novalidate: false },
};

class FakeElement extends FakeNode {
  constructor(tagName, namespace = null) {
    super();
    this.tagName = tagName.toUpperCase();
    this.namespaceURI = namespace;
    this.id = '';
    if (!namespace) Object.assign(this, IDL[tagName.toLowerCase()] || {});
    this.attributes = new Map();
    this.listeners = [];
    this.style = {};
    this.dataset = {};
    this.classList = {
      tokens: new Set(),
      add: (...names) => names.forEach((n) => this.classList.tokens.add(n)),
      contains: (n) => this.classList.tokens.has(n),
    };
  }
  setAttribute(name, value) {
    // The real DOM throws InvalidCharacterError here, which is exactly the
    // failure this test exists to catch.
    if (!/^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(name)) {
      throw new Error(`'${name}' is not a valid attribute name.`);
    }
    if (name === 'class') this.classList.add(...String(value).split(/\s+/).filter(Boolean));
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  addEventListener(type, handler) {
    this.listeners.push({ type, handler });
  }
}

let h;
let disposable;
let clear;

before(async () => {
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (data) => new FakeText(data),
  };
  ({ h, disposable, clear } = await import('../app/src/ui/dom.js'));
});

test('a string second argument is a child, not a bag of attributes', () => {
  const el = h('div', 'Now showing');
  assert.equal(el.tagName, 'DIV');
  assert.equal(el.textContent, 'Now showing');
  assert.equal(el.attributes.size, 0);
});

test('a node or an array second argument is also a child', () => {
  const inner = h('span', 'inner');
  assert.equal(h('div', inner).childNodes[0], inner);
  assert.equal(h('div', ['a', 'b']).textContent, 'ab');
  assert.equal(h('div', 42).textContent, '42');
});

test('the tag shorthand assigns classes and an id', () => {
  const el = h('a.button.button--primary#go', { href: '#/atlas' }, 'Enter');
  assert.ok(el.classList.contains('button'));
  assert.ok(el.classList.contains('button--primary'));
  assert.equal(el.id, 'go');
  assert.equal(el.href, '#/atlas');
  assert.equal(el.textContent, 'Enter');
});

test('props become properties where one exists and attributes otherwise', () => {
  const el = h('input', { value: 'x', 'aria-label': 'Search', type: 'search' });
  assert.equal(el.value, 'x');
  assert.equal(el.type, 'search');
  assert.equal(el.getAttribute('aria-label'), 'Search');
});

test('style and dataset take objects', () => {
  const el = h('div', { style: { marginTop: '1rem' }, dataset: { island: '217' } });
  assert.equal(el.style.marginTop, '1rem');
  assert.equal(el.dataset.island, '217');
});

test('on* props become listeners rather than attributes', () => {
  const handler = () => {};
  const el = h('button', { onclick: handler });
  assert.equal(el.listeners.length, 1);
  assert.equal(el.listeners[0].type, 'click');
  assert.equal(el.listeners[0].handler, handler);
  assert.equal(el.getAttribute('onclick'), null);
});

test('null, undefined and false children are skipped, not stringified', () => {
  const el = h('div', null, 'a', null, undefined, false, 'b');
  assert.equal(el.textContent, 'ab');

  // The specific case that used to print the word "null" on most islands.
  const maybe = null;
  assert.equal(h('div', 'name', maybe).textContent, 'name');
});

test('false props are omitted, so selected={false} leaves the default alone', () => {
  const el = h('option', { value: '3', selected: false });
  assert.equal(el.selected, false, 'a false prop must not be written as the string "false"');
  assert.equal(el.getAttribute('selected'), null);
  assert.equal(h('option', { value: '3', selected: true }).selected, true);
});

test('SVG tags are created in the SVG namespace with attributes, not properties', () => {
  const svg = h('svg', { viewBox: '0 0 54 54' }, h('circle', { cx: 27, cy: 27, r: 24 }));
  assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(svg.getAttribute('viewBox'), '0 0 54 54');
  assert.equal(svg.childNodes[0].getAttribute('cx'), '27');
});

test('nested arrays flatten', () => {
  const el = h('div', ['a', ['b', ['c']]], 'd');
  assert.equal(el.textContent, 'abcd');
});

test('clear empties a node', () => {
  const el = h('div', 'a', 'b');
  el.removeChild = function (child) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
  };
  Object.defineProperty(el, 'firstChild', { get: () => el.childNodes[0] });
  clear(el);
  assert.equal(el.childNodes.length, 0);
});

test('disposable runs every teardown once, even if one throws', () => {
  const order = [];
  const add = disposable();
  add(() => order.push('first'));
  add(() => {
    throw new Error('noisy teardown');
  });
  add(() => order.push('last'));

  add.dispose();
  // Teardown runs in reverse, and one failure must not strand the others.
  assert.deepEqual(order, ['last', 'first']);

  add.dispose();
  assert.deepEqual(order, ['last', 'first'], 'teardowns ran twice');
});
