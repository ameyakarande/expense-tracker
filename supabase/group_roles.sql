-- Add role column to group_members for permissions
alter table public.group_members
  add column if not exists role text not null default 'member' check (role in ('admin', 'member'));

-- Ensure creators are admins
update public.group_members gm
set role = 'admin'
from public.groups g
where gm.group_id = g.id
  and gm.user_id = g.created_by;
