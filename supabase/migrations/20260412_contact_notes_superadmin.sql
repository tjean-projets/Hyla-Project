-- Super admin bypass pour contact_notes (impersonation)
CREATE POLICY "super_admin_all_contact_notes"
  ON contact_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email IN ('thomas.jean.pro@gmail.com', 'thomas@hylaassistant.com')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email IN ('thomas.jean.pro@gmail.com', 'thomas@hylaassistant.com')
    )
  );
