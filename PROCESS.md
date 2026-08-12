# Process overview

A reading-guide to how the work came together — a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and each brief adds its own word count and moment count.

## What I built

"UP: How Far Until Earth Disappears?" is a scroll-driven explainer: scrolling
maps to increasing distance from Earth, from sea level through the atmosphere,
past the Kármán line and the ISS, out through the Moon and the planets, to the
point 6.06 billion km away where Voyager 1 looked back and Earth was 0.12
pixels wide. The core idea is disclosed compression — the scale that lets
atmosphere and outer Solar System share one page is log-linear, not linear,
and the page says so at the exact point the compression starts, with a
persistent machine-readable distance readout so the number is always true
even when the scroll-to-distance mapping isn't.

## The moments that mattered

**The distance mapping assumed uniform section height, and real content broke
that before it ever shipped.** The first draft of the scroll→distance function
placed every milestone at a fixed `i * sectionPx`. Before wiring it to the
page I noticed some milestones carry a note, a source line, or an
air-composition table and others don't — section heights aren't uniform, so a
formula-derived position would drift from the real rendered layout the moment
copy changed. Instead of shipping the simpler version, I generalized the
function to take real per-milestone pixel positions measured from the live
DOM (`getBoundingClientRect`), re-measured on resize. I confirmed it by adding
an unevenly-spaced-anchor test and by scrolling the real built page in a
Playwright-driven Chromium session, watching the readout track correctly in
both directions —
[`5e39325`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/5e39325).

**A failing CSS test turned out to be a wrong assumption in my own test, not a
bug in the page.** `prefers-reduced-motion` kept reporting missing even after
I'd added the media query to `global.css`. Re-prompting wouldn't have found
this — the CSS was already correct. I inspected the actual `dist/` output and
found Astro inlines small stylesheets into a `<style>` tag instead of always
emitting `_astro/*.css`; my test only checked the external file. I fixed the
test's `cssFiles()` helper to scan inline `<style>` tags too, and wrote the
gotcha into `CLAUDE.md` so a future week's build doesn't lose an afternoon to
the same false negative —
[`14f0c02`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/14f0c02).

**`formatDistance`'s unit thresholds were wrong, and the table-driven test is
what caught it, not a read-through.** `149,600,000,000` m rendered as "149.6
billion km" instead of "149.6 million km" — a divisor bug (`/1e9` should have
been the million-km tier, `/1e12` the billion-km tier). Table-driven
`it.each` cases across all four unit tiers caught every boundary at once
rather than one manual example, and re-running them after the fix is what told
me it was actually right, not just right for the one case I'd checked by eye —
[`0d4187a`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/0d4187a).

**The HUD's `aria-live="polite"` looked correct and would have flooded screen
readers.** It read as the obvious choice — announce the distance as it
changes — until I traced through what "as it changes" means for a value
updated every animation frame during a scroll: several announcements a
second. The milestone content is already in the accessible document flow as
ordinary headings and paragraphs in scroll order, so the HUD is a sighted-only
convenience, not new information. I switched it to `aria-hidden="true"` and
wrote the reasoning into `CLAUDE.md` so a future live-updating readout doesn't
reach for `aria-live` on a per-frame value without a coarser update strategy —
[`8ed6e33`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-TaveWang/commit/8ed6e33).
