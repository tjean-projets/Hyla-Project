-- Ajouter slug et linked_user_id sur team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id);

-- Index pour recherche par slug (page d'inscription)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_slug ON team_members(slug) WHERE slug IS NOT NULL;

-- Policy pour permettre la lecture publique par slug (inscription)
CREATE POLICY "Public can read team members by slug"
  ON team_members FOR SELECT
  USING (true);

-- Policy pour permettre la mise à jour du linked_user_id lors de l'inscription
CREATE POLICY "Public can update linked_user_id"
  ON team_members FOR UPDATE
  USING (true)
  WITH CHECK (true);
