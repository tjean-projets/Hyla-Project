-- Permet à la recrue (l'user dont linked_user_id correspond au team_member) de lire ses objectifs

DROP POLICY IF EXISTS "Recruit can read own objectives" ON member_objectives;

CREATE POLICY "Recruit can read own objectives" ON member_objectives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = member_objectives.team_member_id
        AND tm.linked_user_id = auth.uid()
    )
  );
