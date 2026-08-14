# COMP4020 prototype

This is your repo for a COMP4020 prototype: a static site built with **Astro +
React islands**, deployed to GitHub Pages. The **deployed site is what gets
marked** --- not this repo, and not "it works on my machine". It's marked live
in Chrome against the deployed URL at two viewports --- 1920×1080 (desktop) and
390×844 (phone) --- and both count in full, so make that artefact good at both
and use the checks below to know whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `astro check` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. (It replaced `tsc --noEmit`
  when the stack switched to Astro: `tsc` alone does not see inside `.astro`
  files.) The types are extra backpressure: a red here is the compiler telling
  you a claim in the code is false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack: Astro + React islands, and why

The template ships plain HTML/CSS/TypeScript on Vite. Last week's brief needed
real interactivity, so it was swapped for Astro with React islands, and this
deliverable keeps that swap. The contract CI enforces is unchanged: `pnpm build`
emits the whole site into `dist/`, the `check`, `check:evidence` and `build`
scripts keep working, and whatever lands in `dist/` passes `spec/`.

**Never use `client:only`.** The invariants parse the *built* HTML, so they need
`<nav>`, the single `<h1>` and every `alt` to be in the file on disk. Astro
server-renders `client:load` and `client:visible` islands at build time and
hydrates them afterwards, so their markup ships; `client:only` renders nothing
at build and would fail the invariants against an empty shell. This is exactly
why a plain client-side React app is not an option here.

Above the fold is a natural fit for `client:load`; content further down can use
`client:visible`. One consequence when testing: a `client:visible` island is
**not interactive until it is scrolled into view**, so driving it in a browser
needs a `scrollIntoView()` first or the click lands on un-hydrated markup and
silently does nothing.

## Every URL this build emits must be relative

The deployed site lives under a subpath
(`…github.io/comp4020-ass1-TaveWang/`), but CI runs `linkinator ./dist`, which
serves `dist/` at the **root**. No absolute URL satisfies both, and getting it
wrong looks perfect locally while every asset 404s on the live URL.

`astro.config.mjs` handles it with two settings, not with `base`:

- `build.format: "file"` --- pages land flat (`dist/index.html`,
  `dist/whatever.html`), so `./whatever.html` resolves the same from any page,
  and `dist/index.html` stays where `spec/invariants.test.ts` looks for the
  home page.
- `build.assetsPrefix: "."` --- emits `./_astro/x.js` instead of `/_astro/x.js`.

Links you hand-write are still your problem: write `./whatever.html`, never
`/whatever.html`.

**Dynamic routes must stay flat for the same reason.** `assetsPrefix: "."`
resolves against the *page's own directory*, so a nested dynamic route like
`src/pages/thing/[id].astro` would emit `dist/thing/foo.html` looking for
`dist/thing/_astro/…` and 404 every asset on the deployed site --- while working
perfectly in `astro preview` served from the root. Keep dynamic-route output
flat (params baked into the filename, e.g. `src/pages/[slug].astro`) rather than
nested under a directory.

## Islands can't share state without a store

The page is several separate React roots. Component state cannot travel
between them directly --- if two islands both need the same live value (a
count, a selection), reach for a module-level store read through
`useSyncExternalStore` rather than context, since context does not cross a root
boundary. `useSyncExternalStore` needs its third argument (the server
snapshot), or the build-time render throws. (Last week's version of this lives
in `src/lib/store.ts` if useful as a reference, but nothing here is carried
forward automatically --- build this again only if this week's design actually
needs cross-island shared state.)

## This deliverable: "The Sun, in Context"

A Sun-centred zoom explainer. The visitor pulls back continuously from the
Sun's surface to the observable-universe horizon; nothing else happens. The
previous prototype in this repo ("UP", a scroll-driven altitude explainer) was
replaced wholesale rather than kept alongside — the assessment spec asks for
"one strong idea with a point of view, and nothing else", so two explainers on
one site is a mark risk, not a bonus. UP's shipped state is preserved at the
`up-explainer` tag; nothing was lost, and `git show up-explainer:<path>` still
reaches any of it.

### Rules that emerged from building it

