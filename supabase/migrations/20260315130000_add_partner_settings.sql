-- Table des paramètres profil pour les partenaires (miroir de admin_settings)
CREATE TABLE public.partner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  siret text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  orias_number text NOT NULL DEFAULT '',
  cni_url text,
  justificatif_domicile_url text,
  kbis_url text,
  rib_url text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_settings ENABLE ROW LEVEL SECURITY;

-- Chaque partenaire ne peut gérer que ses propres paramètres
CREATE POLICY "Partners can manage own settings" ON public.partner_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Les admins peuvent lire les paramètres partenaires (pour génération de documents)
CREATE POLICY "Admins can read partner settings" ON public.partner_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bucket de stockage pour les documents partenaires (privé)
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-documents', 'partner-documents', false)
  ON CONFLICT (id) DO NOTHING;

-- Policies storage : chaque partenaire gère son propre dossier
CREATE POLICY "Partners can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Partners can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'partner-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Partners can update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'partner-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Partners can delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'partner-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins peuvent lire les documents partenaires
CREATE POLICY "Admins can read partner documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'partner-documents' AND public.has_role(auth.uid(), 'admin'));
