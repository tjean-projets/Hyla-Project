-- Ajout des champs commission et frais de courtage sur les leads

-- Commission de base (ce que Thomas reçoit de la compagnie, à partager avec le partenaire)
-- Note: commission_estimated et commission_final existent déjà, on les utilise pour ça.

-- Frais de courtage
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS frais_courtage numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frais_courtage_mode text DEFAULT NULL
    CHECK (frais_courtage_mode IN ('fixe', 'etale')),
  ADD COLUMN IF NOT EXISTS frais_courtage_mois integer DEFAULT NULL;

COMMENT ON COLUMN public.leads.frais_courtage IS 'Montant des frais de courtage HT';
COMMENT ON COLUMN public.leads.frais_courtage_mode IS 'Mode de paiement : fixe (en une fois) ou etale (sur plusieurs mois)';
COMMENT ON COLUMN public.leads.frais_courtage_mois IS 'Nombre de mois si mode = etale';
