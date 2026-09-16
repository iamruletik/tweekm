# Prototype audit — 2026-09-12 (progress 2026-09-13)

Read pass over all 8.7k lines of `src/`. `svelte-check`: 0 errors, 0 warnings —
everything below is behaviour, not types.

**Fixed on 2026-09-13:** A1 (totals scoped to the grid's own rows, month
denominator, comma formatting), A2 (sidebar bound to the grouping — the Проекты
and Клиенты cards are gone entirely; project settings moved to the `⋯` on a
project row), A4 (one `expectedHoursFor`), A5 (same), the whole of A4/A5's
disagreement, A3+E1 (one vacation store with a member-side request form), C1 (the
sidebar's hardcoded identity), and most of section B — every dead control now
carries a `позже`/`макет` tag, with Excel getting a full mock dialog. Added since:
`/login`, `/signup`, `/reset-password`, `/landing`, studio logo in settings and on
the report. Mobile (D1) is deferred until after first release, by decision.

Ordered by what costs the most if it goes into the schema unnoticed.

---

## A. Wrong behaviour

### A1. Totals ignore the filters and the tab — HIGH

`WeekGrid.svelte:91` builds its day totals from the **whole** hours map:

```js
const hoursByDate = $derived(buildHoursByDate(hoursByTaskAndDate));
```

On `/boss` that map is the entire studio, so:

- **Мои задачи** shows the boss's rows but the whole studio's day totals and
  sidebar gauges.
- Filtering Студия by сотрудник / клиент / проект changes the rows and the
  "N из M задач" counter, but not one number in the totals row.

The fix is a data-shape decision, not a patch: the grid needs hours for *its*
rows only. Worth settling before the schema, because it decides whether the
grid is handed entries or a task-id list.

### A2. The `/boss` sidebar is wired to the grouping, not to the projects

`boss/+page.svelte:1745` — `bind:projectsWithTasks={gridProjects}`.
`gridProjects` is the *grouped rows* the `$effect` at `:314` rebuilds. So:

- grouping by сотрудник → the sidebar "Проекты" card lists **people**;
  by клиент → **clients**.
- "+" writes a project into that array; the next rebuild deletes it silently.
- "×" removes a group, not a project.

### A3. Week/month totals always divide by the week

`WeekGrid.svelte:936` — `из {targetHoursPerDay * workDaysPerWeek}`. In month
view the row still reads "из 40".

### A4. Two unrelated vacation systems

- `hours.ts:69` `buildVacationDates()` — 9 hardcoded days next month, applied to
  **everyone**, drives the grid, the calendar, the year view and the "До отпуска"
  counter.
- `studioData.ts:236` `vacationRequests` — real per-person records with a status,
  drives TeamGrid and approve/decline.

Approving a vacation on Команда changes nothing anywhere else, and the personal
calendar shows a vacation nobody asked for.

### A5. "Expected hours" is computed three different ways

| Where | Formula |
|---|---|
| `boss/+page.svelte:557` | `countWeekdaysBetween(...) × norm × staff` |
| `TeamGrid.svelte:70` | `visibleDates.length × norm` — counts weekends when they're shown |
| `TeamGrid.svelte:69,187` | hardcoded 21 days a month |

So the per-person Загрузка bars disagree with the studio cards directly above
them. One `expectedHours(period, person)` helper, one answer.

### A6. Hours input accepts values the schema will reject

`hours.ts:17` `sanitizeHoursInput` strips non-digits and keeps one separator —
no 24 cap, no 0.25 step. `99` and `0,33` are both typable. Rounding to 0.25
happens only on blur (`WeekGrid.svelte:296`) and the stepper moves in whole
hours. Schema says `numeric(4,2) check (hours >= 0 and hours <= 24)`.

### A7. Hand-added empty rows are scoped to one week

`WeekGrid.svelte:250` keys `taskIdsAddedPerWeek` by the Monday of `selectedDate`.
A row with no hours exists in exactly that week — in month view it's keyed to
whichever week the selected day is in, and moving a week makes it vanish. There
is no "show all my rows" escape hatch, so a task with no hours yet is
unreachable except by re-adding it.

### A8. The Экспорт dropdown on `/` never closes

`/boss` closes the toolbar's menus on any click (`boss:873` →
`gridToolbar?.closeMenus()`). `/` doesn't — its `svelte:window` handler at
`+page.svelte:349` only clears three dead local flags.

