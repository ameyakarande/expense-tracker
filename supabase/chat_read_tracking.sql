-- Persistent Chat Read Tracking
-- Adds a timestamp to track when each member last read the group chat.
-- This enables unread message badges that persist across sessions and page refreshes.

-- 1. Add last_chat_read_at column to group_members
ALTER TABLE public.group_members 
ADD COLUMN IF NOT EXISTS last_chat_read_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Allow members to update their own last_chat_read_at
CREATE POLICY "Members can update their own read timestamp"
ON public.group_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
