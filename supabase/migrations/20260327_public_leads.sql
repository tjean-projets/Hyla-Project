-- ============================================================
-- Table: public_leads
-- Leads collected from the public contact page (/p/:inviteCode)
-- Anon users can INSERT, authenticated users can SELECT their own
-- ============================================================

CREATE TABLE IF NOT EXISTS public_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text,
  message text,
  intent text NOT NULL CHECK (intent IN ('acheter', 'devenir_conseiller', 'en_savoir_plus')),
  source text NOT NULL DEFAULT 'direct' CHECK (source IN ('bio', 'story', 'direct')),
  status text NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'converti')),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by profile
CREATE INDEX IF NOT EXISTS idx_public_leads_profile_id ON public_leads(profile_id);

-- RLS
ALTER TABLE public_leads ENABLE ROW LEVEL SECURITY;

-- Allow anon users to read basic profile info (for public contact page + join page)
-- Only if this policy doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'anon_select_profiles_by_invite_code'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "anon_select_profiles_by_invite_code"
        ON profiles
        FOR SELECT
        TO anon
        USING (invite_code IS NOT NULL)
    $policy$;
  END IF;
END
$$;

-- Allow anonymous (unauthenticated) users to INSERT leads
CREATE POLICY "anon_insert_leads"
  ON public_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read their own leads
CREATE POLICY "auth_select_own_leads"
  ON public_leads
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Allow authenticated users to update their own leads (e.g., mark as converted)
CREATE POLICY "auth_update_own_leads"
  ON public_leads
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
