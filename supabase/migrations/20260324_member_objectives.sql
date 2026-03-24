-- Table pour les objectifs des membres du réseau
CREATE TABLE IF NOT EXISTS member_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(32) UNIQUE NOT NULL,

  -- Objectifs texte
  objectif_mois TEXT,
  objectif_3mois TEXT,
  objectif_1an TEXT,
  actions TEXT,

  -- Chiffres objectifs
  ventes_objectif_mois INT DEFAULT 0,
  ventes_objectif_3mois INT DEFAULT 0,
  ventes_objectif_1an INT DEFAULT 0,
  recrues_objectif_mois INT DEFAULT 0,
  recrues_objectif_3mois INT DEFAULT 0,
  recrues_objectif_1an INT DEFAULT 0,

  -- Métadonnées
  filled_by_member BOOLEAN DEFAULT false,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour lookup par token (formulaire public)
CREATE INDEX idx_member_objectives_token ON member_objectives(token);

-- Index pour lookup par team_member_id
CREATE INDEX idx_member_objectives_member ON member_objectives(team_member_id);

-- RLS : le manager peut lire/écrire ses objectifs
ALTER TABLE member_objectives ENABLE ROW LEVEL SECURITY;

-- Policy : le manager (user_id) peut tout faire sur ses objectifs
CREATE POLICY "Users can manage their team objectives"
  ON member_objectives FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy : accès public en lecture par token (pour le formulaire)
CREATE POLICY "Public can read by token"
  ON member_objectives FOR SELECT
  USING (true);

-- Policy : accès public en update par token (pour le formulaire)
CREATE POLICY "Public can update by token"
  ON member_objectives FOR UPDATE
  USING (true)
  WITH CHECK (true);
