-- ─────────────────────────────────────────────────────────────────
-- Politiques RLS super admin — accès lecture totale pour impersonation
-- Appliquées manuellement dans Supabase Dashboard le 2026-04-10
-- ─────────────────────────────────────────────────────────────────

-- Profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT USING (
  auth.uid() = id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

-- Deals
CREATE POLICY "Admins can view all deals" ON deals
FOR SELECT USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

-- Contacts
CREATE POLICY "Admins can view all contacts" ON contacts
FOR SELECT USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

-- Commissions
CREATE POLICY "Admins can view all commissions" ON commissions
FOR SELECT USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

-- Team members
CREATE POLICY "Admins can view all team_members" ON team_members
FOR SELECT USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

-- Commission imports
CREATE POLICY "Admins can view all commission_imports" ON commission_imports
FOR SELECT USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

-- User settings
CREATE POLICY "Admins can view all user_settings" ON user_settings
FOR SELECT USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);
