create extension if not exists pgcrypto;

create type public.ledger_type as enum ('personal', 'group');

create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users (id) on delete cascade,
  invite_code text not null unique default public.generate_invite_code(),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, group_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'groups_invite_code_length_check'
  ) then
    alter table public.groups
      add constraint groups_invite_code_length_check check (char_length(invite_code) >= 10);
  end if;
end
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (name, created_by)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null,
  paid_by uuid not null references public.users (id) on delete cascade,
  date date not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  type public.ledger_type not null,
  group_id uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint expenses_group_context check (
    (type = 'personal' and group_id is null)
    or (type = 'group' and group_id is not null)
  )
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  type public.ledger_type not null,
  group_id uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint contributions_group_context check (
    (type = 'personal' and group_id is null)
    or (type = 'group' and group_id is not null)
  )
);

create index if not exists expenses_personal_month_idx
  on public.expenses (paid_by, month, date desc)
  where type = 'personal';

create index if not exists expenses_group_month_idx
  on public.expenses (group_id, month, date desc)
  where type = 'group';

create index if not exists contributions_personal_month_idx
  on public.contributions (user_id, month)
  where type = 'personal';

create index if not exists contributions_group_month_idx
  on public.contributions (group_id, month)
  where type = 'group';

create or replace function public.sync_expense_month()
returns trigger
language plpgsql
as $$
begin
  new.month := to_char(new.date, 'YYYY-MM');
  return new;
end;
$$;

drop trigger if exists set_expense_month on public.expenses;
create trigger set_expense_month
before insert or update of date
on public.expenses
for each row
execute function public.sync_expense_month();

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.join_group_by_code(lookup_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  select id into target_group_id
  from public.groups
  where invite_code = upper(trim(lookup_code));

  if target_group_id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.group_members (user_id, group_id)
  values (auth.uid(), target_group_id)
  on conflict (user_id, group_id) do nothing;

  return target_group_id;
end;
$$;

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.contributions enable row level security;

create policy "users_can_manage_own_profile"
on public.users
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "members_can_read_groups"
on public.groups
for select
using (created_by = auth.uid() or public.is_group_member(id));

create policy "users_can_create_groups"
on public.groups
for insert
with check (created_by = auth.uid());

create policy "group_creators_can_update_groups"
on public.groups
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "members_can_read_group_members"
on public.group_members
for select
using (user_id = auth.uid() or public.is_group_member(group_id));

create policy "users_can_join_group_memberships"
on public.group_members
for insert
with check (user_id = auth.uid() and public.is_group_member(group_id) = false);

create policy "users_manage_own_categories"
on public.categories
for all
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "personal_expenses_owner_access"
on public.expenses
for all
using (
  (type = 'personal' and paid_by = auth.uid())
  or (type = 'group' and public.is_group_member(group_id))
)
with check (
  (type = 'personal' and paid_by = auth.uid() and group_id is null)
  or (type = 'group' and public.is_group_member(group_id))
);

create policy "personal_contributions_owner_access"
on public.contributions
for all
using (
  (type = 'personal' and user_id = auth.uid())
  or (type = 'group' and public.is_group_member(group_id))
)
with check (
  (type = 'personal' and user_id = auth.uid() and group_id is null)
  or (type = 'group' and public.is_group_member(group_id))
);
