create extension if not exists pgcrypto;

create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

alter table public.groups
  alter column invite_code set default public.generate_invite_code();

update public.groups
set invite_code = public.generate_invite_code()
where char_length(invite_code) < 10;

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
