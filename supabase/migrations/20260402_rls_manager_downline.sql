-- Fix RLS: allow managers to read team_members of their downline users
-- Required by DownlineSection in NetworkPage to show nested team members

-- Policy: a user can read team_members where user_id matches a user
-- who is themselves a team_member of the current user (downline)
CREATE POLICY IF NOT EXISTS "manager_read_downline_team"
  ON team_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id IN (
      SELECT tm.supabase_user_id
      FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.supabase_user_id IS NOT NULL
    )
  );
