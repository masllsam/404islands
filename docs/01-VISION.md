# 01 — Vision: The Work Itself

> **Kurzfassung (DE).** 404 nummerierte Objekte. In jedem lebt eine Insel — kein Video,
> keine Animation, sondern eine echte, laufende Simulation aus Geologie, Thermodynamik,
> Hydrologie, Ökologie und Evolution. Sie beginnt bei der Geburt des Objekts und läuft
> weiter, solange es jemanden gibt, der ihr Strom gibt. Sie wird jeden Tag anders sein,
> und niemand — auch wir nicht — weiß, wie sie in vierzig Jahren aussieht. Das Gehäuse
> ist Gold, Emaille, Keramik, Saphir und Edelstein und hält Jahrhunderte. Die Elektronik
> hält das nicht aus und soll es auch nicht: austauschbar, dokumentiert, ein Verschleiß-
> teil. Unvergänglich ist die Zahl — der eingravierte Seed und der veröffentlichte
> Algorithmus. Solange beide existieren, kann die Insel jederzeit exakt neu berechnet
> werden. Das eigentliche Material dieses Kunstwerks ist Mathematik; das Gold ist ihr
> Reliquiar.

---

## 1. One sentence

*404 Islands* is an edition of 404 kinetic sculptures, each containing a living island —
a scientifically-grounded simulation of a real volcanic island's geology, climate, water,
life, and evolution — that begins at the moment of its making and never repeats itself.

## 2. The thesis

**In 1900, the Art Nouveau jeweller looked at a plant and abstracted it by hand into gold
and enamel. In 2026, the plant grows itself, and the object reports what it did.**

The reference image for this work is a plate of Belle-Époque pendants, c. 1895–1910:
demantoid and peridot green, plique-à-jour enamel translucent as a leaf held to the sun,
whiplash gold curves, asymmetric botanical arrangements, seed-pearl dew, drops that swing.
That movement — Jugendstil, Art Nouveau, Modernismo — was the last time European
decorative art took its *structure*, not merely its subject, from living nature: from
tendrils, venation, the growth curves of stems.

It did this by observation and hand. We can now do it by mechanism. The whiplash curve on
our piece is not drawn by a designer imitating a river; it *is* a river, at the position
the stream-power incision law put it after four hundred simulated years of rain that
actually fell because air actually rose over a mountain that is actually there. The
enamelled leaf-forms are the canopy the demography model grew. The cluster of green
stones at the shore is the reef that the coral built as the volcano subsided.

The ornament is not a depiction of nature. It is a *readout* of nature.

## 3. Why Fabergé is the right ancestor

Not because of preciousness. Because of four specific things Fabergé got right:

1. **Total material honesty.** Guilloché under translucent enamel, gold of four colours,
   hardstone carving — every material used for what only it can do. No substitutions, no
   plating, no illusion of a material by another.
2. **The surprise.** The egg opens. Inside is a mechanism — a bird that sings, a coach
   that rolls, a miniature that unfolds. The object rewards the person who goes further.
   Our surprise is that the island is *actually running*, and can be interrogated: touch
   the piece and it will tell you the temperature of its ocean and the name of the
   species that colonised its north ridge last spring.
3. **Singularity.** Each egg was made for one recipient, one occasion. Each of our 404
   islands is one seed, made once, never reissued — and diverges further from every other
   island with each passing day of ownership.
4. **Miniaturisation as wonder.** A whole world in the hand. That instinct is exactly
   right; we are simply able to put more world in it.

Where we depart from Fabergé: his eggs are *finished*. Ours are not, and never will be.
That is the contribution of this century to the form.

## 4. What the owner actually experiences

The piece must reward every duration of attention. This is the central design constraint,
and it maps directly onto the multi-rate architecture (`docs/02-ARCHITECTURE.md`).

| You look for | You see | Driven by |
|---|---|---|
| **10 seconds** | Light. The sun is at a real angle; the colour temperature is the colour temperature of that sun through that atmosphere. Something moves — the sea, a leaf, a drop of enamel-and-gold on its stem. | Real-time render + servo/LED channels |
| **A few minutes** | Weather passing. Cloud building on the windward slope, rain arriving, the light going flat and grey, then breaking. | Atmosphere + orographic precipitation |
| **A day** | A full island year. Seasons swing; the canopy leafs out and senesces; a storm season peaks. | Insolation + phenology |
| **A year** | Succession. Bare lava becomes lichen becomes scrub becomes forest. A lake fills or drains. A river captures its neighbour and abandons a valley. | Landscape evolution + demography |
| **A decade** | Adaptation. The finches on your island are measurably different from the finches you were given. Their beaks have tracked the seeds your climate produced. | Quantitative genetics under real selection |
| **A lifetime** | Geology. The volcano subsides. The fringing reef becomes a barrier reef becomes a lagoon. Your island is turning into an atoll, exactly as Darwin described in 1842, on a schedule your grandchildren will finish watching. | Thermal subsidence + isostasy + reef accretion |

