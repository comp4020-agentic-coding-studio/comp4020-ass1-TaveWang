# Assignment 1 reflection

**What was the breakthrough that moved the work forward?**

The breakthrough wasn't a piece of code — it was deciding to build in five
checked, committed stages instead of one large pass. The first version of the
scroll-to-distance mapping assumed every milestone sat at a fixed, formula-derived
position, and it would have been easy to wire that straight into the page and
call it done. Building the pure logic first, with its own unit tests, before
touching the DOM at all is what surfaced that the assumption didn't survive
contact with real content — some milestones carry a note or a source table and
others don't, so section heights aren't uniform. Once distance-mapping was
separated from measurement, fixing it was a small, local change instead of a
rewrite discovered mid-integration.

**What did this work change about who I want to be as a software developer?**

I want to be someone who treats a green check as the start of a question, not
the end of one — the `prefers-reduced-motion` test passing for the wrong
reason (an untested assumption about how Astro emits CSS) was easy to miss
precisely because the visible signal looked fine. The habit I want to keep is
the one this assignment forced: before accepting a fix, ask whether it landed
in the actual bug or in the nearest thing that made the red turn green, and
when a correction is really about a recurring rule rather than one line, put
it where the next piece of work will actually see it — the harness, not just
the diff.
