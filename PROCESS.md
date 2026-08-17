# Process overview

## What I built

"The Sun, in Context" is a zoom explainer with one mechanic: pull back from the
Sun's surface to the observable universe, continuously, and watch everything you
were just looking at collapse into the centre. The camera is a single semantic
scalar — `logR`, the log of the visible radius in kilometres — so zooming is
logarithmic while the picture never is: within one frame, distances are drawn
strictly to scale. That is what makes the inner planets genuinely bunch toward
the middle as you retreat, rather than being animated into doing so. Orbits come
from JPL's J2000 elements. The counterpart is that the page must be loud about
what it *isn't*. It replaced an earlier prototype, preserved at the
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

**A green suite and a stalled animation at the same time.** I had written the
camera's easing loop with `requestAnimationFrame` scheduled inside a `setState`
updater, which reads fine and worked in every reduced-motion test. The one test
that ran with motion enabled failed: the camera stopped at logR 11.8 instead of
reaching 23.7. React may invoke an updater more than once, so scheduling
a frame inside it double-schedules or drops. Moving the eased value to a ref
and the scheduling outside the updater fixed it. I could have raised the
timeout and moved on —
[`1d2122d`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/1d2122d).

**I stopped eyeballing screenshots and committed the check instead.** Overflow,
control visibility and console errors at both marking viewports cannot be
asserted in jsdom, which has no layout engine and returns zero for every
measurement. Checking them by hand made them as reliable as remembering to, so I
wrote `scripts/check-viewports.mjs`: it serves the built site, drives the real
zoom through fourteen scales at both viewports, and measures the *rendered*
label boxes. It failed on its first run with three label collisions, and the
cause was a real bug — my collision estimate modelled a label as one 22-pixel
line when it renders as two, because I had forgotten the category subtitle under
the name. Fixing the estimate took it from three failures to none —
[`ee32b52`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/ee32b52).

**The bug nobody sighted could see.** Auditing the deployed page at both
marking viewports, I compared the screen against the live region. They
disagreed everywhere: 452 million km on screen against 773
million announced; at the widest scale, 53 billion light-years against 4.21
billion. My own rule — announce bands, not frames — had caused it. Firing on a
band change captured the radius mid-ease, on its way elsewhere, and nothing
corrected it once the camera stopped. Announcing on *settling* fixed it, and I
proved the new test failed against the old code before keeping it. The same
audit caught the readout calling 53 billion light-years a "visible radius" under
a band named for a 46-billion horizon, and that horizon described as "as far as
light has had time to travel" — which is 13.8 billion, not 46 —
[`dfedecb`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/dfedecb).
