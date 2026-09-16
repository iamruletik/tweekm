# Ruletik — internal time tracking app

## What this is

Internal replacement for a weekly Google Sheet the studio uses to log hours
per project/task per day. The sheet feeds manual invoice creation and
productivity review by the studio lead. Goals, in priority order:

1. Fast mobile entry (tap a recurring task row, tap an hours number) —
   the sheet's biggest failure mode is "forgot Tuesday, awkward to backfill."
2. Kill the weekly copy-paste. A "template" of recurring (project, task)
   rows gets instantiated fresh each week with hours blank.
3. Studio-lead read-only view: all users × week, filterable by project,
   CSV export. Feeds invoice creation — does not generate invoices yet.
4. Invoicing — out of scope until 1–3 have run for a real month and we
   know what an invoice line actually needs (flat hours×rate? approval
   states? corrections after send?).

Not building: automatic time clocking, timers, kanban. This is a manual
grid, on purpose — that's the whole reason the old sheet worked.

## Stack

- **SvelteKit 2**, Svelte 5 runes, TypeScript
- **Supabase** — Postgres, Auth, RLS. Client SDK only (`@supabase/supabase-js`
  + `@supabase/ssr` for cookie-based sessions). No ORM, no service-role key
  in app code — RLS is the only access control layer. Types generated via
  `supabase gen types typescript`, never hand-written.
- **vite-plugin-pwa** — installable PWA, service worker, manifest
- **idb-keyval** — offline write queue (IndexedDB), not Dexie — we're
  storing one array of pending writes, nothing relational client-side
- Styling: plain CSS + custom properties, or Tailwind v4 CSS-first config —
  not decided, doesn't matter, don't spend time on it
- **No component library.** ~6 components total (cell input, row, week
  header, week switcher, project picker, total). Hand-build them; this is
  a design-sensitive internal tool and off-the-shelf defaults will get
  rewritten anyway.
- Deploy: **Cloudflare Pages**, `adapter-cloudflare`. Not Vercel — Hobby
  tier is non-commercial-use only per Vercel's ToS, and this app feeds
  client invoicing.

## Data model

`work_date` is `date`, never `timestamptz` — studio is UTC+5, timestamps
would push late-evening entries onto the wrong calendar day and skew
invoicing. `hours` is `numeric`, never float.

```sql
create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client_name text,
  sort_order  int not null default 0,
  archived    boolean not null default false
);

create table entries (
  id         uuid primary key default gen_random_uuid(), -- client-generated
  user_id    uuid not null references auth.users(id),
  project_id uuid not null references projects(id),
  task_label text not null,
  work_date  date not null,
  hours      numeric(4,2) not null check (hours >= 0 and hours <= 24),
  note       text,
  locked     boolean not null default false, -- set true once a week is invoiced
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entries_user_date on entries (user_id, work_date);
create index entries_project_date on entries (project_id, work_date);

-- recurring rows a week is generated from — replaces copy-pasting the sheet
create table template_rows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  project_id uuid not null references projects(id),
  task_label text not null,
  sort_order int not null default 0
);

create table profiles (
  id   uuid primary key references auth.users(id),
  role text not null default 'member' check (role in ('member', 'admin'))
);

alter table entries enable row level security;
alter table template_rows enable row level security;

create policy own_entries on entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not locked);

create policy admin_reads_entries on entries
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy own_template_rows on template_rows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Client-generated UUID as PK on `entries` is load-bearing: it's what makes
the offline queue idempotent (retrying a write can't create a duplicate
row — same PK, same upsert).

## Supabase dashboard settings (already set)

- Data API: **on**
- Automatically expose new tables: **off** — every new table must be
  explicitly RLS-policied in the same migration that creates it
- Automatic RLS event trigger: **on** — backstop only, don't rely on it;
  every migration below still enables RLS explicitly

## Repo setup

```bash
mkdir ruletik && cd ruletik
npm create svelte@latest .
# SvelteKit 2, TypeScript, Svelte 5

