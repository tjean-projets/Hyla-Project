-- Permet de sélectionner les participants d'un challenge d'équipe
-- 'all' = tous les membres directs actifs ; 'selected' = uniquement les membres listés dans team_challenge_participants

ALTER TABLE team_challenges
  ADD COLUMN IF NOT EXISTS participants_mode TEXT NOT NULL DEFAULT 'all'
    CHECK (participants_mode IN ('all', 'selected'));

CREATE TABLE IF NOT EXISTS team_challenge_participants (
  challenge_id UUID NOT NULL REFERENCES team_challenges(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, member_id)
);

ALTER TABLE team_challenge_participants ENABLE ROW LEVEL SECURITY;

-- Le manager peut tout faire sur les participants de ses propres challenges
CREATE POLICY "tcp_manager_all" ON team_challenge_participants
  USING (
    EXISTS (
      SELECT 1 FROM team_challenges tc
      WHERE tc.id = team_challenge_participants.challenge_id
        AND tc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_challenges tc
      WHERE tc.id = team_challenge_participants.challenge_id
        AND tc.user_id = auth.uid()
    )
  );

-- Un membre peut lire les rangées qui le concernent (savoir qu'il est participant)
CREATE POLICY "tcp_member_read" ON team_challenge_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = team_challenge_participants.member_id
        AND tm.linked_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_tcp_challenge ON team_challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_tcp_member ON team_challenge_participants(member_id);