**Every astronomical claim cites a page that was actually fetched.** Not
recalled, not inferred from a plausible-looking number. `src/data/cosmos.ts`
carries a source URL and an ISO access date per record, and
`spec/dataset.test.ts` fails the build if either is missing. When a figure
could not be sourced, the object was dropped rather than estimated — Voyager 1
(NASA's tracker gives distance from *Earth*, and this map is Sun-centred, so
including it would silently change what the number means), Barnard's Star and
Sirius (no reachable NASA/ESA page stated a distance during development).

**A body's size is a separate claim from its distance, and needs a separate
citation.** JPL publishes orbital elements and physical parameters as different
tables. This was caught by oxlint, of all things: the physical-parameters
source constant was imported and never used, which meant every planet's radius
was implicitly cited to the elements page — a table containing no radii at all.
The fix was a required `radiusSource` field and a test for it, not deleting the
unused import. A lint warning about an unused variable was really a warning
about a false citation; read what a warning is *pointing at*, not just what it
says.

**Canonical distances are kilometres; every display unit is derived.** Never
lay anything out from a formatted string. The km→light-year switch happens at
exactly one light-year, so the boundary is a fact the page can explain rather
than an arbitrary threshold — see `src/lib/units.ts`.

**Camera state is one semantic scalar, never pixels.** `logR` = log10 of the
visible radius in kilometres. Resizing changes how many pixels a kilometre
gets and nothing else, which is why a rotation or a window drag leaves the
reader exactly where they were. If a resize ever moves the view, something is
deriving position from viewport dimensions — find it.

**Visibility is derived from distance and camera scale, full stop.** No step
counter, no scroll index, no hand-authored "appears at stage 4". The Solar
System collapses into a point because everything in it falls inside the same
few pixels, not because anything was told to disappear. Editorial nudges exist
(`enterAdjust`) but are bounded by a test so they can never reorder the map.

**A marker's size never means a physical size, and the page says so.** Below
`MIN_MARKER_PX` a body is drawn at a fixed size. The Sun becomes a "you are
here" marker at exactly the computed scale where drawing it to scale would make
it invisible — that threshold is derived, not typed in, so it is right at both
marking viewports for free. Never enlarge an object to keep it visible.

**React state updaters must be pure.** The camera ease first shipped with
`requestAnimationFrame` scheduled *inside* a `setLogR` updater. React is free
to call an updater more than once, so the loop could double-schedule or stall:
with motion enabled the camera stopped at logR 11.8 instead of reaching 23.7.
The eased value lives in a ref and the loop schedules itself outside the
updater. A test caught this; a screenshot would not have.

**Test at the aspect ratio that actually ships.** The unit tests assumed a
square-ish stage; the real one is a wide, short band (62vh). A structure's
circle is far smaller there, and the Milky Way fell under the label threshold —
so it went unlabelled inside the scale band named after it, while a
full-viewport test insisted it was fine. `spec/dataset.test.ts` now uses
1920×669 and 390×440, the shipped shapes.

**Label collision estimates must account for the type they are estimating.**
Structure and horizon labels are uppercase and letterspaced, so they are about
45% wider than a character count predicts. THE OBSERVABLE UNIVERSE ran straight
through the Sun's label while the collision pass believed the two were clear.
Estimated boxes are fine — measuring text would mean a layout read per label
per frame — but the estimate has to know about the CSS.

**A cap is not a density rule until it binds.** Mobile had a lower
`maxLabels`, but collisions culled the list long before the cap mattered, so a
390px screen carried the same label load as a 1920px one, just packed tighter.
Phones now demand real clearance around every label. If a limit never fires, it
is decoration.

**One island, not four.** Camera scale and selection are read by the readout,
the labels, the slider and the panel. In separate roots that would need a
module store (see below); in one root it is plain `useState`. Reach for the
store only when something genuinely cannot be one root.

**Symbol size encodes prominence, not size — and that has to be said out
loud.** No planet is ever within a thousand times of being drawable to scale
(Earth never exceeds a fiftieth of a pixel), so a planet's drawn radius is
`SYMBOL_MAX × sizeRank(radius) × prominence(fraction)^0.6`: large on arrival at
the rim, shrinking as the camera leaves it behind, gone when it reaches the
centre. Size rank keeps bodies of genuinely different sizes ordered when they
arrive together; across very different prominences the ordering does NOT hold,
and the Method disclosure states that limit rather than implying a guarantee
the maths does not make. The one relationship that IS enforced, in code and in
a test, is that the Sun is never drawn smaller than any planet on screen — it
is the comparison a reader makes without thinking.

