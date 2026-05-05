-- Fix : la policy academy_storage_owner_all qualifiait `name` comme la colonne de academies au lieu du chemin de l'objet
-- Résultat : l'owner ne pouvait pas uploader dans son bucket

DROP POLICY IF EXISTS "academy_storage_owner_all" ON storage.objects;

CREATE POLICY "academy_storage_owner_all" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'academy-files' AND
    EXISTS (
      SELECT 1 FROM academies aa
      WHERE aa.id::text = (storage.foldername(storage.objects.name))[1]
        AND aa.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'academy-files' AND
    EXISTS (
      SELECT 1 FROM academies aa
      WHERE aa.id::text = (storage.foldername(storage.objects.name))[1]
        AND aa.owner_user_id = auth.uid()
    )
  );
