-- Ajouter les notes de suivi sur member_objectives
ALTER TABLE member_objectives ADD COLUMN IF NOT EXISTS notes_mois TEXT;
ALTER TABLE member_objectives ADD COLUMN IF NOT EXISTS notes_3mois TEXT;
ALTER TABLE member_objectives ADD COLUMN IF NOT EXISTS notes_1an TEXT;

-- Table pour stocker la config du formulaire objectifs (questions custom)
CREATE TABLE IF NOT EXISTS objectif_form_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE objectif_form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their form config"
  ON objectif_form_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public peut lire la config pour afficher le formulaire
CREATE POLICY "Public can read form config"
  ON objectif_form_config FOR SELECT
  USING (true);

-- Ajouter réponses custom sur member_objectives
ALTER TABLE member_objectives ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '[]';
