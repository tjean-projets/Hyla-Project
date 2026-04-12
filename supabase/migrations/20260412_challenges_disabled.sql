-- Permet de désactiver les challenges Hyla pour un utilisateur spécifique
-- (ex: Véronique, nouvelle adhérente qui n'est pas concernée)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS challenges_disabled BOOLEAN NOT NULL DEFAULT false;
