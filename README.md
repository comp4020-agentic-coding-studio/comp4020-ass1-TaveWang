# The Sun, in Context

**Zoom out until home disappears.**

An interactive explainer built for COMP4020 / COMP8020 Agentic Coding Studio,
Assignment 1. It starts with the Sun filling the screen and lets you pull back,
continuously, to the edge of the observable universe — about 46 billion
light-years — in one uninterrupted movement.

The point of view:

> The Sun only looks like the centre of everything because you haven't zoomed
> out yet — and every step outward trades detail for the context that was
> missing.

## The core interaction contract

This is the one thing the page does, stated plainly enough to test:

> **When the visitor zooms out, the visible radius increases, the Sun and every
> already-visible object shrink toward the centre, and objects belonging to
> larger distance scales become visible. Zooming back in reverses the
> progression exactly. The view stays centred on the Sun's location at every
> scale.**

Each clause is asserted in `spec/interaction.test.tsx`, which drives the real
component through real wheel, keyboard, button and slider events.

## How to use it

| Input | Action |
| --- | --- |
| Mouse wheel / trackpad | Zoom, scoped to the model only |
| Two-finger pinch | Zoom, on the model only |
| `+` `=` `↑` | Zoom in |
| `-` `↓` | Zoom out |
| `Home` / `End` | Jump to the Sun / to the widest scale |
| `Esc` | Close an open details panel |
| Buttons and the range slider | Everything above, without a pointer or a keyboard shortcut |

`Ctrl`/`⌘` + wheel is left alone — that is the browser's own accessibility
zoom, and the page never takes it.

Every labelled object is a real `<button>`: `Tab` reaches it, `Enter` opens its
details, and closing returns focus to where it was. Nothing essential is
pointer-only or hover-only.

## What it is honest about

The genre makes it very easy to lie by omission, so the page says the following
out loud, in the **Method & scale** disclosure and in each object's details:

- **Zooming is logarithmic; the picture is not.** Within any single view,
  distances from the Sun are drawn strictly to scale, so what you see at any
  instant is a true-to-scale map. Only the act of zooming is compressed.
- **A marker's size means nothing physical.** Below a few pixels a body is
  drawn as a fixed-size marker. The Sun becomes a "you are here" marker at
  exactly the scale where drawing it to scale would make it invisible — it is
  never falsely enlarged.
- **This is a distance model, not a sky map.** Radial order and distance from
  the Sun are accurate. The direction each object is drawn in was chosen to keep
  labels legible, and every object whose bearing is invented says so.
- **Planet positions use each orbit's semi-major axis** — a static explanatory
  arrangement, not a live ephemeris.
- **The Solar System has no single edge.** The heliopause, the gravitational
  reach of the Sun and the hypothesised Oort Cloud are three different ideas,
  and the page treats them as three different ideas.
- **Faint background stars are illustrative texture** and are never labelled.
  Every named object is sourced.

## Photographs

Nine real NASA photographs — the Sun and all eight planets — each cropped to a
square and stored under `public/images/objects/` (272 KB for the set). They
appear in three places, and deliberately not in a fourth:

- **On the map, the Sun only.** It is the one object whose true angular size
  ever exceeds a few pixels, so it is the only one that can carry a photograph
  honestly. Its image is scaled so the *photosphere* lands exactly on the
  computed radius — the frame also contains corona and black margin, and
  drawing the frame to that radius would understate the Sun while looking
  perfectly plausible.
- **In every label**, as a 24 px circular thumbnail beside the name.
- **In every details panel**, at a readable size with its credit and the date
  it was read.

Planets are never drawn to scale anywhere in the zoom range — Earth's true
radius never exceeds a fiftieth of a pixel — so a photograph placed at a
planet's position on the map would be a claim about its size, and a false one.
The markers stay dots, and the **Method & scale** disclosure says why.

## Data

28 curated objects in `src/data/cosmos.ts`. Every figure was read off a page
fetched during development — NASA, NASA/JPL, NASA's Imagine the Universe, and
one peer-reviewed paper for Laniakea — never recalled from memory. Each record
carries its source URL and the date it was read, plus an uncertainty note
wherever the number is an estimate, a convention or an inference.

Distances are stored canonically in kilometres; display units (AU, light-years)
are derived. Nothing is laid out from a formatted string.

Three objects were researched and deliberately left out. Voyager 1, because
NASA's tracker gives its distance from *Earth* and this map is Sun-centred.
Barnard's Star and Sirius, because no reachable NASA or ESA page stated their
distances during development, and an unsourced number does not ship.

## Running it

```sh
mise install
pnpm install
pnpm dev            # local dev server
pnpm check          # typecheck, build, lint, and the whole spec
pnpm build          # produce dist/, which is what deploys
```

`pnpm check` is the same roster CI runs, minus the link check, the secret scan
and the deploy. Run `pnpm dlx linkinator ./dist --silent` against a fresh build
to reproduce the link check locally.

## Tests

- `spec/invariants.test.ts` — shipped with the template: language, title,
  viewport, landmarks, one `h1`, alt text. Runs against `dist/`.
- `spec/assignment-1.test.ts` — this page's contract in the **built** HTML: the
  opening state, real controls, the whole journey present as text before any
  JavaScript runs, the honesty disclosures, GitHub Pages subpath safety.
- `spec/interaction.test.tsx` — the zoom contract as behaviour, driven through
  real events in a DOM.
- `spec/dataset.test.ts` — the data and the maths: unique ids, ascending
  distances, a dated source for every claim, a separate citation for every
  radius, uncertainty notes where they are required, label collision, and the
  unit-transition policy.

## Reference interfaces

The interaction was informed by [TheSkyLive's 3D Solar System
Viewer](https://theskylive.com/3dsolarsystem) (camera anchoring, orbit lines as
spatial context) and [NASA's Eyes on the Solar
System](https://eyes.nasa.gov/apps/solar-system/) (continuous camera scaling,
semantic labels, object focus). Both were opened and driven in a browser during
design.

The implementation, artwork and data model here are original. No code, assets,
branding or layout was taken from either. Two things were taken as *inversions*:
NASA Eyes never tells you what scale you are looking at, so the scale readout is
this page's thesis rather than its decoration; and it paints every label into a
canvas where a screen reader cannot reach them, so every label here is real DOM.
