-- Permet au super admin de modifier les user_settings de n'importe quel utilisateur
-- (nécessaire pour les toggles Respire Académie et Challenges dans AdminPanel)

CREATE POLICY "Admins can update all user_settings" ON user_settings
FOR UPDATE USING (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);

CREATE POLICY "Admins can insert all user_settings" ON user_settings
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR (auth.jwt() ->> 'email') IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr')
);
