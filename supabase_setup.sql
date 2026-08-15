create table if not exists public.diet_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

create table if not exists public.workout_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.diet_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.user_app_data enable row level security;

drop policy if exists diet_select_own on public.diet_logs;
drop policy if exists diet_insert_own on public.diet_logs;
drop policy if exists diet_update_own on public.diet_logs;
drop policy if exists diet_delete_own on public.diet_logs;
create policy diet_select_own on public.diet_logs for select to authenticated
using ((select auth.uid()) = user_id);
create policy diet_insert_own on public.diet_logs for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy diet_update_own on public.diet_logs for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy diet_delete_own on public.diet_logs for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists workout_select_own on public.workout_logs;
drop policy if exists workout_insert_own on public.workout_logs;
drop policy if exists workout_update_own on public.workout_logs;
drop policy if exists workout_delete_own on public.workout_logs;
create policy workout_select_own on public.workout_logs for select to authenticated
using ((select auth.uid()) = user_id);
create policy workout_insert_own on public.workout_logs for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy workout_update_own on public.workout_logs for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy workout_delete_own on public.workout_logs for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists appdata_select_own on public.user_app_data;
drop policy if exists appdata_insert_own on public.user_app_data;
drop policy if exists appdata_update_own on public.user_app_data;
create policy appdata_select_own on public.user_app_data for select to authenticated
using ((select auth.uid()) = user_id);
create policy appdata_insert_own on public.user_app_data for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy appdata_update_own on public.user_app_data for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.diet_logs to authenticated;
grant select, insert, update, delete on public.workout_logs to authenticated;
grant select, insert, update, delete on public.user_app_data to authenticated;

create index if not exists diet_logs_user_date_idx on public.diet_logs(user_id, log_date);
create index if not exists workout_logs_user_date_idx on public.workout_logs(user_id, log_date);