npm i @supabase/supabase-js @supabase/ssr idb-keyval
npm i -D @sveltejs/adapter-cloudflare vite-plugin-pwa

npm i -g supabase
supabase login
supabase init
supabase link --project-ref <your-project-ref>   # from Supabase dashboard URL

mkdir -p supabase/migrations
# paste schema above into supabase/migrations/0001_init.sql
supabase db push

supabase gen types typescript --linked > src/lib/database.types.ts

git init
git add -A
git commit -m "init: sveltekit + supabase schema"
git remote add origin <your-repo-url>
git push -u origin main
```

`.env`:

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Anon key is safe client-side — RLS is the actual gate, not this key.
Never add a service-role key to app code; if a future admin task needs one
it lives in a server-only route, not shipped to the client.

`svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare';
export default { kit: { adapter: adapter() } };
```

## Conventions for whoever's writing this (including Claude Code)

- Client SDK + RLS only. No server route touches the DB with elevated
  privileges until invoicing (step 4) genuinely requires it.
- All schema changes go through `supabase/migrations/*.sql` + `db push`.
  Never edit schema by hand in the dashboard — it drifts from the repo
  silently.
- Round hours to 0.25 on blur, client-side, before it ever reaches the
  queue or the DB.
- Two grid views, not one responsive component: desktop table
  (`WeekGrid.svelte`, grouped by project, arrow-key nav) and a separate
  mobile tap-to-enter view. Don't try to make one component do both.
- Offline queue lives in `src/lib/queue.ts`: enqueue on every edit, flush
  on `online` / `visibilitychange`, 4xx errors drop the item (bad data),
  5xx/network errors stay queued and retry.

## Build order

1. Week grid (desktop), grouped by project, template rollover
2. Mobile PWA capture view + offline queue
3. Admin read-only rollup (all users × week, CSV export)
4. Invoicing — revisit scope after 1–3 have real weeks of data in them

## Where the project actually stands (updated 2026-09-13)

The schema above is the *plan*. None of it exists yet: the Supabase database was
deliberately wiped, `supabase/migrations/` is empty, and `src/lib/supabase.ts` is
an untyped browser client nothing calls. Everything below runs on fake in-memory
data, by choice — Ruletik wanted to see and use the screens before deciding what
the tables should be.

### Routes

The product is called **Tweekm**; the studio inside it is **Radiance**.

- `/` — one person's week: the grid, sidebar (calendar, load gauges, vacation
  counter with a request form, user menu, notifications), settings, share and
  Excel dialogs. Project settings open from the `⋯` on a project row in the table.
- `/boss` — the studio lead's app, four tabs:
  - **Студия** — every employee's tasks. Filters (сотрудник / клиент / проект /
    search) and configurable grouping: group by project, person or client, with
    the other dimension shown as a row label, sorted by name or hours.
  - **Мои задачи** — deliberately identical to `/` (project groups, no labels,
    nothing to configure), counters scaled to one person.
  - **Команда** — people as rows, days or months as columns: load per day,
    vacations (approved solid, pending striped) with approve/decline, per-person
    load bars, studio overview cards, hiring (invite staff / add outsource),
    per-employee card (role, email, password reset, salary or hourly rate, note)
    and archiving.
  - **Проекты и клиенты** — inline editing of both plus `⋯` editors, creation,
    merging duplicate projects (tasks move, everyone gets notified), per-client
    rate and currency, and the client report link.
- `/landing` — placeholder marketing page: one paragraph, three cards, links in.
- `/login`, `/signup`, `/reset-password` — auth screens, UI only, sharing
  `AuthShell.svelte`. Login matches a fake email and redirects; signup creates a
  *studio* (staff arrive by invite only); reset has both states (ask for email,
  then `?token=…` to set a password).
- `/share` — the public read-only report, with the studio logo in its header. Two modes: one person's projects, or
  studio-wide filtered by clients/projects/employees. Renders like an invoice
  (hours, rate in the client's currency, totals). Signed-in owner sees an edit
  bar: rewrite titles and body text, adjust hours, drop rows — report-only, the
  grid is never touched; anyone else sees a plain read-only sheet.

### Shared code

- `src/lib/components/` — `WeekGrid` (the whole table: header, groups, cells,
  editor, drag & drop of tasks and of individual entries, column resize, fake
  scrollbar, totals, year view), `TeamGrid`, `Sidebar`, `PeriodToolbar`,
  `GridToolbar`, `ViewModeMenu`, `SettingsModal`, `ExcelModal` (import/export
  layout, deliberately inert), `AuthShell`.
- `src/lib/dates.ts` — week/month dates, `visibleDatesFor`, weekday counting.
- `src/lib/hours.ts` — **the only place hour totals are computed**:
  `aggregateHours(map, keyOf)` does one pass and buckets by any key; everything
  else looks up. Re-scanning entries per cell is what made Chrome hang once.
  `expectedHoursFor(dates, norm, headcount)` is likewise **the only** answer to
  "how many hours should this period hold" — weekends never count, even when the
  grid shows them. Three screens used to disagree about this.
- `src/lib/vacations.svelte.ts` — **the only vacation source**: one record per
  request with a status, shared by the grid, the calendar, the counter and
  `TeamGrid`. Approving on Команда changes every screen at once.
- `src/lib/studioProfile.svelte.ts` — studio name + logo (data URL for now), used
  by the sidebar, `/boss` and the client report.
- `src/lib/fakeData.ts`, `src/lib/studioData.ts` — prototype data, including
  deliberately messy duplicates ("QQbet" / "QQ bet" / "ККбет") to exercise
  merging, and an outsource person with no account.
- `src/lib/notifications.svelte.ts` — in-memory notification store behind the
  sidebar bell.
- `src/app.css` — shared chrome (buttons, dropdowns, modals, toolbar, switches).
  Page-specific CSS stays scoped in its component.

### Still fake / not built

Nothing persists — a reload rebuilds the fake data, logo included. Excel import
and export are a full dialog with an inert button. No auth: `/login` matches a
fake email, `/` and `/boss` are hardcoded to David, and the boss/client split on
`/share` is a toggle. No template rollover, no per-entry note, no locked weeks,
no report snapshots, no CSV, no arrow-key grid nav. No offline queue, no PWA
work, no mobile view — mobile is deliberately deferred until after first release.

`AUDIT.md` holds the full list with file:line; `PROTOTYPE-LABELS.md` holds every
string and disabled control that must not ship.

### Next step

Deconstruct the prototype into the real schema. The screens now say what the
tables need: employees (staff/outsource/invited/archived, salary or hourly rate),
clients (rate, currency), projects (client, merged-into), tasks (project, owner),
entries, vacations with a status, notifications, and frozen report snapshots
(one row per shared report — ~5 KB each, so ~0.6 MB/year at 10 reports a month).

## Working agreements (read before touching anything)

- Read `IDIOT-LOG.md` at the start of every session and before reporting work as
  done. Every entry is a mistake that already cost Ruletik time — do not repeat
  it. Same for `IDIOT-LOG-RULETIK.md` (his own misses, logged on request).
- Read `GOOD-IDEAS.md` too: those are decisions that turned out right and should
  be reused rather than re-litigated.
- Update the count in the heading and add the entry in the same edit, the moment
  he says "+1 idiot".
- English only in conversation with Ruletik; the app's interface text stays
  Russian.
- Plan before building, one step at a time, and let him decide — see the rules
  in his memory file `working-rules.md`.
- `AUDIT.md` is the standing list of what is broken, missing or inconsistent in
  the prototype. Tick items off there as they are fixed; add what you find.
- **`PROTOTYPE-LABELS.md` must stay current.** Anything that only exists because
  the app runs on fake data — a `позже`/`макет` tag, a `disabled` button, copy
  admitting nothing is saved, a hardcoded user — goes in that file the moment it
  is added, so none of it reaches a real studio. A new control is either wired or
  tagged; never silently dead.
