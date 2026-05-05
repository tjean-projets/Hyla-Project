-- Challenges personnels : un user se fixe ses propres défis (visibles sur son dashboard)

CREATE TABLE IF NOT EXISTS personal_challenges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  objective_type TEXT NOT NULL DEFAULT 'ventes' CHECK (objective_type IN ('ventes', 'ca', 'recrues')),
  target_value   INTEGER NOT NULL DEFAULT 5,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  reward         TEXT,
  status         TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'terminé', 'annulé')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_challenges_user ON personal_challenges(user_id, status);

ALTER TABLE personal_challenges ENABLE ROW LEVEL SECURITY;

-- Chaque user gère ses propres challenges
CREATE POLICY "personal_challenges_self_all" ON personal_challenges
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Le manager (sponsor) peut voir les challenges de ses recrues directes
CREATE POLICY "personal_challenges_manager_read" ON personal_challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.linked_user_id = personal_challenges.user_id
        AND tm.user_id = auth.uid()
        AND tm.sponsor_id IS NULL
    )
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS personal_challenges_updated_at ON personal_challenges;
CREATE TRIGGER personal_challenges_updated_at
  BEFORE UPDATE ON personal_challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
