-- Commentaires sous chaque leçon (style Skool)

CREATE TABLE IF NOT EXISTS academy_lesson_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id      UUID NOT NULL REFERENCES academy_files(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  parent_id    UUID REFERENCES academy_lesson_comments(id) ON DELETE CASCADE, -- pour les réponses
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_comments_file ON academy_lesson_comments(file_id);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_comments_user ON academy_lesson_comments(user_id);

ALTER TABLE academy_lesson_comments ENABLE ROW LEVEL SECURITY;

-- Lecture : tous ceux qui ont accès à l'académie peuvent voir les commentaires
CREATE POLICY "academy_comments_with_access_read" ON academy_lesson_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_files af
      JOIN academies a ON a.id = af.academy_id
      WHERE af.id = academy_lesson_comments.file_id
        AND (
          a.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM academy_access aa
            WHERE aa.academy_id = a.id AND aa.user_id = auth.uid()
          )
        )
    )
  );

-- Écriture : ceux qui ont accès peuvent commenter
CREATE POLICY "academy_comments_with_access_insert" ON academy_lesson_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM academy_files af
      JOIN academies a ON a.id = af.academy_id
      WHERE af.id = academy_lesson_comments.file_id
        AND (
          a.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM academy_access aa
            WHERE aa.academy_id = a.id AND aa.user_id = auth.uid()
          )
        )
    )
  );

-- Modification / suppression : auteur uniquement (ou owner académie)
CREATE POLICY "academy_comments_author_update" ON academy_lesson_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "academy_comments_delete" ON academy_lesson_comments
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM academy_files af
      JOIN academies a ON a.id = af.academy_id
      WHERE af.id = academy_lesson_comments.file_id
        AND a.owner_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS academy_comments_updated_at ON academy_lesson_comments;
CREATE TRIGGER academy_comments_updated_at
  BEFORE UPDATE ON academy_lesson_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
