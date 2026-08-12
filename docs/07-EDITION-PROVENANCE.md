# 07 — The Edition: Curation, Ignition, Ownership, Provenance

---

## 1. Why 404

The number is inherited from the project's origin and it has earned its place: *404 — not
found*. These islands are not found. There is no coordinate at which they exist. They are
computed into being and they are, each of them, the only instance.

Fixed at 404. Never extended, never "second series", never an open edition in another
format. If the studio wants to make something else later, it must be something else.

## 2. Curation: 404 chosen from millions

The seeds are not drawn at random and shipped. Studio tooling (`studio/`) runs a large seed
search — target ≥ 10⁶ candidates, each integrated forward far enough to characterise it —
and scores each on a **descriptor vector**:

| Axis | Range spanned |
|---|---|
| Edifice volume & summit elevation | seamount-shallow → 4 km high island |
| Latitude / climate zone | equatorial wet → subtropical arid → cool temperate → subpolar |
| Volcanic stage at ignition | actively erupting → post-shield → deeply eroded → subsided |
| Reef state | none (too cold) → fringing → barrier → near-atoll → atoll |
| Ruggedness / drainage development | smooth young shield → deep amphitheatre canyons |
| Orographic contrast | uniform → 20× windward:leeward |
| Substrate age & nutrient state | N-limited young → peak fertility → P-limited retrogression |
| Biotic richness & radiation | depauperate → rich → active adaptive radiation |
| Rare structural features | flank collapse scar, crater lake, sea arch, tombolo, isolated stack |
| Deep-time trajectory | where it will be in 50 / 200 / 1000 real years |

Selection then **maximises coverage of that space** — a farthest-point / determinantal
selection, not a top-404-by-beauty ranking. The edition must be an *atlas*, so it must
include the austere, the arid, and the nearly-drowned. A collection of 404 lush green
paradises would be a decorating scheme, not a work.

Final selection is curated by hand from a shortlist of ~2,000. Studio judgement is
recorded and published per piece: **why this island is in the edition.**

### 2.1 Rarity is a physical fact, not a marketing table

There is no rarity tier. Some configurations are simply uncommon in the space of possible
islands, and the catalogue states honestly how uncommon:

- *Of 1.2 million candidate islands, 31 developed a flank-collapse amphitheatre with a
  surviving crater lake. Three are in the edition.*

That statement is checkable — the search is reproducible from published parameters — and it
is a far better claim than any assigned scarcity. The collector can verify their own
island's rarity by rerunning the search.

### 2.2 What is still to come

An island's *future* is also curated, and deliberately unequal:

- Some pieces will complete Darwin's sequence to atoll within 150 real years.
- Some will have their first speciation event in year 3; some not until year 60; a few
  never.
- One or two will, with high probability, lose most of their biota to a caldera collapse in
  the owner's lifetime. Those owners will be told. They will still want them — the
  destruction of a world you own, on a schedule, watched in real time, is not a defect.

Predicted trajectories are computed and sealed at ignition, deposited with the trust, and
opened only for verification. The studio knows. The owner is told the shape, not the
schedule.

## 3. Ignition

Each piece has one moment of origin, and it is a ceremony with cryptographic meaning:

1. The genesis seed is generated and **committed** (hash published) before the piece is
   built. It cannot be swapped later.
2. The seed and the kernel-spec hash are engraved into the sapphire Soul plate and the
   platinum plate, both installed inside the vessel.
3. The Heart is fitted, and the island is started — `tick 0` — in the presence of the
   owner where possible, and witnessed.
4. `tick 0`, the frame hash at tick 0, the kernel version, the Kinetic Score version, and
   the timestamp go onto the certificate and into the trust deposit.

From that moment the island runs. It has been running ever since. That sentence is the
object's whole claim, and it must be literally true — which is why pauses are logged, and
why the log is part of the record. **An island's cumulative uptime is a real property of
it.** An island that has been left switched off for ten years is a different, and lesser,
island than one that has not. This is stated openly rather than hidden.

