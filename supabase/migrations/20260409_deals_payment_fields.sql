-- Champs paiement sur les ventes
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'comptant'
    CHECK (payment_type IN ('comptant', 'mensualites')),
  ADD COLUMN IF NOT EXISTS payment_months INT DEFAULT NULL
    CHECK (payment_months IS NULL OR (payment_months >= 10 AND payment_months <= 72)),
  ADD COLUMN IF NOT EXISTS bank_fees_offered BOOLEAN NOT NULL DEFAULT false;
