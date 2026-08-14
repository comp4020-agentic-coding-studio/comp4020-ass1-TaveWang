# Process overview

## What I built

"The Sun, in Context" is a zoom explainer with one mechanic: pull back from the
Sun's surface to the edge of the observable universe, continuously, and watch
everything you were just looking at collapse into the centre. The camera is a
single semantic scalar — `logR`, the log of the visible radius in kilometres —
so zooming is logarithmic while the picture never is: within one frame,
distances are drawn strictly to scale. That is what makes the inner planets
genuinely bunch toward the middle as you retreat, rather than being animated
into doing so. Orbits come from JPL's J2000 elements — true ellipses, Sun at a focus, real
inclined planes. The counterpart is that the page must be loud about what it
*isn't*: symbol sizes encode prominence, not size, and the Solar System's edge
depends on which definition you pick.

It replaced an earlier prototype in the same repo, preserved at the
`up-explainer` tag.

## The moments that mattered

**A lint warning about an unused variable was really a warning about a false
citation.** oxlint flagged that my JPL physical-parameters source constant was
imported and never used. The obvious fix was to delete it. Instead I asked why,
and found every planet's *radius* was implicitly cited to JPL's orbital-elements
page — a table with no radii in it, because JPL publishes sizes and orbits
separately. Jupiter's "radius 69,911 km" was sourced to a page that has never
stated it. I added a required `radiusSource` field and a test that fails the
build if any object shows a size without its own citation —
[`9ca4484`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/9ca4484).

**I cut Voyager 1 because including it would have quietly changed what the
number meant.** It is the obvious thing to put at the heliopause. But NASA's
tracker reports its distance from *Earth*, and this map is Sun-centred: the
number would have looked right, sat in the right place, and silently measured
something else. Barnard's Star and Sirius went for a blunter reason — no page I
could reach stated their distances, and an unsourced number does not ship. The
dataset records each omission and why —
[`9ca4484`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/9ca4484).

**A green suite and a stalled animation at the same time.** I had written the
camera's easing loop with `requestAnimationFrame` scheduled inside a `setState`
updater, which reads fine and worked in every reduced-motion test. The one test
that ran with motion enabled failed: the camera stopped at logR 11.8 instead of
reaching 23.7. React may invoke an updater more than once, so scheduling
a frame inside it double-schedules or drops. Moving the eased value to a ref
and the scheduling outside the updater fixed it. I could have raised the
timeout and moved on —
[`1d2122d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/1d2122d).

**I stopped eyeballing screenshots and committed the check instead.** Four
spec lines — no horizontal overflow and visible controls at both marking
viewports, no console errors during the interaction — cannot be asserted in
jsdom, which has no layout engine and returns zero for every measurement. I had been
checking them by hand, which made them as reliable as remembering to. Instead I wrote `scripts/check-viewports.mjs`: it
serves the built site, drives the real zoom through fourteen scales at both
viewports, and measures the *rendered* label boxes. It failed on its first run
with three label collisions, and the cause was a real bug — my collision
estimate modelled a label as one 22-pixel line when it renders as two, because
I had forgotten the category subtitle under the name. Fixing the estimate took
it from three failures to none —
[`ee32b52`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/ee32b52).
