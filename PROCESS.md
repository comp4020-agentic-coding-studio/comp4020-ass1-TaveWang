# Process overview

## What I built

"The Sun, in Context" is a zoom explainer with one mechanic: pull back from the
Sun's surface to the edge of the observable universe, continuously, and watch
everything you were just looking at collapse into the centre. The camera is a
single semantic scalar — `logR`, the log of the visible radius in kilometres —
so zooming is logarithmic while the picture never is: within one frame,
distances are drawn strictly to scale. That is what makes the inner planets
genuinely bunch toward the middle as you retreat, rather than being animated
into doing so. Planet orbits are computed from JPL's J2000 elements, so they are true
ellipses with the Sun at a focus, on real inclined planes. The counterpart is
that the page has to be loud about what it *isn't*: symbol sizes encode
prominence, not size; bearings beyond the planets are chosen for legibility;
and the Solar System's edge depends on which definition you pick.

This replaced an earlier prototype in the same repo — a deliberate call, since
the brief asks for one strong idea and nothing else. The old one is preserved
at the `up-explainer` tag.

## The moments that mattered

**A lint warning about an unused variable was really a warning about a false
citation.** oxlint flagged that my JPL physical-parameters source constant was
imported and never used. The obvious fix was to delete it. Instead I asked why
it was unused, and found that every planet's *radius* was implicitly cited to
JPL's orbital-elements page — a table that contains no radii at all, because
JPL publishes sizes and orbits separately. Jupiter's "radius 69,911 km" was
sourced to a page that has never stated it. I added a required `radiusSource`
field and a test that fails the build if any object shows a size without its
own citation —
[`9ca4484`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/9ca4484).

**I cut Voyager 1 because including it would have quietly changed what the
number meant.** It was on my object list and it is the obvious thing to put at
the heliopause. But NASA's live tracker reports its distance from *Earth*, and
this map is Sun-centred. The number would have looked right, sat in the right
place, and silently measured something else. Barnard's Star and Sirius went for a
blunter reason: no NASA or ESA page I could reach stated their distances, and I
decided an unsourced number does not ship. The dataset records all three
omissions and why, so each absence reads as a decision —
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

**My tests were checking a shape the site does not ship.** A screenshot showed
the Milky Way unlabelled at the exact scale band named "The Milky Way", while a
unit test asserting the opposite passed. The tests assumed a square-ish stage;
the real one is a wide, short band, where a structure's circle is much smaller
and fell under the label threshold. Two causes, not one: the threshold, and the
Sun's centre label blocking anything near the middle. Labels now try four
positions, the tests use the shipped aspect ratios, and the collision estimate
accounts for the fact that letterspaced labels are 45% wider than a character
count predicts —
[`74fa230`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/74fa230).
