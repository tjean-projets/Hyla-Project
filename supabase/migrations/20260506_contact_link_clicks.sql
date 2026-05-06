-- Tracking des clics et conversions sur la Page de contact (immutable)
-- Stocké pour donner aux users une vue stats sur les liens (Bio/Story/Direct)

CREATE TABLE IF NOT EXISTS contact_link_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('bio', 'story', 'direct', 'autre')),
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_link_clicks_owner ON contact_link_clicks(profile_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_link_clicks_source ON contact_link_clicks(profile_owner_id, source);

ALTER TABLE contact_link_clicks ENABLE ROW LEVEL SECURITY;

-- INSERT public (n'importe qui peut soumettre via le formulaire public)
CREATE POLICY "contact_link_clicks_public_insert" ON contact_link_clicks
  FOR INSERT WITH CHECK (true);

-- SELECT : seulement le propriétaire du profil voit ses clics
CREATE POLICY "contact_link_clicks_owner_select" ON contact_link_clicks
  FOR SELECT USING (profile_owner_id = auth.uid());

-- ⚠️ AUCUNE policy UPDATE/DELETE → table immutable.
-- Le propriétaire ne peut PAS supprimer une entrée même par erreur.
-- Si besoin de purge RGPD on passera par une fonction admin SECURITY DEFINER.

-- ── Source aussi tracée sur la fiche contact (immutable) ──
-- Stocke la source d'origine de chaque contact qui s'inscrit
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS link_source TEXT CHECK (link_source IN ('bio', 'story', 'direct', 'autre'));

COMMENT ON COLUMN contacts.link_source IS 'Source du lien utilisé pour s''inscrire (bio/story/direct/autre). Trace immuable de l''origine du contact.';
