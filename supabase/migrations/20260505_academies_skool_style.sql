-- ── Refonte Skool-style : sections + progression + notification d'accès ──

-- Sections (modules) au sein d'une académie
CREATE TABLE IF NOT EXISTS academy_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_sections_academy ON academy_sections(academy_id);

-- academy_files : on rattache les fichiers à une section (nullable pour rétrocompatibilité)
ALTER TABLE academy_files
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES academy_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_academy_files_section ON academy_files(section_id);

-- Progression utilisateur sur les leçons (= academy_files vu comme leçons)
CREATE TABLE IF NOT EXISTS academy_file_progress (
  file_id      UUID NOT NULL REFERENCES academy_files(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (file_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_file_progress_user ON academy_file_progress(user_id);

-- ── RLS sur les nouvelles tables ──
ALTER TABLE academy_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_file_progress ENABLE ROW LEVEL SECURITY;

-- academy_sections : owner peut tout faire ; users avec accès peuvent lire
CREATE POLICY "academy_sections_owner_all" ON academy_sections
  USING (
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id = academy_sections.academy_id AND a.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id = academy_sections.academy_id AND a.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "academy_sections_with_access_read" ON academy_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_access aa
      WHERE aa.academy_id = academy_sections.academy_id AND aa.user_id = auth.uid()
    )
  );

-- academy_file_progress : chaque user gère sa propre progression
CREATE POLICY "academy_progress_self_all" ON academy_file_progress
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- L'owner de l'académie peut voir la progression de ceux qui ont accès (suivi formation)
CREATE POLICY "academy_progress_owner_read" ON academy_file_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_files af
      JOIN academies a ON a.id = af.academy_id
      WHERE af.id = academy_file_progress.file_id AND a.owner_user_id = auth.uid()
    )
  );

-- ── Trigger : notification quand un accès est accordé ──
CREATE OR REPLACE FUNCTION notify_academy_access_granted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_academy_name TEXT;
  v_academy_slug TEXT;
  v_owner_name TEXT;
BEGIN
  SELECT a.name, a.slug, COALESCE(p.full_name, 'Un manager')
    INTO v_academy_name, v_academy_slug, v_owner_name
  FROM academies a
  LEFT JOIN profiles p ON p.id = a.owner_user_id
  WHERE a.id = NEW.academy_id;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    NEW.user_id,
    '🎓 Nouvel accès académie',
    v_owner_name || ' t''a donné accès à ' || COALESCE(v_academy_name, 'une académie'),
    'success',
    '/academie/' || v_academy_slug
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS academy_access_notify ON academy_access;
CREATE TRIGGER academy_access_notify
  AFTER INSERT ON academy_access
  FOR EACH ROW EXECUTE FUNCTION notify_academy_access_granted();
