/**
 * Acquisition.
 *
 * This page is where an art project either keeps its integrity or loses it.
 * The rules it follows:
 *
 *   — No manufactured scarcity. Nothing counts down, nothing says "3 left".
 *   — No fake checkout. There is no payment processor connected, so the page
 *     does not pretend to take money; it records an intent and says exactly
 *     that, in the confirmation and on the button.
 *   — No claims that cannot be honoured. What each tier includes is stated
 *     plainly, including the parts that are still to be built.
 */

import { h, clear, disposable, on } from '../dom.js';
import { colophon } from '../components.js';
import * as fmt from '../format.js';
import { getIsland } from '../../core/catalog.js';

const TIERS = [
  {
    id: 'print',
    name: 'The Exposure',
    price: 0,
    cadence: 'Free, always',
    feature: false,
    summary: 'Take the picture with you.',
    includes: [
      'Any island, any moment, exported at 2400 × 1500 as a lossless PNG',
      'The frame is exactly what you were looking at: your camera, that hour’s weather',
      'Yours to print, hang, and use however you like',
      'No account, no email, no reservation needed — the button is on every island',
    ],
  },
  {
    id: 'steward',
    name: 'Steward',
    price: 24,
    cadence: 'Per year',
    feature: true,
    summary: 'One island, listed in your name, watched for a year.',
    includes: [
      'Your name on the island’s page in the atlas, for as long as the stewardship runs',
      'A monthly plotter drawing of your island: pen on 300 gsm cotton, drawn from the ' +
        'terrain data itself, posted to you',
      'An archive of every exposure you export, kept at full resolution',
      'First refusal if the island’s Guardian tier is ever offered',
    ],
  },
  {
    id: 'guardian',
    name: 'Guardian',
    price: 420,
    cadence: 'Once',
    feature: false,
    summary: 'One island, permanently.',
    includes: [
      'Permanent listing as the island’s Guardian — it is not offered again',
      'A single large plotter drawing, 50 × 70 cm, signed and numbered against the ' +
        'island’s catalogue number',
      'A dedicated URL for your island that renders without any of this interface',
      'The island’s full generation parameters, so the work outlives this website',
    ],
  },
];