## 4. What the owner can and cannot do

| Owner may | Owner may not |
|---|---|
| Pause and resume (logged) | Alter state, terrain, or organisms |
| "Witness" — project forward to look ahead (logged, non-canonical) | Rewind, retry, or branch canonical history |
| Introduce a **propagule** — once per real year, a single colonisation attempt from the source pool | Choose what it becomes, or guarantee it survives |
| Shelter one hectare from fire for one season, once per decade | Prevent eruptions, storms, extinctions, or subsidence |
| Name discovered species and features (naming is metadata, not state) | Change any physical parameter of the world |
| Commission a Recarving every 25 years | Commission a different island |
| Transfer, bequeath, exhibit, sell | Duplicate the piece or its seed |

The design intent: **influence at the margin, authority nowhere.** The owner is a gardener
in a garden that does not need them, and the one real power they have — a single propagule
a year — is exactly the power that shaped every real island on Earth. Introducing a species
to an island is the most consequential thing a person can do to one, and here it costs a
year's patience and cannot be undone.

Every interaction enters the signed input log (`docs/02` §D7), so the island's history
includes the history of its owners. In two hundred years that log will be the most
interesting document attached to the piece.

## 5. The certificate

Not a card. A bound folio, on archival cotton rag with pigment ink, containing:

- Edition number, island name, ignition date and place, witnesses.
- **The genesis seed, printed in full**, in hexadecimal and as a word mnemonic.
- Kernel specification version and hash; Kinetic Score version and hash.
- The complete material inventory and Oddy-test results.
- The curator's statement: why this island is in the edition.
- The rarity statement, with the search parameters needed to verify it.
- Blank ruled pages, bound in, for: service records, Heart replacements, Recarvings,
  transfers of ownership, and the owner's own observations.
- Instructions for recomputing the island from the seed, written for someone with no
  access to us and no knowledge of our technology.

That last item is the certificate's real purpose. It is a set of instructions for
resurrection.

## 6. Provenance and authentication

Four independent layers, no blockchain in any of them:

1. **Physical** — the engraved sapphire and platinum plates inside the vessel; hallmarks;
   the maker's marks.
2. **Documentary** — the folio, countersigned, with the studio's own register.
3. **Cryptographic** — the hash chain over full frames (`docs/04` §3). A piece can be
   challenged to produce a frame; the frame's chain must reconcile with the published
   quarterly Merkle roots. A forgery would have to reproduce the entire computational
   history from the seed — which is possible in principle and enormously expensive in
   practice, and which would in any case require the correct seed.
4. **Behavioural** — the deepest layer. An island is authenticated by *asking it about its
   own past*: what its rainfall was in year 12, when its third species arrived. Only the
   true seed, run for the true duration, answers correctly. **The artwork authenticates
   itself by remembering.**

## 7. Transfer and inheritance

The piece transfers as an object. There is no account, no server dependency, no
subscription, and nothing to renew. It must work with the internet permanently switched
off, and it does — the kernel has no network dependency by construction (`docs/02` §1).

The studio offers, but never requires: registration of the new owner in the register,
service, Recarving, and the printed chronicle. A piece can pass through five generations
without ever contacting us and lose nothing.

## 8. Pricing posture

Not resolved here, and correctly so — but the frame is: the price must be set by the
material, the labour (a plique-à-jour enamelled and gem-set vessel of this complexity is
hundreds of hours of master work), the escrow obligation (spare Hearts, deposits, and a
service commitment measured in decades), and the fact that this is a numbered edition of
404 in the lineage of the Imperial eggs.

Costs that are easy to underestimate and must be carried in the price: the escrow, the
trust, the Recarving obligation, and the studio's own continuity. **Underpricing this work
would be a failure of stewardship, not a kindness.** Whatever cannot be honoured for a
century should not be promised.

## 9. The one exhibition

Before they disperse, all 404 should be assembled once — lit, running, in one room. It will
be the only time in the history of the work that the whole atlas exists in one place.

Photograph it properly. It will not happen again.
