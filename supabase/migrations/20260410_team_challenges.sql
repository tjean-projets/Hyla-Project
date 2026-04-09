-- ── Challenges d'équipe ──
-- Un manager crée un challenge visible uniquement par ses membres directs (1ère ligne)

CREATE TABLE IF NOT EXISTS team_challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  objective_type TEXT NOT NULL DEFAULT 'ventes',  -- 'ventes' | 'ca' | 'recrues'
  target_value INTEGER NOT NULL DEFAULT 5,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reward       TEXT,
  status       TEXT NOT NULL DEFAULT 'actif',     -- 'actif' | 'terminé' | 'annulé'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE team_challenges ENABLE ROW LEVEL SECURITY;

-- Le manager voit et gère ses propres challenges
CREATE POLICY "challenges_manager_all" ON team_challenges
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Les membres directs (1ère ligne, linked_user_id) peuvent lire le challenge de leur manager
CREATE POLICY "challenges_member_read" ON team_challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = team_challenges.user_id
        AND tm.linked_user_id = auth.uid()
        AND tm.sponsor_id IS NULL
        AND tm.status = 'actif'
    )
  );

CREATE TRIGGER team_challenges_updated_at
  BEFORE UPDATE ON team_challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