**A photograph can only go where the geometry can carry it.** The user asked
for real planet images. Only the Sun is ever drawn at its true angular size —
every planet stays under a pixel at every scale this page reaches, Earth never
exceeding a fiftieth of one — so a photo textured onto a planet's marker would
have been a size claim of about a thousand times, on a page whose whole subject
is not doing that. The Sun's photograph goes on the canvas, scaled so the
*photosphere* (not the image frame, which includes corona and black margin)
lands on the computed radius; every other photo lives in the label and the
details panel, where it says what a world looks like without saying how big it
is. If a future change wants imagery somewhere new, check what the arithmetic
says the object's size actually is first. (Later revised: once planets were
drawn as prominence-sized symbols rather than dots, their photographs could go
on the map after all — the constraint was never "no photos on planets", it was
"no photo drawn at a size that implies a scale". Label thumbnails were dropped
at the same time, because with the body itself photographed they rendered every
planet twice, a few pixels apart.)

**Orbits come from elements, not from angles.** `src/lib/orbits.ts` implements
JPL's own algorithm over their J2000 Keplerian table, so orbits are true
ellipses with the Sun at a focus, on their real inclined planes, with each
planet at its actual epoch position. Do not replace these with drawn circles or
chosen bearings for convenience; do not advance them with time either, because
a moving epoch would make this an ephemeris and it is not one. The planetary
plane is projected at an angle so the inclinations are visible; shells stay
circular, because a sphere's outline is a circle from every angle and tilting
one would be a nicer picture making a worse claim.

**An image fit for one slot is not fit for another — open it and look.** Six
photographs were recovered from the previous prototype's tag. Two were
unusable: Saturn was Cassini's backlit silhouette and Jupiter was a crescent
clipped by the frame edge. Both were perfect as full-bleed backgrounds and
useless as circular thumbnails. The old CLAUDE.md already carried "a URL
returning 200 with plausible dimensions doesn't guarantee the image is fit for
its slot"; this is the same rule firing when the *slot* changed rather than the
image. Two more, Mars and the Sun, were re-sourced rather than reused because
their original landing pages were never recorded — and citing a recovered file
to a page that does not host it is the same false-citation mistake as the JPL
radius tables above.

**Essential content never lives only in the canvas.** The canvas is
`aria-hidden` decoration. Every label is a real focusable `<button>`, and the
whole journey also ships as an ordered list of text. This is the deliberate
inversion of NASA Eyes, where "SUN" and "Voyager 1" are painted into a canvas
and appear nowhere in the accessible tree — verified by driving it in a browser
and dumping its DOM.

**Never intercept Ctrl/⌘+wheel.** That is the browser's own page zoom. Custom
wheel and pinch handling is scoped to the model element only, never the page.

**Announce scale bands, not frames.** The live region fires only when the
reader crosses into a *named* band. An `aria-live` fed an eased per-frame value
announces several times a second — the same scar this file already carried from
the previous prototype's distance readout, in a new shape.

## stylelint: what I configured and what I left alone

`selector-class-pattern` rejects BEM out of the box. `.stylelintrc.json` widens
it to accept `block__element--modifier` --- that is a naming convention, not a
correctness rule, so it's fine to adjust further if this week's CSS wants a
different convention.

`no-descending-specificity` is left **on**, and is not to be disabled or worked
around by shuffling blocks. When it fired last week on several near-identical
rules, the fix was one shared class. Fix it by naming, every time; reordering
just flips which selector it complains about.

## The rendered page is the truth

Last week the source read fine and the page was broken --- visual overflow, and
a text node collapsing to nothing because a newline between two inline elements
disappears in the render. Neither shows up in the DOM and neither fails a test.

Before claiming a visual change works, build it, serve it, and screenshot it at
**1280** and **390×844** --- both viewports are marked in full. `agent-browser`
does this well; note that it resets the shell's working directory, so `cd` back
into the repo before running `pnpm` afterwards.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.
