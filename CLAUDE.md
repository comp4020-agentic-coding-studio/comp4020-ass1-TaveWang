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

## This week (UP): decisions worth carrying forward

No React island this week — the only thing tracking live state is the HUD's
scroll position, and nothing else needs to read it, so a plain
`<script type="module">` (`src/scripts/hud.ts`) beats paying hydration cost
for zero cross-component sharing. If a future week's brief needs two things
to react to the same live value, that's when `useSyncExternalStore` earns
its keep again, not before.

**Distance mapping is driven by measured anchors, not assumed section
height.** The first version of `distanceAtScroll` assumed every milestone
sat at a uniform `i * sectionPx` — wrong the moment sections have different
amounts of content (a note, a sourced fact, an air-composition list). Fixed
by measuring each `.milestone`'s real `getBoundingClientRect().top +
window.scrollY` from the live DOM (`src/scripts/hud.ts`) and interpolating
between those measured anchors (`distanceAtPosition` in `src/lib/scale.ts`),
re-measuring on `resize`. Don't reintroduce a fixed-height assumption here —
it'll drift the instant the copy changes.

**Never hijack scroll.** The HUD only reads `window.scrollY` on a passive,
`requestAnimationFrame`-throttled `scroll` listener — nothing calls
`preventDefault()` or intercepts the wheel/touch/keyboard. Keyboard
operability (`PageUp`/`PageDown`/`Space`/`Home`/`End`/arrows) falls out of
that for free, because it's the browser's own native scrolling, not a
library reimplementing it. Keep it that way even if a future pass wants
snappier per-section transitions.

**Past the Moon, "distance from Earth" stops being a stable number** — Earth
and every other planet both orbit the Sun, so there's no fixed "how far from
Earth" for Mars onward. Mercury and Venus are omitted from the milestone
sequence entirely (they orbit closer to the Sun than Earth does, so there's
no outward-increasing number for them either), and Mars onward switches to
mean distance from the Sun instead — disclosed via the `note` field on the
milestones where the reframe happens, same as the log-scale-compression
notice. If next week's data has a similar "the metric quietly changes
meaning partway through" seam, disclose it the same way rather than picking
a number that reads clean but means something different than the reader
assumes.

**Astro inlines small stylesheets into a `<style>` tag instead of always
emitting `dist/_astro/*.css`.** A CSS-presence test that only reads
`_astro/*.css` will pass or fail depending on how big the stylesheet
happens to be that week, for reasons unrelated to whether the CSS rule
actually exists. `spec/assignment-1.test.ts`'s `cssFiles()` helper reads
both the external files and every parsed page's inline `<style>` tags —
copy that pattern rather than re-deriving it if a future CSS-content test
hits the same false negative.

**The CI link check (`linkinator`) is CI-only — `pnpm check` doesn't run it —
so a broken/blocked external link only surfaces after shipping, not during
local iteration.** First `/ship` run 403'd on `noaa.gov` from the GitHub
Actions runner's IP; the same URL returns 200 to a normal browser UA. That's
bot-blocking on NOAA's end, not a dead citation, so `.github/workflows/checks.yml`
treats 403 as `warn` rather than a failure (`--status-code "403:warn"`) —
confirmed by hand first, since a blanket skip would also hide a genuinely
dead link going forward.

**The HUD is `aria-hidden`, not `aria-live`.** It first shipped as
`aria-live="polite"`, which sounded right — announce the distance as it
changes — until it was obvious that "as it changes" means every animation
frame during a scroll, which would flood a screen reader with updates
several times a second. The distance and milestone facts are already in the
accessible document flow as ordinary headings and paragraphs, in the same
order a sighted user scrolls through them, so the HUD is a sighted-only
convenience layer, not new information — hiding it from assistive tech
avoids the spam without losing any content. If a future live-updating
readout is genuinely the only place some information lives, it needs a
coarser update strategy (e.g. only announce on milestone-entry, not every
frame), not a bare `aria-live="polite"` on a per-frame value.

**A focusable control can't live inside an `aria-hidden="true"` ancestor —
adding the draggable distance scrubber meant splitting the HUD in two.**
The HUD div itself used to carry `aria-hidden="true"` on the whole thing
(readout text and all, per the decision above). Once the scrubber
(`<input type="range" data-testid="scrubber">`) needed to sit in that same
box, `aria-hidden` had to move down onto just the `.hud__readout` `<p>` —
a real interactive control must never be nested under `aria-hidden="true"`,
since that hides it from assistive tech while leaving it reachable by
sighted keyboard tabbing, a broken combination. The scrubber gets its own
`aria-label` instead and is a native `<input type="range">` rather than a
styled div, so dragging, arrow keys, Home/End, and Page Up/Down all work
without any custom key handling — same "native control, not a
reimplementation" rule as the restart link and the no-scroll-hijacking
decision above. Wiring reuses the existing scroll/render pipeline rather
than duplicating distance math: the scrubber's `input` handler calls
`window.scrollTo()` (via `positionForPercent` in `src/lib/scale.ts`), which
re-triggers the same passive `scroll` listener and `render()` already
driving the readout, and `render()` sets the scrubber's `.value` from
`percentForPosition()` so it stays in sync during ordinary scrolling too —
one source of truth for scroll↔distance↔percent, not three.

**A CSS width fix worth remembering: giving `.hud` a fixed width broke text
wrapping before it broke anything else.** Adding the scrubber meant giving
`.hud` an explicit `width` (needed so the range input has something stable
to be 100% of) instead of the old auto-sized-to-content box. That
immediately wrapped the longest readout strings ("111 million km" /
"INTERPLANETARY SPACE") into an ugly multi-line mess, because the old
`.hud__readout` was a `flex-direction: row` with `align-items: baseline` —
fine when the box could grow to fit, wrong once the box has a fixed width.
Fixed by stacking `.hud__readout` as a column instead of a row. Caught by
actually screenshotting both marking viewports after the change, not by
`pnpm check` (no test asserts wrapping) — a reminder that a passing test
suite and a correct-looking layout are different claims.

**Illustrations were later replaced with real photos, self-hosted, one per
milestone — and that's the one place `Milestone` does carry a presentation
field.** The SVG icons above were dropped entirely (not kept alongside) in
favour of real NASA/JPL photographs, at the user's explicit request. All 12
are U.S. federal government work (public domain, 17 U.S.C. § 105), each
resolved to a concrete direct-download URL via `WebFetch` against its real
`science.nasa.gov` / `nasa.gov` / `svs.gsfc.nasa.gov` landing page — never
guessed from memory — then downloaded once and resized/recompressed locally
with `sips -Z 1000 -s format jpeg -s formatOptions 65` (the only image tool
available; no `cwebp`/imagemagick) into `public/images/milestones/<id>.jpg`,
landing at roughly 30–200KB each rather than hotlinking. One candidate
(Jupiter, originally Voyager 1's PIA00454) was rejected after visually
inspecting the downloaded file: it was a 2×2 grid of four small rotation
frames, not a single disk, which would have cropped badly under
`object-fit: cover`. It was swapped for Cassini's single-frame "Jupiter
Portrait" (PIA04866) instead — a reminder that a URL returning 200 with
plausible dimensions doesn't guarantee the image is fit for its slot; open
it and look.

The "the higher you go, the more Earth's curve and then its shrinking disk
show" narrative the user asked for is carried by **which photo** is chosen
per milestone (ground horizon → ISS limb shot → full Earth-orbit shot → full
planetary disks → Voyager's actual Pale Blue Dot), not by a fake blur filter
simulating atmosphere — a documentary photo already looks different at each
altitude/distance without needing to be lied to.

**Photos later moved from a small boxed image above the text to a
full-bleed, edge-to-edge section background, with the fade made continuous
and reversible instead of a one-shot reveal.** The user asked for this
explicitly ("borderless", "the photo should be the background of each
stage", fading as you scroll up *and* down, not just fading in once and
staying). To go full-bleed, the 40rem reading-column constraint moved off
`main` and onto the three non-milestone sections (`.intro`, `.outro`,
`[data-testid="sources"]`) individually, so `.milestone` sections (still
plain block children of `main`, still in normal flow — `hud.ts`'s
`getBoundingClientRect()` anchor measurement is unaffected) can span the
full viewport width with no `100vw`/negative-margin breakout hack, which
would otherwise be thrown off by `main`'s own padding. Each milestone photo
is now `position: absolute; inset: 0` inside a `position: relative`
`.milestone`, with a fixed (non-animated) dark gradient `.milestone__scrim`
on top of it for text contrast regardless of the photo's own brightness,
and the text itself in a `.milestone__content` div that keeps the 40rem
column and stacks above both via `z-index`. Because contrast is now
guaranteed by the scrim rather than by a per-category foreground color, the
four `.milestone[data-category="..."] { color: ... }` rules and the
orbit/solar-system/interstellar link-color override were deleted — milestone
text is uniformly light-on-scrim now.

The reveal script (`src/scripts/photo-reveal.ts`) was rewritten from a
one-shot `IntersectionObserver` (add `.is-visible`, `unobserve`, done
forever) to a continuous, reversible, scroll-position-driven opacity: a
passive, `requestAnimationFrame`-throttled `scroll` listener (same
throttling pattern as `hud.ts`, but a fully separate listener with no shared
state — still true after this rewrite) computes each section's distance
from the viewport's vertical center on every frame and sets that photo's
`opacity` proportionally, fading toward (never fully down to) a minimum as
the section scrolls away in *either* direction. Under `prefers-reduced-motion:
reduce` the script attaches no listener at all and never touches `opacity`,
so photos render at their CSS default (fully opaque) with zero motion —
deliberately not relying on the sitewide zeroed-transition-duration rule to
mask a moving state, same reasoning as before.

`photoAlt: string` is the one new field added to `Milestone`, and
deliberately breaks the "no presentation field on Milestone" rule the old
icon mapping followed. That rule was about not coupling data to a *visual
component* (which icon to render); alt text isn't presentation, it's
accessible content — a real documentary photo is something a screen-reader
user should get described, unlike the old decorative SVGs, which is also why
the `<img>` now carries a real `alt` instead of `aria-hidden="true"`.

**The background is one continuous gradient on `body`, not per-category
opaque blocks — and its percentage stops are a static guess, not
scroll-synced.** `.milestone[data-category="..."]` and
`.outro`/`[data-testid="sources"]` used to each set an opaque `background`,
producing a hard color cut at every category boundary. Now only `color` is
set per category, and `body` carries one `linear-gradient` spanning the
full document height, with stops chosen proportionally to how many
milestones fall in each category (intro + 3 atmosphere ≈ 0–25%, 2 orbit ≈
25–41%, 6 solar-system ≈ 41–83%, interstellar tail ≈ 83–100%). This is
deliberately approximate — no JS, no scroll-position math, zero risk to
`src/scripts/hud.ts` — consistent with the page's own theme that scroll
position and true distance already diverge without being hidden. If a
future edit adds/removes milestones and shifts how many fall in each
category, nudge these percentages by hand; nothing will fail loudly if they
drift, since there's no test tying a gradient stop to a milestone count.
Since milestone sections went full-bleed with photo backgrounds (above),
this gradient is mostly hidden behind those photos now — it still shows
through in the `.intro`/`.outro`/sources gaps and briefly during each
photo's low-opacity moments as a section scrolls away from center.

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
