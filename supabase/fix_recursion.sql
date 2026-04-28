-- Fix recursive RLS policies by using a security definer function for membership checks
-- This bypasses the infinite loop where a policy check triggers another policy check on the same table.

create or replace function public.is_group_member_v2(target_group_id uuid)
returns boolean
language plpgsql
security definer -- This is key: it runs with the privileges of the creator (postgres), bypassing RLS
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
end;
$$;

-- Update the policies to use the new version of the function
drop policy if exists "members_can_read_groups" on public.groups;
create policy "members_can_read_groups"
on public.groups
for select
using (created_by = auth.uid() or public.is_group_member_v2(id));

drop policy if exists "members_can_read_group_members" on public.group_members;
create policy "members_can_read_group_members"
on public.group_members
for select
using (user_id = auth.uid() or public.is_group_member_v2(group_id));

drop policy if exists "personal_expenses_owner_access" on public.expenses;
create policy "personal_expenses_owner_access"
on public.expenses
for all
using (
  (type = 'personal' and paid_by = auth.uid())
  or (type = 'group' and public.is_group_member_v2(group_id))
)
with check (
  (type = 'personal' and paid_by = auth.uid() and (group_id is null or type = 'personal'))
  or (type = 'group' and public.is_group_member_v2(group_id))
);

drop policy if exists "personal_contributions_owner_access" on public.contributions;
create policy "personal_contributions_owner_access"
on public.contributions
for all
using (
  (type = 'personal' and user_id = auth.uid())
  or (type = 'group' and public.is_group_member_v2(group_id))
)
with check (
  (type = 'personal' and user_id = auth.uid() and (group_id is null or type = 'personal'))
  or (type = 'group' and public.is_group_member_v2(group_id))
);
