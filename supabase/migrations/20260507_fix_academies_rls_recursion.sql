-- Fix : "infinite recursion detected in policy for relation academies"
--
-- Le cycle :
--   academies_with_access_read (SELECT sur academies) → query academy_access
--   academy_access_owner_all (FOR ALL sur academy_access, applique à SELECT) → query academies
--   ↻ chacune réveille l'autre.
--
-- Symptôme : INSERT ... RETURNING sur academies (utilisé par MonAcademiePage)
-- déclenche les policies SELECT pour la clause RETURNING → recursion.
--
-- Solution : extraire les checks d'appartenance dans des fonctions SECURITY DEFINER
-- (qui bypassent RLS), donc plus de cycle.

DROP POLICY IF EXISTS "academies_with_access_read" ON academies;
DROP POLICY IF EXISTS "academy_access_owner_all" ON academy_access;

CREATE OR REPLACE FUNCTION is_academy_owner(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM academies
    WHERE id = p_academy_id AND owner_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION has_academy_access(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM academy_access
    WHERE academy_id = p_academy_id AND user_id = auth.uid()
  );
$$;

-- academies : un user voit son académie (academies_owner_all garde son rôle)
-- + les académies où il a un academy_access (via la fonction SECURITY DEFINER).
CREATE POLICY "academies_with_access_read" ON academies
  FOR SELECT USING (has_academy_access(id));

-- academy_access : on splite l'ancienne policy FOR ALL en 4 policies
-- (SELECT/INSERT/UPDATE/DELETE) qui passent toutes par is_academy_owner().
-- L'auto-lecture par l'invité reste assurée par academy_access_self_read (déjà en place).
CREATE POLICY "academy_access_owner_select" ON academy_access
  FOR SELECT USING (is_academy_owner(academy_id));

CREATE POLICY "academy_access_owner_insert" ON academy_access
  FOR INSERT WITH CHECK (is_academy_owner(academy_id));

CREATE POLICY "academy_access_owner_update" ON academy_access
  FOR UPDATE USING (is_academy_owner(academy_id))
  WITH CHECK (is_academy_owner(academy_id));

CREATE POLICY "academy_access_owner_delete" ON academy_access
  FOR DELETE USING (is_academy_owner(academy_id));
