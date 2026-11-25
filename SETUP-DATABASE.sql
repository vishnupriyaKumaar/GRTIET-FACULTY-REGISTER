-- GRT Faculty Records Register - online database (Supabase).
-- Paste this whole file into Supabase > SQL Editor > New query > Run.   Safe to run again.

create table if not exists public.staff (
  id       text primary key,
  data     jsonb  not null,
  updated  bigint not null default 0
);

create table if not exists public.records (
  key       text primary key,            -- '<academic year (semester)>|<teacher id>'
  term      text   not null,
  staff_id  text   not null,
  enc       text   not null default 'gz',
  z         text   not null,             -- the teacher's details, compressed (<= 50 KB), as text
  updated   bigint not null default 0
);
create index if not exists records_staff_idx on public.records (staff_id);

create table if not exists public.files (  -- NPTEL certificates (up to 5 MB each), stored in pieces
  id     text    not null,
  idx    integer not null,
  total  integer not null,
  chunk  text    not null,
  primary key (id, idx)
);

create table if not exists public.settings (
  k  text primary key,
  v  jsonb
);

-- Nobody can read these tables directly from a browser.  Only the app's own server (which uses the
-- secret service key) can - that is what keeps the data private.
alter table public.staff    enable row level security;
alter table public.records  enable row level security;
alter table public.files    enable row level security;
alter table public.settings enable row level security;
