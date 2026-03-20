-- Ajout du champ économies réalisées sur les leads
-- Permet à l'admin de saisir les économies constatées pour chaque client signé

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS savings_achieved numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.leads.savings_achieved IS 'Économies réalisées par le client grâce à la mise en relation (€/an)';
