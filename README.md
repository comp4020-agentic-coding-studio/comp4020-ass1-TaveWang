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

On a phone the controls are a sticky bar at the foot of the model, so zooming
never requires scrolling to find the controls first; it releases once the model
is scrolled past, rather than riding over the reading sections. When the inner
planets compress into the middle of the frame they are labelled once, as **Inner
planets**, naming the members — four labels fighting over eighty pixels tell a
reader less than one does. Reaching the widest scale shows the page's closing
point inside the model, with a **Return to the Sun** action.

The full text journey is still shipped in the built HTML, collapsed behind a
**Read the journey as text** disclosure so it no longer sits between the reader
and the end of the page. The nav link opens it.

## What it is honest about

The genre makes it very easy to lie by omission, so the page says the following
out loud, in the **Method & scale** disclosure and in each object's details:

- **Zooming is logarithmic; the picture is not.** Within any single view,
  distances from the Sun are drawn strictly to scale, so what you see at any
  instant is a true-to-scale map. Only the act of zooming is compressed.
- **Bodies are drawn as symbols, not at their true size.** No planet is ever
  close to drawable to scale — Earth's true radius never exceeds a fiftieth of a
  pixel here. A symbol is the body's real radius on a logarithmic rank, times
  one factor shared by the whole planetary system. Because the factor is shared
  it cancels out of any comparison, so **a larger world is never drawn smaller
  than a smaller one**, and the Sun is always drawn largest. The shared factor
  is what makes the system arrive at full size and then shrink together toward
  the centre; it depends only on how far out you have zoomed, so nothing at the
  centre resizes when a planet crosses the rim. The ranking is compressed —
  Jupiter is 11 times Earth's radius and drawn about 1.5 times its symbol — so
  it is an order, not a ratio, and the page says so.
- **The orbits are real.** True ellipses with the Sun at one focus, computed
  from JPL's J2000 Keplerian elements, each on its own inclined plane, with each
  planet at its actual 1 January 2000 position. One epoch, computed once — not
  an ephemeris, and not today's sky.
- **The planets' plane is drawn at an angle**, so their real inclinations are
  visible. Shells — the heliopause, the Oort Cloud, the horizon — stay circular,
  because a sphere's outline is a circle from every angle.
- **This is a distance model, not a sky map.** Radial order and distance from
  the Sun are accurate. The direction each object is drawn in was chosen to keep
  labels legible, and every object whose bearing is invented says so.
- **The Solar System has no single edge.** The heliopause, the gravitational
  reach of the Sun and the hypothesised Oort Cloud are three different ideas,
  and the page treats them as three different ideas.
- **The camera radius is not the observable horizon.** The widest view reaches
  about 53 billion light-years because the horizon circle has to fit inside the
  frame with room to label it; the horizon itself is about 46 billion. Whenever
  the camera is outside it, the readout says which number is which rather than
  letting one be read as the other.
- **The horizon is not "as far as light has had time to travel."** That distance
  is about 13.8 billion light-years. 46 is where the emitting matter is *now*:
  space expanded while the light was in transit and carried its source outward.
- **Faint background stars are illustrative texture** and are never labelled.
  Every named object is sourced.

## Photographs

Seventeen real NASA photographs — the Sun, all eight planets, both Magellanic
Clouds, Andromeda, Triangulum, the Virgo Cluster, the Helix Nebula, Tycho's
supernova remnant and Alpha Centauri — each cropped square and stored under
`public/images/objects/` (about 750 KB for the set). They appear in two places:

- **On the map**, textured onto each body's symbol once that symbol is more
  than about seven pixels across. The Sun's is scaled so the *photosphere*
  lands on its computed radius — the frame also contains corona and black
  margin, and drawing the frame to that radius would understate the Sun while
  looking perfectly plausible.
- **In every details panel**, at a readable size with its credit and the date
  it was read.

Because a symbol is sized by prominence rather than by real size, putting a
photograph on it makes the encoding more legible, not less — you can see *which*
object it is — but it makes the size disclosure load-bearing. The **Method &
scale** section states it in full.

Several of the deep-sky images are infrared or ultraviolet — WISE, Spitzer,
GALEX — which is how those objects were actually observed. Each alt text says
so. The Galactic Centre is the one named object with no photograph: the best
candidate turned out to be an artist's impression, and an illustration
presented as an observation is worse than no picture at all.

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

```sh
pnpm build && pnpm check:viewports
```

`check:viewports` is the pre-ship gate for everything a layout engine is needed
to see. It serves `dist/`, drives the real zoom through fourteen scales at
1920×1080 and 390×844, and asserts no horizontal overflow, no console errors,
44px controls, and that no two **rendered** label boxes overlap. jsdom cannot do
any of that — it has no layout, so every measurement is zero. It is kept out of
`pnpm check` and CI on purpose: it needs a browser binary, and a flaky download
should not block the deploy over a rendering check.

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
  radius, uncertainty notes where they are required, real orbits (Sun at a
  focus, epoch positions inside perihelion/aphelion), symbol sizing, label
  collision, and the unit-transition policy.
- `scripts/check-viewports.mjs` — the rendered-layout checks, run before
  shipping rather than in CI (see above).

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
