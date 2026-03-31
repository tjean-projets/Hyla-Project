-- Ajouter les colonnes d'objectifs personnels dans user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS monthly_sales_target INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_ca_target INT DEFAULT 0;
