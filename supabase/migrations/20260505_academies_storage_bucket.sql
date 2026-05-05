-- Bucket Storage pour les fichiers d'académie (privé, accessible uniquement via signed URLs)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy-files',
  'academy-files',
  false,
  524288000,  -- 500 MB par fichier
  ARRAY[
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'application/rtf', 'application/vnd.oasis.opendocument.text'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies sur storage.objects : owner peut upload/delete dans son académie ; users avec accès peuvent download
CREATE POLICY "academy_storage_owner_all" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'academy-files' AND
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND a.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'academy-files' AND
    EXISTS (
      SELECT 1 FROM academies a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND a.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "academy_storage_access_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'academy-files' AND
    EXISTS (
      SELECT 1 FROM academy_access aa
      WHERE aa.academy_id::text = (storage.foldername(name))[1]
        AND aa.user_id = auth.uid()
    )
  );
