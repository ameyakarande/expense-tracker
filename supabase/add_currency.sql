-- Update users table to include currency preference
alter table public.users
  add column if not exists currency text not null default 'USD';

-- Update RLS if necessary (it should already be covered by users_can_manage_own_profile)
