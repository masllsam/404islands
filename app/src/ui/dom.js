/**
 * A hyperscript small enough to read in one sitting.
 *
 * The app has four views and no reactive state graph worth the name, so it
 * builds real DOM nodes directly. No virtual DOM, no diffing, no framework
 * runtime to download before the first island can appear.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'line', 'rect', 'text', 'polyline',
  'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'ellipse',
]);

/**
 * h('div.card', { onclick }, 'text', child)
 *
 * The tag accepts CSS-ish shorthand: `tag.class.class#id`. Props map to
 * properties where one exists and attributes otherwise, `style` accepts an
 * object, `dataset` accepts an object, and `on*` keys become listeners.
 */
export function h(tag, props, ...children) {
  const [name, ...rest] = String(tag).split(/(?=[.#])/);
  const el = SVG_TAGS.has(name)
    ? document.createElementNS(SVG_NS, name)
    : document.createElement(name || 'div');

  for (const token of rest) {
    if (token[0] === '.') el.classList.add(token.slice(1));
    else if (token[0] === '#') el.id = token.slice(1);
  }

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;

      if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key === 'class' || key === 'className') {
        el.setAttribute('class', value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key in el && !SVG_TAGS.has(name)) {
        el[key] = value;
      } else {
        el.setAttribute(key, value === true ? '' : value);
      }
    }
  }

  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Add a listener and get back a function that removes it. */
export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** Collect teardown functions and run them all once. */
export function disposable() {
  const fns = [];
  const add = (fn) => {
    if (typeof fn === 'function') fns.push(fn);
    return fn;
  };
  add.dispose = () => {
    while (fns.length) {
      try {
        fns.pop()();
      } catch (err) {
        console.warn('teardown failed', err);
      }
    }
  };
  return add;
}

/** True when the visitor has asked the system to calm things down. */
export function prefersReducedMotion() {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
