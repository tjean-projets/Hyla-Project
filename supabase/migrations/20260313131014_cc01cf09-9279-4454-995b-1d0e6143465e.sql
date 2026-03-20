
-- Admin settings table for contract generation
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage their settings
CREATE POLICY "Admins can manage admin settings" ON public.admin_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for admin documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-documents', 'admin-documents', false);

-- Storage RLS: only admins can upload/read admin documents
CREATE POLICY "Admins can upload admin documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read admin documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admin-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete admin documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-documents' AND public.has_role(auth.uid(), 'admin'));