export function acquire(app) {
  return (context, outlet) => {
    const dispose = disposable();
    clear(outlet);
    app.stage.detach();
    window.scrollTo(0, 0);

    const requestedNumber = Number(context.query.get('island'));
    const requested = getIsland(requestedNumber);

    const islandSelect = h(
      'select',
      { id: 'reserve-island', 'aria-label': 'Island' },
      ...app.islands.map((island) =>
        h(
          'option',
          { value: island.number, selected: requested && requested.number === island.number },
          `No. ${island.id} — ${island.name} (${island.region.name})`
        )
      )
    );

    const tierSelect = h(
      'select',
      { id: 'reserve-tier', 'aria-label': 'Tier' },
      h('option', { value: 'steward' }, 'Steward — €24 / year'),
      h('option', { value: 'guardian' }, 'Guardian — €420 once')
    );

    const emailInput = h('input', {
      id: 'reserve-email',
      type: 'email',
      required: true,
      autocomplete: 'email',
      placeholder: 'you@example.com',
    });

    const noteInput = h('textarea', {
      id: 'reserve-note',
      rows: 3,
      placeholder: 'Anything you want us to know (optional)',
    });

    const error = h('div.form__error', { role: 'alert' });
    const submit = h('button.button--primary', { type: 'submit' }, 'Reserve — no payment taken');
    const result = h('div');

    const form = h(
      'form.form',
      { novalidate: true },
      h('div.form__row', h('label', { for: 'reserve-island' }, 'Island'), islandSelect),
      h('div.form__row', h('label', { for: 'reserve-tier' }, 'Tier'), tierSelect),
      h('div.form__row', h('label', { for: 'reserve-email' }, 'Email'), emailInput),
      h('div.form__row', h('label', { for: 'reserve-note' }, 'Note'), noteInput),
      error,
      submit
    );

    dispose(
      on(form, 'submit', async (event) => {
        event.preventDefault();
        error.textContent = '';

        const email = emailInput.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          error.textContent = 'That email address does not look right.';
          emailInput.focus();
          return;
        }

        submit.disabled = true;
        submit.textContent = 'Recording…';
        try {
          const response = await fetch('/api/reserve', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              island: Number(islandSelect.value),
              tier: tierSelect.value,
              email,
              note: noteInput.value.trim(),
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Could not record that.');

          form.hidden = true;
          result.replaceChildren(
            h('div.notice.notice--good', [
              h('strong', 'Recorded. '),
              payload.message,
            ])
          );
          result.scrollIntoView({ block: 'center' });
        } catch (err) {
          error.textContent =
            String(err.message) === 'Failed to fetch'
              ? 'No connection to the reservation service. Nothing was recorded.'
              : String(err.message);
        } finally {
          submit.disabled = false;
          submit.textContent = 'Reserve — no payment taken';
        }
      })
    );

    outlet.appendChild(
      h(
        'div',
        { style: { paddingTop: '4.6rem' } },
        h(
          'section.section',
          h('div.label.section__label', 'Acquisition'),
          h('h1', { style: { maxWidth: '18ch' } }, 'An island is a thing you can keep.'),
          h('p.lede', { style: { marginTop: '1.5rem' } }, [
            'The renders are free and always will be — the export button on every ',
            'island page has no gate behind it. What is for sale is the other half: ',
            'a permanent claim on one of the 404, and something physical that comes ',
            'off a plotter and arrives in the post.',
          ]),

          requested
            ? h('div.notice', [
                h('strong', `You came here from No. ${requested.id}, ${requested.name}. `),
                `${requested.archetype.name} in the ${requested.region.name}, at ${requested.coordLabel}. `,
                h('a', { href: `#/island/${requested.number}` }, 'Go back and look at it again.'),
              ])
            : null,

          h('div.tiers', ...TIERS.map(tierCard)),

          h('div.notice', [
            h('strong', 'What happens when you press the button. '),
            'Your email, the island and the tier are written to a file on the server. ',
            'No card details are requested, no payment processor is connected, and ',
            'nothing is charged — not now and not silently later. Someone writes back ',
            'to arrange the rest. If that is not what you expected from a page with ',
            'prices on it, that is the point.',
          ]),

          h('div.label', { style: { marginTop: '3rem' } }, 'Reserve'),
          form,
          result
        ),
        faq(),
        colophon()
      )
    );

    return dispose.dispose;
  };
}

function tierCard(tier) {
  return h(
    `div.tier${tier.feature ? '.tier--feature' : ''}`,
    h('div.tier__name', tier.name),
    h('div', { class: 'dim', style: { fontSize: '0.88rem' } }, tier.summary),
    h('div.tier__price', tier.price === 0 ? 'Free' : fmt.money(tier.price)),
    h('div.tier__cadence', tier.cadence),
    h('ul', ...tier.includes.map((item) => h('li', h('span', item)))),
    tier.price === 0
      ? h('a.button', { href: '#/atlas' }, 'Find one you like')
      : h('a.button', { href: '#reserve' , onclick: (e) => {
          e.preventDefault();
          document.getElementById('reserve-email')?.focus();
          document.querySelector('.form')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } }, 'Reserve')
  );
}

function faq() {
  const entries = [
    [
      'Is the island really mine?',
      'You get a permanent listing in the atlas and the physical work. You do not ' +
        'get a deed, a token, or a legal interest in anything — none of those would ' +
        'be true, so none of them are offered.',
    ],
    [
      'What if the site disappears?',
      'Every island is reproducible from its seed and the generation parameters, ' +
        'both of which are shown on the island’s own page. The Guardian tier includes ' +
        'them in writing. The work does not depend on this server continuing to exist.',
    ],
    [
      'Where does the weather come from?',
      'Open-Meteo, an open meteorological API, licensed CC BY 4.0. When it cannot be ' +
        'reached, the atlas falls back to a physical model of climate from latitude, ' +
        'season and hour — and labels every reading as modelled while it does.',
    ],
    [
      'Can I sell the exposures I export?',
      'Yes. The renders you export are yours, with no conditions attached. The ' +
        'generator itself is MIT licensed; you are welcome to run your own atlas.',
    ],
  ];

  return h(
    'section.section',
    h('div.label.section__label', 'Straight answers'),
    h(
      'div',
      { style: { display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } },
      ...entries.map(([question, answer]) =>
        h('div', h('h3', { style: { marginBottom: '0.7rem' } }, question),
          h('p', { class: 'dim', style: { fontSize: '0.9rem' } }, answer))
      )
    )
  );
}
