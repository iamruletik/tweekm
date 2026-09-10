# Idiot — 3

Times Claude got called an idiot or a moron, and why. Portable: copy into any
project. When this grows past ~30 entries, split into `idiot-log/<year>.md` and
keep only the count and the recurring lessons here.

## 1. Sidebar moved right in CSS only — 2026-09-07

Swapped `grid-template-columns` but left the sidebar first in the markup, so it
took the wide column and the grid shrank to 264px. Shipped without looking at it
in a browser.

## 2. Claimed the scroll bounce was fixed after only running `svelte-check` — 2026-09-07

Guessed at causes for several turns instead of opening a browser first.
Lesson: for any visual or interaction bug, drive headless Chrome over CDP and
LOOK before claiming anything.

## 3. Put both counters in one file without asking — 2026-09-07

A knowledge base of good ideas and a log of my mistakes are different things
with different lifespans. Broke rule 8 — that was his call, not mine.
