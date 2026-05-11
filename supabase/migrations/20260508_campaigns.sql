-- ============================================================
-- Campagnes événementielles (fête des mères, Noël, salons, etc.)
-- Chaque user crée des campagnes avec un slug → génère un lien tracké
-- `/p/INVITE?src=<slug>` → clics + leads + conversions agrégés par campagne.
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,              -- ex "fete-des-meres-2026" (unique par owner)
  tag          TEXT NOT NULL,              -- ex "fete-des-meres" (appliqué au contact)
  color        TEXT NOT NULL DEFAULT '#ec4899',
  description  TEXT,
  start_date   DATE,
  end_date     DATE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archivee')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON campaigns(owner_id, slug);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_owner_all" ON campaigns
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Lecture publique LIMITÉE : on autorise la page publique /p/:invite à
-- résoudre une campagne par owner+slug pour la tracker (pas de SELECT *).
-- En pratique on filtre côté UI : SELECT id, tag, name WHERE owner=? AND slug=?
CREATE POLICY "campaigns_public_lookup" ON campaigns
  FOR SELECT USING (status = 'active');

DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Élargir les CHECK constraints pour accepter n'importe quel slug ──
-- (On garde la rétrocompat avec 'bio', 'story', 'direct')
ALTER TABLE public_leads
  DROP CONSTRAINT IF EXISTS public_leads_source_check;

ALTER TABLE contact_link_clicks
  DROP CONSTRAINT IF EXISTS contact_link_clicks_source_check;

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_link_source_check;

-- ── Lier les leads + clics + contacts à la campagne (nullable : pas de campagne = trafic organique) ──
ALTER TABLE public_leads
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE contact_link_clicks
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_public_leads_campaign ON public_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign ON contact_link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id);

-- ── RPC : stats agrégées pour une campagne (clics + leads + conversions) ──
CREATE OR REPLACE FUNCTION campaign_stats(p_campaign_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_clicks_total INT;
  v_leads_total INT;
  v_leads_converted INT;
  v_contacts_total INT;
  v_clients INT;
  v_recrues INT;
  v_clicks_by_day JSON;
BEGIN
  SELECT owner_id INTO v_owner FROM campaigns WHERE id = p_campaign_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_clicks_total FROM contact_link_clicks WHERE campaign_id = p_campaign_id;
  SELECT COUNT(*) INTO v_leads_total  FROM public_leads        WHERE campaign_id = p_campaign_id;
  SELECT COUNT(*) INTO v_leads_converted FROM public_leads     WHERE campaign_id = p_campaign_id AND status = 'converti';
  SELECT COUNT(*) INTO v_contacts_total FROM contacts          WHERE campaign_id = p_campaign_id;
  SELECT COUNT(*) INTO v_clients              FROM contacts    WHERE campaign_id = p_campaign_id AND status = 'cliente';
  SELECT COUNT(*) INTO v_recrues              FROM contacts    WHERE campaign_id = p_campaign_id AND status = 'recrue';

  SELECT json_agg(row_to_json(t)) INTO v_clicks_by_day FROM (
    SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS clicks
    FROM contact_link_clicks
    WHERE campaign_id = p_campaign_id
    GROUP BY 1
    ORDER BY 1
  ) t;

  RETURN json_build_object(
    'clicks_total',     v_clicks_total,
    'leads_total',      v_leads_total,
    'leads_converted',  v_leads_converted,
    'contacts_total',   v_contacts_total,
    'clients',          v_clients,
    'recrues',          v_recrues,
    'clicks_by_day',    COALESCE(v_clicks_by_day, '[]'::json)
  );
END
$$;

GRANT EXECUTE ON FUNCTION campaign_stats(UUID) TO authenticated;
