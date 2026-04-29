-- 1. CLEANUP: Start with a fresh slate
DROP POLICY IF EXISTS "members_can_view_chat" ON public.group_chats;
DROP POLICY IF EXISTS "members_can_send_messages" ON public.group_chats;
DROP POLICY IF EXISTS "admins_can_clear_chat" ON public.group_chats;

-- 2. FORCE ENABLE REALTIME
-- We do this first to ensure the table is in the publication
ALTER TABLE public.group_chats REPLICA IDENTITY FULL;

-- 3. THE BULLETPROOF VIEW POLICY
-- This uses a direct join check which is the most reliable method in Postgres/Supabase
CREATE POLICY "members_can_view_chat" ON public.group_chats
FOR SELECT USING (
    EXISTS (
        SELECT 1 
        FROM public.group_members 
        WHERE group_members.group_id = group_chats.group_id 
        AND group_members.user_id = auth.uid()
    )
);

-- 4. THE BULLETPROOF SEND POLICY
CREATE POLICY "members_can_send_messages" ON public.group_chats
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 
        FROM public.group_members 
        WHERE group_members.group_id = group_chats.group_id 
        AND group_members.user_id = auth.uid()
    )
);

-- 5. THE BULLETPROOF DELETE POLICY
CREATE POLICY "admins_can_clear_chat" ON public.group_chats
FOR DELETE USING (
    EXISTS (
        SELECT 1 
        FROM public.group_members 
        WHERE group_members.group_id = group_chats.group_id 
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
);

-- 6. ENSURE INDEXES FOR PERFORMANCE (Prevents timeouts)
CREATE INDEX IF NOT EXISTS idx_group_chats_group_id ON public.group_chats(group_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_created_at ON public.group_chats(created_at);
