-- Ajoute la permission Respire Académie dans user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS respire_academie_access BOOLEAN NOT NULL DEFAULT false;

-- Permet à certains users d'accorder l'accès (academy_admin)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS can_grant_academie_access BOOLEAN NOT NULL DEFAULT false;

-- Super admin peut tout modifier (pas de restriction RLS sur ça)
-- Les admins academy peuvent voir/modifier l'accès de leurs recrues directes
