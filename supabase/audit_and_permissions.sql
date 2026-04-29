-- Create audit logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- Audit function
create or replace function public.process_audit_log()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'DELETE') then
    insert into public.audit_logs (table_name, record_id, action, old_data, changed_by)
    values (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    values (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    return NEW;
  elsif (TG_OP = 'INSERT') then
    insert into public.audit_logs (table_name, record_id, action, new_data, changed_by)
    values (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
    return NEW;
  end if;
  return null;
end;
$$;

-- Triggers for expenses
drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses
after insert or update or delete
on public.expenses
for each row execute function public.process_audit_log();

-- Triggers for contributions
drop trigger if exists audit_contributions on public.contributions;
create trigger audit_contributions
after insert or update or delete
on public.contributions
for each row execute function public.process_audit_log();

-- Update RLS to allow members to edit but only admins to delete
-- We need to drop old policies first

-- Expenses
drop policy if exists "personal_expenses_owner_access" on public.expenses;
create policy "personal_expenses_owner_access"
on public.expenses
for all
using (
  (type = 'personal' and paid_by = auth.uid())
  or (type = 'group' and public.check_membership(group_id))
)
with check (
  (type = 'personal' and paid_by = auth.uid())
  or (
    type = 'group' 
    and public.check_membership(group_id)
    and (
      -- Only admins can delete
      (TG_OP = 'DELETE' and (select role from public.group_members where group_id = expenses.group_id and user_id = auth.uid()) = 'admin')
      -- Everyone can insert/update
      or (TG_OP <> 'DELETE')
    )
  )
);

-- Note: RLS 'with check' doesn't easily handle TG_OP in simple policies. 
-- It's better to split them into separate policies for UPDATE and DELETE.

drop policy if exists "group_members_can_update_expenses" on public.expenses;
create policy "group_members_can_update_expenses"
on public.expenses
for update
using (type = 'group' and public.check_membership(group_id));

drop policy if exists "group_admins_can_delete_expenses" on public.expenses;
create policy "group_admins_can_delete_expenses"
on public.expenses
for delete
using (
  type = 'group' 
  and (select role from public.group_members where group_id = expenses.group_id and user_id = auth.uid()) = 'admin'
);

-- Contributions
drop policy if exists "group_members_can_update_contributions" on public.contributions;
create policy "group_members_can_update_contributions"
on public.contributions
for update
using (type = 'group' and public.check_membership(group_id));

drop policy if exists "group_admins_can_delete_contributions" on public.contributions;
create policy "group_admins_can_delete_contributions"
on public.contributions
for delete
using (
  type = 'group' 
  and (select role from public.group_members where group_id = contributions.group_id and user_id = auth.uid()) = 'admin'
);