Nobody will see all of this. That is the point. The work is longer than its owner, and
every owner passes on an island in a state no previous owner saw.

## 5. The three layers of permanence

The owner has already named the obvious objection: displays and electronics will not last
three hundred years. Correct. The answer is not better electronics. The answer is to stop
asking the electronics to be the artwork.

### The Vessel — *centuries*
Gold, platinum, fired vitreous enamel, high-purity ceramic, sapphire crystal, gemstones,
hand engraving. Materials with a demonstrated survival record measured in millennia, in
forms conservators already know how to care for. This is the body, and it is built to be
inherited, not maintained.

### The Heart — *decades, by design*
A sealed compute-and-motion module in a **published, standardised socket**: power,
mechanical datum, and a documented signal interface. It is a consumable. It is meant to be
replaced three, five, ten times over the object's life — by us, by a successor
institution, or by a competent engineer in 2180 working from the open specification. Spare
Hearts for all 404 pieces are manufactured with the edition and escrowed. Replacing the
Heart is not damage; it is service, the way a mechanical movement is serviced. The
certificate records every one.

### The Soul — *permanent*
The seed and the algorithm. Each piece carries, physically inside it, a plate bearing:

- the island's **genesis seed** (256 bits),
- the **cryptographic hash of the kernel specification** that defines what that seed means,
- the **edition number** and the date of first ignition,

laser-engraved into synthetic sapphire and, redundantly, hand-engraved into platinum.
The kernel specification itself is published, open, and deposited — with a paper printing
in an archival repository, because ink on cotton rag is currently our best 500-year
storage medium.

**Consequence:** if every one of the 404 objects were destroyed tomorrow, and every server
lost, an island could still be brought back — exactly, to the frame — by someone in the
next century with the plate and the printed specification. The electronics were only ever
a window. The artwork is the number and the law it obeys.

This is the strongest artistic idea in the project and every downstream decision should
protect it.

## 6. Mechanism without power

One further inheritance from Fabergé: at least one thing on the piece must work with no
electricity at all. A spring-driven or gravity-driven element — a tide ring, a turning
armature, a bell — that can be wound by hand and will still function when the Heart is
dead and unreplaced. When a piece is found in an attic in 2231 with no working module, it
should still be able to *move* for the person who finds it, and to point them at the
engraved seed. It is the object's message in a bottle.

## 7. What this is not

- **Not an NFT.** Ownership is a physical object with a physical certificate. Nothing here
  requires a blockchain, and nothing here should acquire one.
- **Not a game.** There is no score, no goal, no progression to complete. The owner
  influences conditions at the margins (see `docs/07`), but cannot win.
- **Not a screensaver.** If the simulation could be replaced by a recording without anyone
  noticing, we have failed. The defence against this is falsifiability: the piece exposes
  its state, its conservation ledger, and its seed. Anyone may recompute it and check.
- **Not decoration that happens to be technical.** The science must be correct where we
  claim it, and explicitly labelled where it is approximate. The catalogue documents every
  approximation. A piece that lies about its physics is a forgery of itself.

## 8. The aesthetic brief, stated plainly

From the reference plate, carried forward as binding art direction:

- **Palette:** demantoid and peridot greens; the old-gold of unpolished 18k; a black
  ground that makes green read as luminous; accents of amethyst violet and rose only where
  the simulation earns them (bloom events, dawn, volcanic glow).
- **Structure:** asymmetric, botanical, growing from one attachment point outward. Nothing
  centred. Nothing gridded. The whiplash curve is the signature line.
- **Light:** plique-à-jour — enamel with no backing, so it is *lit through*, not lit upon.
  Our light sources sit behind the material. This is technically the hardest enamelling
  discipline that exists, and it is exactly right: it makes the piece's light come from
  inside it, as the island's light does.
- **Movement:** small, slow, pendant. Things that hang and swing. Nothing that whirs.
  Servos must be inaudible and must never twitch; see the rate limits in
  `docs/05-KINETIC-SCORE.md`.
- **Scale:** hand to forearm. Wall-mounted as a framed vertical piece, or table-mounted
  as a viewed-from-above vitrine. Both formats share one Heart specification.

## 9. The collection as an argument

The 404 are not 404 random draws. They are **curated to span the space of possible
islands** (`docs/07-EDITION-PROVENANCE.md`): young shield volcanoes still erupting; mature
high islands with deep radial canyons; subsiding islands ringed by barrier reef; near-atolls
with one last basalt peak; cold high-latitude islands; hyper-arid rain-shadow islands;
islands whose evolutionary radiation went strange.

Seen together — and they should be seen together, once, before they disperse — the 404
form a single work: an atlas of what an island can be, computed rather than imagined.

Then they scatter to 404 households and never assemble again, each one quietly continuing
to diverge.
