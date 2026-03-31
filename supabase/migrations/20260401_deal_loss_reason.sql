ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS loss_reason_category TEXT
    CHECK (loss_reason_category IN ('prix', 'concurrent', 'pas_interesse', 'pas_de_reponse', 'besoin_reflechi', 'autre'));

CREATE INDEX IF NOT EXISTS idx_deals_loss_reason_category ON deals(loss_reason_category) WHERE loss_reason_category IS NOT NULL;
