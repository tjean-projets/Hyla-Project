-- Formation modules, lessons, progress + localisation membres

-- Modules de formation
CREATE TABLE IF NOT EXISTS formation_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  visible_from_level TEXT DEFAULT 'vendeur',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Leçons
CREATE TABLE IF NOT EXISTS formation_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES formation_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'youtube',
  content_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Progression par utilisateur
CREATE TABLE IF NOT EXISTS formation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES formation_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Content manager flag
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_content_manager BOOLEAN NOT NULL DEFAULT false;

-- Localisation membres (carte)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Localisation profil utilisateur
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- RLS
ALTER TABLE formation_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fm_read ON formation_modules;
DROP POLICY IF EXISTS fm_write ON formation_modules;
CREATE POLICY fm_read ON formation_modules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fm_write ON formation_modules FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM user_settings WHERE id = auth.uid() AND is_content_manager = true)
);

ALTER TABLE formation_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fl_read ON formation_lessons;
DROP POLICY IF EXISTS fl_write ON formation_lessons;
CREATE POLICY fl_read ON formation_lessons FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fl_write ON formation_lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM formation_modules m WHERE m.id = module_id AND (
    m.user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_settings WHERE id = auth.uid() AND is_content_manager = true)
  ))
);

ALTER TABLE formation_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fp_own ON formation_progress;
CREATE POLICY fp_own ON formation_progress FOR ALL USING (auth.uid() = user_id);
