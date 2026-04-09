-- Ajout du niveau Hyla sur user_settings et team_members
-- 8 niveaux : vendeur | manager | chef_groupe | chef_agence |
--             distributeur | elite_bronze | elite_argent | elite_or

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS hyla_level TEXT NOT NULL DEFAULT 'manager';

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS hyla_level TEXT NOT NULL DEFAULT 'vendeur';
