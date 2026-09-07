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
