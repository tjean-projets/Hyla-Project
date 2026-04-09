-- Date réelle de vente (distincte de created_at qui est la date d'import)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sold_at DATE;

-- Commentaire sur le champ product pour clarifier les valeurs Hyla
COMMENT ON COLUMN deals.product IS 'Pack Hyla vendu : NIMBUS, 2 PACKS, HYGIÈNE, etc.';
