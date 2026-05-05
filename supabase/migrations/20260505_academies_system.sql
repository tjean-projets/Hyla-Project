-- ── Système d'académies privées ──
-- Une académie appartient à un user (le propriétaire). Le propriétaire upload du contenu et gère qui y accède.
-- Cas d'usage : Véro a sa propre académie. Chaque PRO peut créer la sienne pour ses conseillers.
-- (Respire Académie reste séparé via user_settings.respire_academie_access — non migré ici.)

CREATE TABLE IF NOT EXISTS academies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  cover_image_url  TEXT,
  storage_quota_mb INT NOT NULL DEFAULT 5120,  -- 5 GB par défaut
  storage_used_mb  INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academies_owner ON academies(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_academies_slug ON academies(slug);

CREATE TABLE IF NOT EXISTS academy_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id   UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES auth.users(id),
  title        TEXT NOT NULL,
  description  TEXT,
  file_url     TEXT NOT NULL,        -- storage path OR external URL (Canva, YouTube…)
  file_type    TEXT NOT NULL CHECK (file_type IN ('video', 'image', 'pdf', 'document', 'link')),
  is_external  BOOLEAN NOT NULL DEFAULT false,
  file_size_mb INT,                  -- NULL pour les liens externes
  category     TEXT,                 -- catégorie libre saisie par l'admin
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_files_academy ON academy_files(academy_id);

CREATE TABLE IF NOT EXISTS academy_access (
  academy_id   UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by   UUID REFERENCES auth.users(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (academy_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_access_user ON academy_access(user_id);

-- ── RLS ──
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_access ENABLE ROW LEVEL SECURITY;

-- academies : owner peut tout faire ; users avec accès peuvent lire ; super admin (via JWT email) tout faire
CREATE POLICY "academies_owner_all" ON academies
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "academies_with_access_read" ON academies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_access aa
      WHERE aa.academy_id = academies.id AND aa.user_id = auth.uid()
    )
  );

-- academy_files : owner de l'académie peut tout faire, users avec accès peuvent lire
CREATE POLICY "academy_files_owner_all" ON academy_files
  USING (
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id = academy_files.academy_id AND a.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id = academy_files.academy_id AND a.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "academy_files_with_access_read" ON academy_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_access aa
      WHERE aa.academy_id = academy_files.academy_id AND aa.user_id = auth.uid()
    )
  );

-- academy_access : owner peut tout faire ; chaque user voit ses propres accès
CREATE POLICY "academy_access_owner_all" ON academy_access
  USING (
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id = academy_access.academy_id AND a.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id = academy_access.academy_id AND a.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "academy_access_self_read" ON academy_access
  FOR SELECT USING (user_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION academies_updated_at_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS academies_updated_at ON academies;
CREATE TRIGGER academies_updated_at
  BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION academies_updated_at_fn();