### A9. Small ones

- `boss:124` `restoreEmployee` — both ternary branches return `'active'`, so an
  invited person returns from the archive as active.
- `TeamGrid.svelte:104` `formatRange` prints day numbers plus the *end* month:
  a range across a month boundary reads "24–3 октября".
- `PeriodToolbar.svelte:22` "Неделя N" = `ceil(monday.getDate() / 7)` — Aug 31–Sep 6
  is "Неделя 5", the next week is "Неделя 1", and two weeks in a month can share
  a number.
- `SettingsModal.svelte:79` writes `document.documentElement.style.fontSize`
  permanently, overriding the responsive `clamp()` in `+layout.svelte:44` and
  never restoring it.
- `boss:40` `BossTab` still has `'reports'` with no tab and no branch — setting
  it renders the Студия grid.

---

## B. Controls that exist and do nothing

| Control | Where |
|---|---|
| Импорт / Экспорт в Excel | `GridToolbar.svelte:77,78`, `SettingsModal.svelte:250,258` |
| **Удалить все часы** (destructive, no-op) | `SettingsModal.svelte:266` |
| + Новое пространство · Сменить фото | `SettingsModal.svelte:293,109` |
| Account name / role / email fields | `SettingsModal.svelte:118,126,134` — static `value=`, typing is discarded |
| Язык (ru/en) | `Sidebar.svelte:525`, `SettingsModal.svelte:142` — no i18n exists |
| Выйти | `Sidebar.svelte:549` |
| Search results | `GridToolbar.svelte:107` — buttons with no handler |
| Тема: Системная / Тёмная | `SettingsModal.svelte:184` — app is light-only, `accentPreference` unread |
| Рабочие часы 9:00–17:00 | `SettingsModal.svelte:206` — nothing reads it since the clock was removed |
| Shortcut list: Enter, ⌘↩ | `SettingsModal.svelte:73` — Enter does nothing in an hours cell |
| «Сохранить и скопировать ссылку» | `share/+page.svelte:221` — only copies; nothing is saved |

---

## C. The same thing behaving differently in two places

- **The sidebar user is hardcoded.** `Sidebar.svelte:483,485,503,506` render
  "David Gordov", `pravatar img=12` and `david@studio.com` literally, while the
  component declares `userName` / `userRole` / `avatarUrl` props (`:26-29`) that
  nothing uses. Anyone else logging in sees David.
- **`/` and `/boss → Мои задачи` run on different data.** They're meant to be the
  same screen: `fakeData.ts` (QQbet / Back Office / Сайберус) vs `studioData.ts`
  (QQbet / QQ bet / ККбет). Different projects, different tasks, different hours.
- **Dragging hours works only on `/boss`** — `allowEntryMove` defaults to `false`
  (`WeekGrid.svelte:37`). The personal grid drags tasks but not entries.
- **Three different project-delete rules:** `/` modal deletes a project *with* its
  tasks (`+page.svelte:444`); the sidebar only shows × when the project is empty
  (`Sidebar.svelte:445`); `/boss` refuses when tasks exist (`boss:466`).
- **Search means two things:** on `/boss` it filters the grid (bound to
  `filterQuery`, `boss:1135`); on `/` it filters only its own dropdown.
- **`/` still carries a dead copy of the toolbar** — `searchQuery`, `searchResults`,
  `periodLabel`, `todayLabel`, the three menu flags — left behind when
  `PeriodToolbar`/`GridToolbar` were extracted. `/boss` has none of it.
- **Number formatting splits:** cells and project headers use `formatHours`
  (comma), the totals row prints raw JS numbers (`WeekGrid.svelte:936,946,948`),
  so "12.25" can sit under "12,25".
- **Four copies of the same wrappers:** `dayFillColor` / `isVacationDay` /
  `isWorkedVacationDay` / `hoursLoggedOn` are pasted into `+page.svelte:309`,
  `WeekGrid.svelte:93`, `Sidebar.svelte:75`.
- **Two different share dialogs for one `/share`:** the personal one has no
  "кто делал" and no currency (always ₽); the boss one has both.

---

## D. Missing layouts and states

