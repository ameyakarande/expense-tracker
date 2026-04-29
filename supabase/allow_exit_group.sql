-- Allow users to leave a group by deleting their own membership record
CREATE POLICY "Members can delete their own membership"
ON public.group_members
FOR DELETE
USING (user_id = auth.uid());
