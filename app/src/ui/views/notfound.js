/**
 * Not found.
 *
 * A project called 404 Islands has exactly one chance to get this page right.
 */

import { h, clear } from '../dom.js';
import { colophon } from '../components.js';

export function notFound(app) {
  return (context, outlet) => {
    clear(outlet);
    app.stage.detach();

    // If someone asked for an island by a number outside 1–404, say so
    // specifically rather than generically.
    const asked = /\/island\/(\d+)/.exec(context.path);
    const number = asked ? Number(asked[1]) : null;

    outlet.appendChild(
      h(
        'div.notfound',
        h('h1', '404'),
        h('h2', { style: { fontSize: 'clamp(1.2rem, 3vw, 2rem)' } },
          number !== null
            ? `There is no island No. ${number}.`
            : 'There is no such place.'),
        h('p.dim', { style: { margin: '0 auto', maxWidth: '44ch' } },
          number !== null
            ? 'The atlas contains exactly four hundred and four islands, numbered 1 through 404. That number is not among them.'
            : 'The atlas contains exactly four hundred and four islands. This is not one of them — which, given the name, is the only honest thing this page could say.'),
        h(
          'div',
          { style: { display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' } },
          h('a.button.button--primary', { href: '#/atlas' }, 'Open the atlas'),
          h('a.button', {
            href: `#/island/${1 + Math.floor(Math.random() * 404)}`,
          }, 'Take me anywhere')
        )
      )
    );
    outlet.appendChild(colophon());

    return () => {};
  };
}
