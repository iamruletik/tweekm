# Good ideas — 1

Ruletik's ideas that turned out right. Portable: copy into any project.
When this grows past ~30 entries, split into `good-ideas/<topic>.md` and keep
only the count and a topic index here.

## 1. Make the fake scrollbar the only real scroller — 2026-09-07

Two containers that both scrolled had to be kept in sync, and the sticky task
column bounced because each echoed the other's `scrollLeft`.

Instead: set the grid to `overflow-x: hidden` so it cannot scroll itself, and
let the thin scrollbar strip under the hour columns drive it. One source of
truth, nothing to fight. Sideways wheel over the grid is forwarded to the strip.
