-- Group Chat Table
CREATE TABLE IF NOT EXISTS public.group_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

-- Policy: Members can read chat
CREATE POLICY "members_can_view_chat" ON public.group_chats
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_chats.group_id
        AND user_id = auth.uid()
    )
    -- Auto-delete logic: Only show messages from the last 30 days
    AND created_at > (NOW() - INTERVAL '30 days')
);

-- Policy: Members can send messages
CREATE POLICY "members_can_send_messages" ON public.group_chats
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_chats.group_id
        AND user_id = auth.uid()
    )
);

-- Policy: Admins can delete chat history
CREATE POLICY "admins_can_clear_chat" ON public.group_chats
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_chats.group_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Enable Realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
