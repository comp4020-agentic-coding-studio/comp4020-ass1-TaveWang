# Assignment 1 reflection

**What was the breakthrough that moved the work forward?**

Deciding that the zoom would be logarithmic but the picture would not. My first
instinct was to log-compress the positions too, because that is the obvious way
to fit the Sun and the observable universe into one view. Keeping the radial mapping strictly linear *within* each
frame — so only the act of zooming is compressed — solved problems I hadn't
reached yet. Every frame became a true-to-scale map, so I never had to invent a
rule for when an object "collapses to a point": everything in the Solar System
falls inside the same few pixels once you are far enough out, because that is
what actually happens. The Sun's switch to a "you are here" marker fell out of
the same arithmetic rather than being a threshold I typed in. The idea got
simpler and more honest at once, which I now read as a signal I have the right
model rather than a clever one.

**What did this work change about who I want to be as a software developer?**

I want to be someone who reads what a warning is pointing at, not just what it
says. A lint message about an unused import was, underneath, a false citation:
every planet's radius was credited to a table that has never contained radii.
Deleting the variable would have made the tool quiet and the page wrong. The
same pattern kept recurring — a passing test that asserted a stage shape the
site does not ship, a mobile label cap that never actually bound. In each case
the tooling was technically satisfied and the artefact was not. What I want to
keep is the habit of treating green as a question: satisfied by what, exactly,
and is that the thing I actually care about?
