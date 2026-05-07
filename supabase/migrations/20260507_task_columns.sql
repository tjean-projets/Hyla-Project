-- Colonnes Kanban personnalisables pour les tâches (mirror de pipeline_stages).
--
-- Chaque user peut créer/renommer/supprimer ses colonnes Kanban dans Tâches.
-- L'enum task_status reste pour les filtres (À faire/Terminée) ; chaque colonne
-- pointe sur un base_status (le statut "réel" assigné quand on dépose une tâche
-- dans cette colonne — ainsi le tri "Terminée" et les rappels continuent de
-- fonctionner même avec des colonnes custom).

CREATE TABLE IF NOT EXISTS task_columns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  position     INT  NOT NULL DEFAULT 0,
  color        TEXT NOT NULL DEFAULT '#3b82f6',
  base_status  task_status NOT NULL DEFAULT 'a_faire',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_columns_user ON task_columns(user_id);

ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_columns_select_own" ON task_columns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "task_columns_insert_own" ON task_columns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_columns_update_own" ON task_columns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "task_columns_delete_own" ON task_columns
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS task_columns_updated_at ON task_columns;
CREATE TRIGGER task_columns_updated_at
  BEFORE UPDATE ON task_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Lien tâche → colonne (nullable : null = colonne déduite via base_status)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS column_id UUID REFERENCES task_columns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);

-- Seed les 3 colonnes par défaut pour chaque user existant
INSERT INTO task_columns (user_id, name, position, color, base_status, is_default)
SELECT id, 'À faire',  0, '#3b82f6', 'a_faire',  true FROM auth.users
ON CONFLICT DO NOTHING;
INSERT INTO task_columns (user_id, name, position, color, base_status, is_default)
SELECT id, 'En cours', 1, '#f59e0b', 'en_cours', true FROM auth.users
ON CONFLICT DO NOTHING;
INSERT INTO task_columns (user_id, name, position, color, base_status, is_default)
SELECT id, 'Terminée', 2, '#22c55e', 'terminee', true FROM auth.users
ON CONFLICT DO NOTHING;

-- Backfill : associer chaque tâche existante à sa colonne par défaut
UPDATE tasks t
   SET column_id = tc.id
  FROM task_columns tc
 WHERE tc.user_id = t.user_id
   AND tc.is_default = true
   AND tc.base_status = t.status
   AND t.column_id IS NULL;

-- Trigger : à la création d'un user, seed automatiquement ses 3 colonnes par défaut.
-- On greffe sur le trigger existant qui crée déjà user_settings + pipeline_stages.
CREATE OR REPLACE FUNCTION seed_task_columns_for_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO task_columns (user_id, name, position, color, base_status, is_default) VALUES
    (NEW.id, 'À faire',  0, '#3b82f6', 'a_faire',  true),
    (NEW.id, 'En cours', 1, '#f59e0b', 'en_cours', true),
    (NEW.id, 'Terminée', 2, '#22c55e', 'terminee', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_task_columns_on_user_create ON auth.users;
CREATE TRIGGER seed_task_columns_on_user_create
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION seed_task_columns_for_user();
