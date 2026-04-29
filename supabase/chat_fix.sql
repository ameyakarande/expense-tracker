-- 1. Drop existing policies to start fresh
DROP POLICY IF EXISTS "members_can_view_chat" ON public.group_chats;
DROP POLICY IF EXISTS "members_can_send_messages" ON public.group_chats;
DROP POLICY IF EXISTS "admins_can_clear_chat" ON public.group_chats;

-- 2. Refined View Policy (Simplified for speed and reliability)
CREATE POLICY "members_can_view_chat" ON public.group_chats
FOR SELECT USING (
    group_id IN (
        SELECT m.group_id FROM public.group_members m
        WHERE m.user_id = auth.uid()
    )
);

-- 3. Refined Send Policy
CREATE POLICY "members_can_send_messages" ON public.group_chats
FOR INSERT WITH CHECK (
    group_id IN (
        SELECT m.group_id FROM public.group_members m
        WHERE m.user_id = auth.uid()
    )
    AND user_id = auth.uid()
);

-- 4. Refined Delete Policy
CREATE POLICY "admins_can_clear_chat" ON public.group_chats
FOR DELETE USING (
    group_id IN (
        SELECT m.group_id FROM public.group_members m
        WHERE m.user_id = auth.uid()
        AND m.role = 'admin'
    )
);

-- 5. Ensure Realtime is enabled for the table
-- If you get an error here, it means it's already enabled (which is fine)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'group_chats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
    END IF;
END $$;
