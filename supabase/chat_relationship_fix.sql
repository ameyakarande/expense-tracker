-- 1. Drop the old constraint
ALTER TABLE IF EXISTS public.group_chats 
DROP CONSTRAINT IF EXISTS group_chats_user_id_fkey;

-- 2. Explicitly link user_id to the PUBLIC users table (this fixes the join error)
ALTER TABLE public.group_chats
ADD CONSTRAINT group_chats_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- 3. Notify PostgREST to reload the schema cache
-- (Running any DDL command like this usually triggers a reload automatically)
COMMENT ON TABLE public.group_chats IS 'Table for group discussions, linked to public profiles.';