- **No mobile layout at all.** Both routes are fixed two-column `100dvh` grids
  (`+page.svelte:606`, `boss:1798`). On a phone the sidebar eats half the screen
  and the grid can't be typed into — and fast mobile entry is goal #1.
- **Empty states:** the week grid has one (`WeekGrid.svelte:901`). Missing on
  Студия when filters match nothing (empty grid + "0 из 20 задач"), on Команда
  with no people, on Проекты и клиенты with no clients or projects.
- **No loading / error / offline state anywhere** — nothing loads yet, but there's
  also no place for it to go.
- **Year view** has no totals, no "всего за год", and doesn't know about vacation
  *requests* (only the fake global vacation).
- **Команда has no per-day column totals** — "did the studio log 40 hours on
  Tuesday" is the boss's first question and the screen can't answer it.
- **No print stylesheet for `/share`**, which is the page that becomes an invoice.
- **Notifications:** opening the bell marks everything read (`Sidebar.svelte:109`),
  no "mark all read", and no notification links to what it's about.
- **No archived state for projects or clients** — only for employees, though the
  planned schema has `projects.archived`.

---

## E. Implied by the screens, reachable by nobody

1. **Requesting a vacation.** The boss approves and declines requests that exist
   only in seed data. No member-side button anywhere.
2. **Template / recurring rows.** Goal #2 in CLAUDE.md — "kill the weekly
   copy-paste" — has zero UI. A week starts empty and rows appear only where
   hours already exist.
3. **Per-entry note.** The planned `entries.note` has no cell-level UI; only a
   per-task description exists.
4. **Locking an invoiced week**, and **frozen report snapshots** — `/share`
   recomputes live hours on every open, so an already-sent report changes
   retroactively when someone edits a past cell.
5. **Unmerge.** A merged project keeps its greyed row forever, no undo
   (`boss:1054`).
6. **Total owed to outsource people.** Each has a rate and a per-period figure in
   their card; nothing sums them.
7. **Report title, period, client name and project names are not editable** in
   owner mode — only task title, description, hours and rate.
8. **CSV export** (goal #3) exists nowhere; only the dead Excel buttons.
9. **Arrow-key navigation in the grid**, listed as a desktop-grid convention in
   CLAUDE.md.
10. **The notification "Марк не заполнил часы"** is seeded by hand; nothing
    detects a missing day.

---

## F. Dead code and cost

- `/+page.svelte` carries ~120 lines that never render: `hasLoggedHours`,
  `searchQuery`/`searchResults`/`isSearchOpen`, `isTableMenuOpen`,
  `isViewMenuOpen`, `isPeriodPickerOpen`, `periodLabel`, `todayLabel`,
  `clockHeatOpacity`, `isViewingToday`, `goToToday`, `goToPreviousPeriod`,
  `goToNextPeriod`, `stepPeriod`, `totalHoursForWeek`, `isWorkedVacationDay`,
  plus the `fly`/`cubicOut`, `parseHours`/`formatHours`, `weekDayNames`/
  `monthNames` imports.
- **A `setInterval` ticks every second** (`+page.svelte:277`) to update
  `currentTime`, which only dead code reads.
- **Idiot-log #13 is still half-open.** `hours.ts:24` `hoursLoggedOn` scans every
  entry in the map per date, and `sumHoursOnDates` (`:64`) calls it once per day —
  the sidebar week gauge re-scans the whole map 7× on every keystroke. The fast
  path (`aggregateHours` / `buildHoursByDate`) sits 30 lines below it.
- Duplicate CSS rules: `.task-editor` at `WeekGrid.svelte:1461` and `:1576`,
  `.project-toggle` at `:1401` and `:1411`; several empty comment blocks left
  from moved code.

---

## What this says about the schema

Four of these are schema questions, not bug fixes — worth deciding before
writing `0001_init.sql`:

1. **Vacations are one table with a status** (A4), and the grid/calendar read it
   instead of a hardcoded list.
2. **A task row can exist in a week with no hours** (A7) — that's the template
   table, and it's what makes "forgot Tuesday" backfillable.
3. **A report has to be frozen when sent** (E4), or an invoice changes after the
   client got it.
4. **The grid must be able to ask for one person's hours** (A1), which means the
   query shape is `(user, date range)`, not "everything".
