-- LifeDash schema. Paste into Supabase: SQL Editor > New query > Run.
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- Lists: "Solven Growth", "Personal", ... kind decides whether it feeds AI context.
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  description text not null default '',
  kind text not null default 'personal' check (kind in ('business', 'personal')),
  color text not null default 'ink',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  list_id uuid not null references public.lists on delete cascade,
  name text not null,
  description text not null default '',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  list_id uuid not null references public.lists on delete cascade,
  category_id uuid references public.categories on delete set null,
  title text not null,
  notes text not null default '',
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid not null references public.tasks on delete cascade,
  title text not null,
  done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Morning briefs and evening recaps, written by Claude through the MCP connector.
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('morning', 'recap')),
  for_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now()
);

-- Business context: notes you write (offer, website, goals) ...
create table if not exists public.context_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  body text not null default '',
  position double precision not null default 0,
  updated_at timestamptz not null default now()
);

-- ... and facts Claude learns along the way (mostly from email).
create table if not exists public.context_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fact text not null,
  source text not null default 'claude',
  created_at timestamptz not null default now()
);

-- One Google account per user. The refresh token never leaves the server routes.
create table if not exists public.google_accounts (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  email text not null,
  refresh_token text not null,
  scope text not null default '',
  time_zone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

create index if not exists tasks_list_idx on public.tasks (list_id, done);
create index if not exists tasks_due_idx on public.tasks (user_id, due_date) where not done;
create index if not exists checkpoints_task_idx on public.checkpoints (task_id);
create index if not exists categories_list_idx on public.categories (list_id);
create index if not exists briefs_recent_idx on public.briefs (user_id, created_at desc);

-- Row-level security: every row belongs to exactly one user, and only they see it.
do $$
declare t text;
begin
  foreach t in array array['lists','categories','tasks','checkpoints','briefs','context_notes','context_facts','google_accounts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
