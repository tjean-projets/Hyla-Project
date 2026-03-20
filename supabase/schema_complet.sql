-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'partner');

-- Create user_roles table (required for proper role management)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create partners table
CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    invite_code TEXT UNIQUE NOT NULL,
    invite_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    invite_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Create lead_status enum
CREATE TYPE public.lead_status AS ENUM ('RECU', 'CONTACTE', 'DEVIS', 'SIGNE', 'PERDU');

-- Create leads table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    
    -- Prospect info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes_partner TEXT,
    
    -- Consent
    consent_confirmed BOOLEAN NOT NULL DEFAULT false,
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    consent_text_version TEXT DEFAULT 'checkbox_v1',
    
    -- Status & pricing
    status lead_status NOT NULL DEFAULT 'RECU',
    annual_premium_estimated NUMERIC,
    annual_premium_final NUMERIC,
    commission_estimated NUMERIC,
    commission_final NUMERIC,
    
    -- Admin fields
    admin_notes TEXT,
    lost_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create lead_events table (audit trail)
CREATE TABLE public.lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on lead_events
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- Function to get partner_id for current user
CREATE OR REPLACE FUNCTION public.get_partner_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.partners WHERE user_id = _user_id LIMIT 1
$$;

-- Partners RLS policies
CREATE POLICY "Partners can view their own profile"
ON public.partners FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all partners"
ON public.partners FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage partners"
ON public.partners FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view partners by invite code"
ON public.partners FOR SELECT
USING (invite_code IS NOT NULL);

-- Leads RLS policies
CREATE POLICY "Partners can view their own leads"
ON public.leads FOR SELECT
USING (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can insert their own leads"
ON public.leads FOR INSERT
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can update limited fields on their leads"
ON public.leads FOR UPDATE
USING (partner_id = public.get_partner_id_for_user(auth.uid()))
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Admins can view all leads"
ON public.leads FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all leads"
ON public.leads FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Lead events RLS policies
CREATE POLICY "Partners can view events for their leads"
ON public.lead_events FOR SELECT
USING (
  lead_id IN (
    SELECT id FROM public.leads WHERE partner_id = public.get_partner_id_for_user(auth.uid())
  )
);

CREATE POLICY "Partners can insert events for their leads"
ON public.lead_events FOR INSERT
WITH CHECK (
  lead_id IN (
    SELECT id FROM public.leads WHERE partner_id = public.get_partner_id_for_user(auth.uid())
  )
);

CREATE POLICY "Admins can view all events"
ON public.lead_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all events"
ON public.lead_events FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at on leads
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-calculate commission when premium is set
CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate estimated commission (40% of estimated premium)
    IF NEW.annual_premium_estimated IS NOT NULL THEN
        NEW.commission_estimated = NEW.annual_premium_estimated * 0.40;
    END IF;
    
    -- Calculate final commission (40% of final premium)
    IF NEW.annual_premium_final IS NOT NULL THEN
        NEW.commission_final = NEW.annual_premium_final * 0.40;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculate_lead_commission
    BEFORE INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_commission();

-- Trigger to create audit events on lead changes
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.lead_events (lead_id, event_type, new_value, created_by)
        VALUES (NEW.id, 'CREATED', to_jsonb(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log status change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'STATUS_CHANGE', jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status), auth.uid());
        END IF;
        
        -- Log premium changes
        IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'PREMIUM_ESTIMATED_CHANGE', jsonb_build_object('annual_premium_estimated', OLD.annual_premium_estimated), jsonb_build_object('annual_premium_estimated', NEW.annual_premium_estimated), auth.uid());
        END IF;
        
        IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'PREMIUM_FINAL_CHANGE', jsonb_build_object('annual_premium_final', OLD.annual_premium_final), jsonb_build_object('annual_premium_final', NEW.annual_premium_final), auth.uid());
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_lead_changes_trigger
    AFTER INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.log_lead_changes();-- Create a trigger function to enforce column-level restrictions for partners
-- Partners can only update: first_name, last_name, phone, email, notes_partner
-- They CANNOT update: status, commission_estimated, commission_final, annual_premium_estimated,
-- annual_premium_final, admin_notes, consent_confirmed, consent_timestamp, consent_text_version, lost_reason

CREATE OR REPLACE FUNCTION public.enforce_partner_lead_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  
  -- If admin, allow all updates
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  -- For non-admins (partners), enforce column restrictions
  -- Prevent changes to sensitive fields by reverting them to old values
  
  -- Status can only be changed by admin
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Partners cannot modify lead status';
  END IF;
  
  -- Commission fields are admin-only
  IF OLD.commission_estimated IS DISTINCT FROM NEW.commission_estimated THEN
    RAISE EXCEPTION 'Partners cannot modify commission_estimated';
  END IF;
  
  IF OLD.commission_final IS DISTINCT FROM NEW.commission_final THEN
    RAISE EXCEPTION 'Partners cannot modify commission_final';
  END IF;
  
  -- Premium fields are admin-only
  IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN
    RAISE EXCEPTION 'Partners cannot modify annual_premium_estimated';
  END IF;
  
  IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN
    RAISE EXCEPTION 'Partners cannot modify annual_premium_final';
  END IF;
  
  -- Admin notes are admin-only
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    RAISE EXCEPTION 'Partners cannot modify admin_notes';
  END IF;
  
  -- Lost reason is admin-only
  IF OLD.lost_reason IS DISTINCT FROM NEW.lost_reason THEN
    RAISE EXCEPTION 'Partners cannot modify lost_reason';
  END IF;
  
  -- Consent fields are immutable once set (cannot be changed by partners)
  IF OLD.consent_confirmed IS DISTINCT FROM NEW.consent_confirmed THEN
    RAISE EXCEPTION 'Partners cannot modify consent_confirmed';
  END IF;
  
  IF OLD.consent_timestamp IS DISTINCT FROM NEW.consent_timestamp THEN
    RAISE EXCEPTION 'Partners cannot modify consent_timestamp';
  END IF;
  
  IF OLD.consent_text_version IS DISTINCT FROM NEW.consent_text_version THEN
    RAISE EXCEPTION 'Partners cannot modify consent_text_version';
  END IF;
  
  -- partner_id cannot be changed
  IF OLD.partner_id IS DISTINCT FROM NEW.partner_id THEN
    RAISE EXCEPTION 'Partners cannot modify partner_id';
  END IF;
  
  -- All checks passed - allow update of allowed fields (first_name, last_name, phone, email, notes_partner)
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_partner_lead_restrictions ON public.leads;
CREATE TRIGGER enforce_partner_lead_restrictions
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_partner_lead_update_restrictions();-- Add input validation constraints to leads table
-- These constraints provide server-side validation for all lead inputs

-- First name: must be non-empty and max 100 chars
ALTER TABLE public.leads
  ADD CONSTRAINT leads_first_name_length 
  CHECK (length(first_name) > 0 AND length(first_name) <= 100);

-- Last name: must be non-empty and max 100 chars  
ALTER TABLE public.leads
  ADD CONSTRAINT leads_last_name_length 
  CHECK (length(last_name) > 0 AND length(last_name) <= 100);

-- Phone: must be between 10-20 chars (handles international formats)
ALTER TABLE public.leads
  ADD CONSTRAINT leads_phone_length 
  CHECK (length(phone) >= 10 AND length(phone) <= 20);

-- Email: optional but must be valid format if provided
ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_format 
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Partner notes: optional but max 2000 chars
ALTER TABLE public.leads
  ADD CONSTRAINT leads_notes_partner_length 
  CHECK (notes_partner IS NULL OR length(notes_partner) <= 2000);

-- Admin notes: optional but max 2000 chars
ALTER TABLE public.leads
  ADD CONSTRAINT leads_admin_notes_length 
  CHECK (admin_notes IS NULL OR length(admin_notes) <= 2000);-- ============================================
-- SÉCURISATION COMPLÈTE DE LA TABLE PARTNERS
-- ============================================

-- 1. Supprimer la policy publique problématique qui expose tous les partners
DROP POLICY IF EXISTS "Public can view partners by invite code" ON public.partners;

-- 2. Créer une vue sécurisée pour la validation des invitations
-- Cette vue n'expose QUE les champs nécessaires pour valider un code d'invitation
-- Les données sensibles (email, display_name, user_id) ne sont PAS exposées
CREATE OR REPLACE VIEW public.partner_invite_validation 
WITH (security_invoker = false) AS
SELECT 
  id,
  invite_code,
  invite_expires_at,
  invite_used_at,
  is_active
FROM public.partners;

-- 3. Révoquer tous les accès puis accorder uniquement l'accès anon à la vue
REVOKE ALL ON public.partner_invite_validation FROM public;
REVOKE ALL ON public.partner_invite_validation FROM anon;
REVOKE ALL ON public.partner_invite_validation FROM authenticated;

GRANT SELECT ON public.partner_invite_validation TO anon;
GRANT SELECT ON public.partner_invite_validation TO authenticated;

-- 4. Ajouter un commentaire pour documenter la vue
COMMENT ON VIEW public.partner_invite_validation IS 
'Vue publique restreinte pour validation des codes d''invitation. 
N''expose PAS les données sensibles (email, display_name, user_id).
Utilisée par la page /invite/:code pour vérifier la validité d''une invitation.';-- ============================================
-- CORRECTION: Changer la vue en SECURITY INVOKER
-- ============================================

-- Supprimer et recréer la vue avec security_invoker = true
-- Cela signifie que la vue exécutera les requêtes avec les permissions de l'utilisateur appelant
DROP VIEW IF EXISTS public.partner_invite_validation;

CREATE VIEW public.partner_invite_validation 
WITH (security_invoker = true) AS
SELECT 
  id,
  invite_code,
  invite_expires_at,
  invite_used_at,
  is_active
FROM public.partners;

-- Réaccorder les permissions
GRANT SELECT ON public.partner_invite_validation TO anon;
GRANT SELECT ON public.partner_invite_validation TO authenticated;

-- Maintenant il faut une policy sur partners pour permettre à la vue de fonctionner
-- Créer une policy SELECT restrictive qui ne permet l'accès qu'aux champs nécessaires
-- via une condition sur invite_code non null (pour la validation publique)
-- MAIS cette policy doit être restrictive et ne pas exposer toutes les données

-- En fait, avec security_invoker, anon n'aura pas accès car partners a des RLS strictes
-- Solution: Créer une fonction SECURITY DEFINER pour valider les invitations

-- Supprimons la vue et créons une fonction à la place
DROP VIEW IF EXISTS public.partner_invite_validation;

-- Créer une fonction sécurisée pour valider les codes d'invitation
CREATE OR REPLACE FUNCTION public.validate_partner_invite(p_invite_code text)
RETURNS TABLE (
  id uuid,
  invite_expires_at timestamptz,
  invite_used_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    invite_expires_at,
    invite_used_at,
    is_active
  FROM public.partners
  WHERE invite_code = p_invite_code
  LIMIT 1;
$$;

-- Permettre aux utilisateurs anonymes d'appeler cette fonction
GRANT EXECUTE ON FUNCTION public.validate_partner_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_partner_invite(text) TO authenticated;

-- Ajouter un commentaire
COMMENT ON FUNCTION public.validate_partner_invite IS 
'Fonction sécurisée pour valider un code d''invitation partenaire.
Retourne uniquement les champs nécessaires (id, expiration, utilisation, statut actif).
N''expose PAS les données sensibles (email, display_name, user_id).';-- ============================================
-- CORRECTION DES POLICIES RLS - RESTRICTIVE vs PERMISSIVE
-- ============================================
-- Le problème: toutes les policies sont RESTRICTIVE mais sans policy PERMISSIVE de base
-- Les policies RESTRICTIVE ne limitent QUE les accès déjà accordés par PERMISSIVE
-- Solution: Recréer les policies en mode PERMISSIVE (comportement par défaut)

-- ==========================================
-- TABLE: leads
-- ==========================================

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Partners can insert their own leads" ON public.leads;
DROP POLICY IF EXISTS "Partners can update limited fields on their leads" ON public.leads;
DROP POLICY IF EXISTS "Partners can view their own leads" ON public.leads;

-- Recréer en mode PERMISSIVE (par défaut)
CREATE POLICY "Admins can manage all leads" 
ON public.leads 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view their own leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can insert their own leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can update their own leads" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (partner_id = public.get_partner_id_for_user(auth.uid()))
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

-- ==========================================
-- TABLE: partners
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
DROP POLICY IF EXISTS "Admins can view all partners" ON public.partners;
DROP POLICY IF EXISTS "Partners can view their own profile" ON public.partners;

CREATE POLICY "Admins can manage partners" 
ON public.partners 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view their own profile" 
ON public.partners 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: lead_events
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage all events" ON public.lead_events;
DROP POLICY IF EXISTS "Admins can view all events" ON public.lead_events;
DROP POLICY IF EXISTS "Partners can insert events for their leads" ON public.lead_events;
DROP POLICY IF EXISTS "Partners can view events for their leads" ON public.lead_events;

CREATE POLICY "Admins can manage all events" 
ON public.lead_events 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view events for their leads" 
ON public.lead_events 
FOR SELECT 
TO authenticated
USING (lead_id IN (
  SELECT id FROM public.leads 
  WHERE partner_id = public.get_partner_id_for_user(auth.uid())
));

CREATE POLICY "Partners can insert events for their leads" 
ON public.lead_events 
FOR INSERT 
TO authenticated
WITH CHECK (lead_id IN (
  SELECT id FROM public.leads 
  WHERE partner_id = public.get_partner_id_for_user(auth.uid())
));

-- ==========================================
-- TABLE: user_roles
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
-- 1. Create contract_type enum
CREATE TYPE public.contract_type AS ENUM ('emprunteur', 'prevoyance', 'rc_pro', 'sante', 'decennale');

-- 2. Create partner_type enum
CREATE TYPE public.partner_type AS ENUM ('professional', 'private');

-- 3. Add contract_type and consent_document_url to leads
ALTER TABLE public.leads ADD COLUMN contract_type public.contract_type;
ALTER TABLE public.leads ADD COLUMN consent_document_url text;

-- 4. Add partner_type to partners
ALTER TABLE public.partners ADD COLUMN partner_type public.partner_type DEFAULT 'professional';

-- 5. Create commission_rates table
CREATE TABLE public.commission_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    contract_type public.contract_type NOT NULL,
    rate_percent numeric NOT NULL DEFAULT 40,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (partner_id, contract_type)
);

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission rates"
ON public.commission_rates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners can view their own rates"
ON public.commission_rates FOR SELECT TO authenticated
USING (partner_id = public.get_partner_id_for_user(auth.uid()));

-- 6. Create partner_documents table
CREATE TABLE public.partner_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.partner_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage partner documents"
ON public.partner_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners can view their own documents"
ON public.partner_documents FOR SELECT TO authenticated
USING (partner_id = public.get_partner_id_for_user(auth.uid()));

-- 7. Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage RLS policies
CREATE POLICY "Admins can manage all storage documents"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners can view their own storage documents"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = public.get_partner_id_for_user(auth.uid())::text
);

-- 8. Update calculate_commission to use commission_rates
CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    rate numeric;
BEGIN
    -- Get partner-specific rate for this contract type
    IF NEW.contract_type IS NOT NULL THEN
        SELECT rate_percent INTO rate
        FROM public.commission_rates
        WHERE partner_id = NEW.partner_id
          AND contract_type = NEW.contract_type;
    END IF;
    
    -- Default to 40% if no specific rate configured
    IF rate IS NULL THEN
        rate := 40;
    END IF;
    
    -- Calculate estimated commission
    IF NEW.annual_premium_estimated IS NOT NULL THEN
        NEW.commission_estimated = NEW.annual_premium_estimated * (rate / 100);
    END IF;
    
    -- Calculate final commission
    IF NEW.annual_premium_final IS NOT NULL THEN
        NEW.commission_final = NEW.annual_premium_final * (rate / 100);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 1: Add new fields to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS montant numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS banque text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS type_projet text;

-- Step 2: Create tier_rules table
CREATE TABLE IF NOT EXISTS public.tier_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  min_signed integer NOT NULL,
  max_signed integer,
  rate_percent numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tier_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tier rules" ON public.tier_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view tier rules" ON public.tier_rules
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.tier_rules (tier_name, min_signed, max_signed, rate_percent) VALUES
  ('Palier 1', 0, 3, 50),
  ('Palier 2', 4, 7, 75),
  ('Palier 3', 8, NULL, 100);

-- Step 3: Drop triggers and functions that reference the old enum
DROP FUNCTION IF EXISTS public.enforce_partner_lead_update_restrictions() CASCADE;
DROP FUNCTION IF EXISTS public.log_lead_changes() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_commission() CASCADE;

-- Step 4: Create new enum and migrate status column
CREATE TYPE public.lead_status_new AS ENUM ('ANALYSE', 'SIMULATION', 'SIGNATURE', 'SIGNE', 'REFUSE');

ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN status TYPE public.lead_status_new
  USING (
    CASE status::text
      WHEN 'RECU' THEN 'ANALYSE'::public.lead_status_new
      WHEN 'CONTACTE' THEN 'SIMULATION'::public.lead_status_new
      WHEN 'DEVIS' THEN 'SIGNATURE'::public.lead_status_new
      WHEN 'SIGNE' THEN 'SIGNE'::public.lead_status_new
      WHEN 'PERDU' THEN 'REFUSE'::public.lead_status_new
      ELSE 'ANALYSE'::public.lead_status_new
    END
  );

ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'ANALYSE'::public.lead_status_new;

DROP TYPE public.lead_status;
ALTER TYPE public.lead_status_new RENAME TO lead_status;

-- Step 5: Create get_partner_tier function
CREATE OR REPLACE FUNCTION public.get_partner_tier(p_partner_id uuid)
RETURNS TABLE(tier_name text, rate_percent numeric, signed_count bigint, min_signed integer, max_signed integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  WITH sc AS (
    SELECT COUNT(*)::bigint as cnt FROM public.leads WHERE partner_id = p_partner_id AND status = 'SIGNE'
  )
  SELECT tr.tier_name, tr.rate_percent, sc.cnt, tr.min_signed, tr.max_signed
  FROM public.tier_rules tr, sc
  WHERE sc.cnt >= tr.min_signed AND (tr.max_signed IS NULL OR sc.cnt <= tr.max_signed)
  ORDER BY tr.min_signed DESC
  LIMIT 1;
$$;

-- Step 6: Recreate functions
CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
DECLARE
    rate numeric;
BEGIN
    SELECT t.rate_percent INTO rate
    FROM public.get_partner_tier(NEW.partner_id) t;
    
    IF rate IS NULL THEN
        rate := 50;
    END IF;
    
    IF NEW.annual_premium_estimated IS NOT NULL THEN
        NEW.commission_estimated = NEW.annual_premium_estimated * (rate / 100);
    END IF;
    
    IF NEW.annual_premium_final IS NOT NULL THEN
        NEW.commission_final = NEW.annual_premium_final * (rate / 100);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_partner_lead_update_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  IF is_admin THEN RETURN NEW; END IF;
  
  IF OLD.status IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'Partners cannot modify lead status'; END IF;
  IF OLD.commission_estimated IS DISTINCT FROM NEW.commission_estimated THEN RAISE EXCEPTION 'Partners cannot modify commission_estimated'; END IF;
  IF OLD.commission_final IS DISTINCT FROM NEW.commission_final THEN RAISE EXCEPTION 'Partners cannot modify commission_final'; END IF;
  IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN RAISE EXCEPTION 'Partners cannot modify annual_premium_estimated'; END IF;
  IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN RAISE EXCEPTION 'Partners cannot modify annual_premium_final'; END IF;
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN RAISE EXCEPTION 'Partners cannot modify admin_notes'; END IF;
  IF OLD.lost_reason IS DISTINCT FROM NEW.lost_reason THEN RAISE EXCEPTION 'Partners cannot modify lost_reason'; END IF;
  IF OLD.consent_confirmed IS DISTINCT FROM NEW.consent_confirmed THEN RAISE EXCEPTION 'Partners cannot modify consent_confirmed'; END IF;
  IF OLD.consent_timestamp IS DISTINCT FROM NEW.consent_timestamp THEN RAISE EXCEPTION 'Partners cannot modify consent_timestamp'; END IF;
  IF OLD.consent_text_version IS DISTINCT FROM NEW.consent_text_version THEN RAISE EXCEPTION 'Partners cannot modify consent_text_version'; END IF;
  IF OLD.partner_id IS DISTINCT FROM NEW.partner_id THEN RAISE EXCEPTION 'Partners cannot modify partner_id'; END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.lead_events (lead_id, event_type, new_value, created_by)
        VALUES (NEW.id, 'CREATED', to_jsonb(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'STATUS_CHANGE', jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status), auth.uid());
        END IF;
        IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'PREMIUM_ESTIMATED_CHANGE', jsonb_build_object('annual_premium_estimated', OLD.annual_premium_estimated), jsonb_build_object('annual_premium_estimated', NEW.annual_premium_estimated), auth.uid());
        END IF;
        IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'PREMIUM_FINAL_CHANGE', jsonb_build_object('annual_premium_final', OLD.annual_premium_final), jsonb_build_object('annual_premium_final', NEW.annual_premium_final), auth.uid());
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Step 7: Create triggers
CREATE TRIGGER tr_calculate_commission
  BEFORE INSERT OR UPDATE OF annual_premium_estimated, annual_premium_final, contract_type
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_commission();

CREATE TRIGGER tr_enforce_partner_restrictions
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_partner_lead_update_restrictions();

CREATE TRIGGER tr_log_lead_changes
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_changes();

CREATE TRIGGER tr_update_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add aggregation columns to partners table
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS total_leads integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_signed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue numeric NOT NULL DEFAULT 0;

-- Create get_motivation_data function
CREATE OR REPLACE FUNCTION public.get_motivation_data(p_partner_id uuid)
RETURNS TABLE(
  current_tier_name text,
  current_rate numeric,
  signed_count bigint,
  next_tier_name text,
  next_rate numeric,
  dossiers_manquants integer,
  bonus_potentiel numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_signed bigint;
  v_current_rate numeric;
  v_current_tier text;
  v_next_tier_name text;
  v_next_rate numeric;
  v_next_min integer;
  v_total_commission numeric;
BEGIN
  -- Count signed leads
  SELECT COUNT(*) INTO v_signed FROM public.leads WHERE partner_id = p_partner_id AND status = 'SIGNE';

  -- Get current tier
  SELECT tr.tier_name, tr.rate_percent INTO v_current_tier, v_current_rate
  FROM public.tier_rules tr
  WHERE v_signed >= tr.min_signed AND (tr.max_signed IS NULL OR v_signed <= tr.max_signed)
  ORDER BY tr.min_signed DESC
  LIMIT 1;

  IF v_current_rate IS NULL THEN
    v_current_rate := 50;
    v_current_tier := 'Palier 1';
  END IF;

  -- Get next tier
  SELECT tr.tier_name, tr.rate_percent, tr.min_signed INTO v_next_tier_name, v_next_rate, v_next_min
  FROM public.tier_rules tr
  WHERE tr.min_signed > v_signed
  ORDER BY tr.min_signed ASC
  LIMIT 1;

  -- Calculate total commissions at current rate
  SELECT COALESCE(SUM(COALESCE(annual_premium_final, annual_premium_estimated, 0)), 0) INTO v_total_commission
  FROM public.leads WHERE partner_id = p_partner_id AND status = 'SIGNE';

  RETURN QUERY SELECT
    v_current_tier,
    v_current_rate,
    v_signed,
    v_next_tier_name,
    v_next_rate,
    CASE WHEN v_next_min IS NOT NULL THEN (v_next_min - v_signed::integer) ELSE 0 END,
    CASE WHEN v_next_rate IS NOT NULL THEN (v_total_commission * (v_next_rate - v_current_rate) / 100) ELSE 0::numeric END;
END;
$$;

-- Create sync function: update partner aggregates on lead changes
CREATE OR REPLACE FUNCTION public.sync_partner_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner_id uuid;
BEGIN
  v_partner_id := COALESCE(NEW.partner_id, OLD.partner_id);
  
  UPDATE public.partners SET
    total_leads = (SELECT COUNT(*) FROM public.leads WHERE partner_id = v_partner_id),
    total_signed = (SELECT COUNT(*) FROM public.leads WHERE partner_id = v_partner_id AND status = 'SIGNE'),
    total_revenue = (SELECT COALESCE(SUM(COALESCE(annual_premium_final, annual_premium_estimated, 0)), 0) FROM public.leads WHERE partner_id = v_partner_id AND status = 'SIGNE')
  WHERE id = v_partner_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to sync stats on lead insert/update/delete
DROP TRIGGER IF EXISTS trg_sync_partner_stats ON public.leads;
CREATE TRIGGER trg_sync_partner_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_stats();
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Payment tracking on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- Function: on status change to SIGNE, create notifications + check tier promotion
CREATE OR REPLACE FUNCTION public.on_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_old_tier_name text;
  v_old_rate numeric;
  v_new_tier_name text;
  v_new_rate numeric;
  v_signed_count bigint;
BEGIN
  -- Only on status change
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get partner info
  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  IF v_partner IS NULL THEN RETURN NEW; END IF;

  -- Get admin user_ids
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';

  -- Notify partner of status change
  IF v_partner.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_partner.user_id,
      CASE NEW.status
        WHEN 'SIMULATION' THEN 'Dossier en simulation'
        WHEN 'SIGNATURE' THEN 'Dossier en signature'
        WHEN 'SIGNE' THEN '🎉 Dossier signé !'
        WHEN 'REFUSE' THEN 'Dossier refusé'
        ELSE 'Statut mis à jour'
      END,
      'Le dossier de ' || NEW.first_name || ' ' || NEW.last_name || ' est passé en ' || NEW.status,
      CASE WHEN NEW.status = 'SIGNE' THEN 'success' WHEN NEW.status = 'REFUSE' THEN 'error' ELSE 'info' END,
      '/leads/' || NEW.id
    );
  END IF;

  -- On SIGNE: check tier promotion
  IF NEW.status = 'SIGNE' AND OLD.status != 'SIGNE' THEN
    -- Get tier BEFORE this change
    SELECT t.tier_name, t.rate_percent INTO v_old_tier_name, v_old_rate
    FROM public.get_partner_tier(NEW.partner_id) t;

    -- Count signed including this one
    SELECT COUNT(*) INTO v_signed_count FROM public.leads 
    WHERE partner_id = NEW.partner_id AND status = 'SIGNE';

    -- Get new tier
    SELECT tr.tier_name, tr.rate_percent INTO v_new_tier_name, v_new_rate
    FROM public.tier_rules tr
    WHERE v_signed_count >= tr.min_signed AND (tr.max_signed IS NULL OR v_signed_count <= tr.max_signed)
    ORDER BY tr.min_signed DESC LIMIT 1;

    -- If tier changed, notify partner
    IF v_new_rate IS NOT NULL AND v_old_rate IS NOT NULL AND v_new_rate > v_old_rate AND v_partner.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🏆 Nouveau palier débloqué !',
        'Félicitations ! Vous passez à ' || v_new_rate || '% (' || v_new_tier_name || ')',
        'success',
        '/dashboard'
      );
    END IF;

    -- Notify admins of signed deal
    IF v_admin_users IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_users LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_admin_id,
          '✅ Dossier signé',
          NEW.first_name || ' ' || NEW.last_name || ' signé par ' || v_partner.display_name,
          'success',
          '/admin/leads/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_lead_status_change ON public.leads;
CREATE TRIGGER trg_on_lead_status_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.on_lead_status_change();

-- Function: on new lead, notify admins
CREATE OR REPLACE FUNCTION public.on_new_lead_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner record;
  v_admin_users uuid[];
  v_admin_id uuid;
BEGIN
  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';

  IF v_admin_users IS NOT NULL THEN
    FOREACH v_admin_id IN ARRAY v_admin_users LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_admin_id,
        '📥 Nouveau lead reçu',
        NEW.first_name || ' ' || NEW.last_name || ' ajouté par ' || COALESCE(v_partner.display_name, 'Inconnu') || COALESCE(' - ' || NEW.type_projet, ''),
        'info',
        '/admin/leads/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_new_lead_notify ON public.leads;
CREATE TRIGGER trg_on_new_lead_notify
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.on_new_lead_notify();

-- Enable realtime on notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Fix overly permissive insert policy - restrict to triggers/system only via security definer functions
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Allow admins to insert notifications (for manual notifications)
-- Regular inserts come from SECURITY DEFINER triggers which bypass RLS
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 1. Update on_lead_status_change with exact message templates
CREATE OR REPLACE FUNCTION public.on_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_old_tier_name text;
  v_old_rate numeric;
  v_new_tier_name text;
  v_new_rate numeric;
  v_signed_count bigint;
  v_commission numeric;
  v_status_emoji text;
  v_status_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  IF v_partner IS NULL THEN RETURN NEW; END IF;

  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';

  -- Status emoji mapping
  v_status_emoji := CASE NEW.status
    WHEN 'ANALYSE' THEN '📋'
    WHEN 'SIMULATION' THEN '📊'
    WHEN 'SIGNATURE' THEN '✍️'
    WHEN 'SIGNE' THEN '🎉'
    WHEN 'REFUSE' THEN '❌'
    ELSE '📌'
  END;

  v_status_label := CASE NEW.status
    WHEN 'ANALYSE' THEN 'Analyse'
    WHEN 'SIMULATION' THEN 'Simulation'
    WHEN 'SIGNATURE' THEN 'Signature'
    WHEN 'SIGNE' THEN 'Signé'
    WHEN 'REFUSE' THEN 'Refusé'
    ELSE NEW.status
  END;

  v_commission := COALESCE(NEW.commission_final, NEW.commission_estimated, 0);

  -- Notify partner of status change
  IF v_partner.user_id IS NOT NULL THEN
    IF NEW.status = 'SIGNE' THEN
      -- Succès Signature template
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🎉 Dossier signé !',
        '🎉 Dossier ' || NEW.first_name || ' ' || NEW.last_name || ' signé ! +' || v_commission || '€ générés.',
        'success',
        '/leads/' || NEW.id
      );
    ELSE
      -- Mise à jour statut template
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        v_status_emoji || ' Dossier ' || v_status_label,
        v_status_emoji || ' Votre dossier ' || NEW.first_name || ' ' || NEW.last_name || ' est passé en ' || v_status_label || '.',
        CASE WHEN NEW.status = 'REFUSE' THEN 'error' ELSE 'info' END,
        '/leads/' || NEW.id
      );
    END IF;
  END IF;

  -- On SIGNE: check tier promotion
  IF NEW.status = 'SIGNE' AND OLD.status != 'SIGNE' THEN
    -- Get tier BEFORE counting this new one
    SELECT t.tier_name, t.rate_percent INTO v_old_tier_name, v_old_rate
    FROM public.get_partner_tier(NEW.partner_id) t;

    SELECT COUNT(*) INTO v_signed_count FROM public.leads 
    WHERE partner_id = NEW.partner_id AND status = 'SIGNE';

    -- Get new tier based on updated count
    SELECT tr.tier_name, tr.rate_percent INTO v_new_tier_name, v_new_rate
    FROM public.tier_rules tr
    WHERE v_signed_count >= tr.min_signed AND (tr.max_signed IS NULL OR v_signed_count <= tr.max_signed)
    ORDER BY tr.min_signed DESC LIMIT 1;

    -- Promotion Palier template
    IF v_new_rate IS NOT NULL AND v_old_rate IS NOT NULL AND v_new_rate > v_old_rate AND v_partner.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🚀 Nouveau palier débloqué !',
        '🚀 Félicitations ! Vous atteignez le palier ' || v_new_rate || '%. Vos gains sont boostés.',
        'success',
        '/dashboard'
      );
    END IF;

    -- Notify admins of signed deal
    IF v_admin_users IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_users LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_admin_id,
          '✅ Dossier signé',
          '✅ ' || NEW.first_name || ' ' || NEW.last_name || ' signé par ' || v_partner.display_name || '. +' || v_commission || '€.',
          'success',
          '/admin/leads/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update on_new_lead_notify with exact template
CREATE OR REPLACE FUNCTION public.on_new_lead_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partner record;
  v_admin_users uuid[];
  v_admin_id uuid;
BEGIN
  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';

  IF v_admin_users IS NOT NULL THEN
    FOREACH v_admin_id IN ARRAY v_admin_users LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_admin_id,
        '📥 Nouveau Lead',
        '📥 Nouveau Lead de ' || COALESCE(v_partner.display_name, 'Inconnu') || ' pour ' || NEW.first_name || ' ' || NEW.last_name || '.',
        'info',
        '/admin/leads/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create recalculate_partner_commissions function
CREATE OR REPLACE FUNCTION public.recalculate_partner_commissions(p_partner_id uuid)
RETURNS TABLE(
  updated_count integer,
  current_rate numeric,
  next_rate numeric,
  extra_potential numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate numeric;
  v_next_rate numeric;
  v_updated integer;
  v_total_estimated numeric;
BEGIN
  -- Get current tier rate
  SELECT t.rate_percent INTO v_rate FROM public.get_partner_tier(p_partner_id) t;
  IF v_rate IS NULL THEN v_rate := 50; END IF;

  -- Get next tier rate
  SELECT tr.rate_percent INTO v_next_rate
  FROM public.tier_rules tr
  WHERE tr.min_signed > (SELECT COUNT(*) FROM public.leads WHERE partner_id = p_partner_id AND status = 'SIGNE')
  ORDER BY tr.min_signed ASC LIMIT 1;

  -- Update estimated commissions on non-signed leads
  UPDATE public.leads
  SET commission_estimated = annual_premium_estimated * (v_rate / 100)
  WHERE partner_id = p_partner_id
    AND status NOT IN ('SIGNE', 'REFUSE')
    AND annual_premium_estimated IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Calculate extra potential if at next tier
  SELECT COALESCE(SUM(COALESCE(annual_premium_estimated, 0)), 0) INTO v_total_estimated
  FROM public.leads
  WHERE partner_id = p_partner_id AND status NOT IN ('SIGNE', 'REFUSE');

  RETURN QUERY SELECT
    v_updated,
    v_rate,
    v_next_rate,
    CASE WHEN v_next_rate IS NOT NULL
      THEN v_total_estimated * ((v_next_rate - v_rate) / 100)
      ELSE 0::numeric
    END;
END;
$$;

-- 4. Create check_48h_alerts function (callable by admin or cron)
CREATE OR REPLACE FUNCTION public.check_48h_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_count integer := 0;
BEGIN
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';
  IF v_admin_users IS NULL THEN RETURN 0; END IF;

  FOR v_lead IN
    SELECT l.* FROM public.leads l
    WHERE l.status = 'ANALYSE'
      AND l.created_at < now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.link = '/admin/leads/' || l.id
          AND n.title LIKE '%48h%'
          AND n.created_at > now() - interval '24 hours'
      )
  LOOP
    FOREACH v_admin_id IN ARRAY v_admin_users LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_admin_id,
        '⚠️ Alerte 48h',
        '⚠️ Le dossier ' || v_lead.first_name || ' ' || v_lead.last_name || ' attend une action depuis 48h.',
        'warning',
        '/admin/leads/' || v_lead.id
      );
    END LOOP;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Add paiement_compagnie_recu to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS paiement_compagnie_recu boolean NOT NULL DEFAULT false;

-- Add validation_status to partner_documents
ALTER TABLE public.partner_documents ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending';

-- Create wallets table
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE UNIQUE,
  total_balance numeric NOT NULL DEFAULT 0,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wallets" ON public.wallets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view their own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (partner_id = get_partner_id_for_user(auth.uid()));

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  lead_ids uuid[] NOT NULL DEFAULT '{}',
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage withdrawal requests" ON public.withdrawal_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view their own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (partner_id = get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can insert withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (partner_id = get_partner_id_for_user(auth.uid()));

-- Function to sync wallet balances
CREATE OR REPLACE FUNCTION public.sync_wallet_balance(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available numeric;
  v_pending numeric;
  v_total numeric;
BEGIN
  -- Available: signed + company paid + not yet withdrawn
  SELECT COALESCE(SUM(COALESCE(commission_final, commission_estimated, 0)), 0) INTO v_available
  FROM public.leads
  WHERE partner_id = p_partner_id
    AND status = 'SIGNE'
    AND paiement_compagnie_recu = true
    AND is_paid = false;

  -- Pending: in withdrawal requests that are pending
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.withdrawal_requests
  WHERE partner_id = p_partner_id AND status = 'pending';

  v_total := v_available + v_pending;

  INSERT INTO public.wallets (partner_id, total_balance, available_balance, pending_balance, updated_at)
  VALUES (p_partner_id, v_total, v_available, v_pending, now())
  ON CONFLICT (partner_id)
  DO UPDATE SET total_balance = v_total, available_balance = v_available, pending_balance = v_pending, updated_at = now();
END;
$$;

-- Enable realtime on withdrawal_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;

-- Step 1: Add new enum values
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'NOUVEAU';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'EN_COURS';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'DEVIS_ENVOYE';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'PERDU';

-- Step 1: Drop restriction trigger and update all functions FIRST (before data migration)
DROP TRIGGER IF EXISTS tr_enforce_partner_restrictions ON public.leads;
DROP TRIGGER IF EXISTS trg_on_lead_status_change ON public.leads;

-- Now update the function with new statuses
CREATE OR REPLACE FUNCTION public.on_lead_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_partner record; v_admin_users uuid[]; v_admin_id uuid;
  v_old_rate numeric; v_new_tier_name text; v_new_rate numeric;
  v_signed_count bigint; v_commission numeric; v_status_emoji text; v_status_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  IF v_partner IS NULL THEN RETURN NEW; END IF;
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';
  v_status_emoji := CASE NEW.status::text
    WHEN 'NOUVEAU' THEN '📥' WHEN 'EN_COURS' THEN '📋' WHEN 'DEVIS_ENVOYE' THEN '📊'
    WHEN 'SIGNATURE' THEN '✍️' WHEN 'SIGNE' THEN '🎉' WHEN 'REFUSE' THEN '❌' WHEN 'PERDU' THEN '💨' ELSE '📌' END;
  v_status_label := CASE NEW.status::text
    WHEN 'NOUVEAU' THEN 'Nouveau' WHEN 'EN_COURS' THEN 'En cours' WHEN 'DEVIS_ENVOYE' THEN 'Devis envoyé'
    WHEN 'SIGNATURE' THEN 'Signature' WHEN 'SIGNE' THEN 'Signé' WHEN 'REFUSE' THEN 'Refusé' WHEN 'PERDU' THEN 'Perdu' ELSE NEW.status::text END;
  v_commission := COALESCE(NEW.commission_final, NEW.commission_estimated, 0);
  IF v_partner.user_id IS NOT NULL THEN
    IF NEW.status = 'SIGNE' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (
        v_partner.user_id, '🎉 Dossier signé !', '🎉 Dossier ' || NEW.first_name || ' ' || NEW.last_name || ' signé ! +' || v_commission || '€ générés.', 'success', '/leads/' || NEW.id);
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (
        v_partner.user_id, v_status_emoji || ' Dossier ' || v_status_label,
        v_status_emoji || ' Votre dossier ' || NEW.first_name || ' ' || NEW.last_name || ' est passé en ' || v_status_label || '.',
        CASE WHEN NEW.status IN ('REFUSE', 'PERDU') THEN 'error' ELSE 'info' END, '/leads/' || NEW.id);
    END IF;
  END IF;
  IF NEW.status = 'SIGNE' AND OLD.status != 'SIGNE' THEN
    SELECT t.rate_percent INTO v_old_rate FROM public.get_partner_tier(NEW.partner_id) t;
    SELECT COUNT(*) INTO v_signed_count FROM public.leads WHERE partner_id = NEW.partner_id AND status = 'SIGNE';
    SELECT tr.tier_name, tr.rate_percent INTO v_new_tier_name, v_new_rate FROM public.tier_rules tr
    WHERE v_signed_count >= tr.min_signed AND (tr.max_signed IS NULL OR v_signed_count <= tr.max_signed) ORDER BY tr.min_signed DESC LIMIT 1;
    IF v_new_rate IS NOT NULL AND v_old_rate IS NOT NULL AND v_new_rate > v_old_rate AND v_partner.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (
        v_partner.user_id, '🚀 Nouveau palier débloqué !', '🚀 Félicitations ! Vous atteignez le palier ' || v_new_rate || '%. Vos gains sont boostés.', 'success', '/dashboard');
    END IF;
    IF v_admin_users IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_users LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (
          v_admin_id, '✅ Dossier signé', '✅ ' || NEW.first_name || ' ' || NEW.last_name || ' signé par ' || v_partner.display_name || '. +' || v_commission || '€.', 'success', '/admin/leads/' || NEW.id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the status change trigger
CREATE TRIGGER trg_on_lead_status_change AFTER UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.on_lead_status_change();

-- Step 2: Now migrate data safely
UPDATE public.leads SET status = 'NOUVEAU' WHERE status = 'ANALYSE';
UPDATE public.leads SET status = 'EN_COURS' WHERE status = 'SIMULATION';
UPDATE public.leads SET status = 'DEVIS_ENVOYE' WHERE status = 'SIGNATURE';

-- Update lead_events
UPDATE public.lead_events SET new_value = jsonb_set(new_value, '{status}', '"NOUVEAU"') WHERE event_type = 'STATUS_CHANGE' AND new_value->>'status' = 'ANALYSE';
UPDATE public.lead_events SET new_value = jsonb_set(new_value, '{status}', '"EN_COURS"') WHERE event_type = 'STATUS_CHANGE' AND new_value->>'status' = 'SIMULATION';
UPDATE public.lead_events SET new_value = jsonb_set(new_value, '{status}', '"DEVIS_ENVOYE"') WHERE event_type = 'STATUS_CHANGE' AND new_value->>'status' = 'SIGNATURE';
UPDATE public.lead_events SET old_value = jsonb_set(old_value, '{status}', '"NOUVEAU"') WHERE event_type = 'STATUS_CHANGE' AND old_value->>'status' = 'ANALYSE';
UPDATE public.lead_events SET old_value = jsonb_set(old_value, '{status}', '"EN_COURS"') WHERE event_type = 'STATUS_CHANGE' AND old_value->>'status' = 'SIMULATION';
UPDATE public.lead_events SET old_value = jsonb_set(old_value, '{status}', '"DEVIS_ENVOYE"') WHERE event_type = 'STATUS_CHANGE' AND old_value->>'status' = 'SIGNATURE';

-- Change default
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'NOUVEAU'::lead_status;

-- Update other functions
CREATE OR REPLACE FUNCTION public.check_48h_alerts()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_lead record; v_admin_users uuid[]; v_admin_id uuid; v_count integer := 0;
BEGIN
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';
  IF v_admin_users IS NULL THEN RETURN 0; END IF;
  FOR v_lead IN SELECT l.* FROM public.leads l WHERE l.status = 'NOUVEAU' AND l.created_at < now() - interval '48 hours'
    AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.link = '/admin/leads/' || l.id AND n.title LIKE '%48h%' AND n.created_at > now() - interval '24 hours')
  LOOP
    FOREACH v_admin_id IN ARRAY v_admin_users LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link) VALUES (
        v_admin_id, '⚠️ Alerte 48h', '⚠️ Le dossier ' || v_lead.first_name || ' ' || v_lead.last_name || ' attend une action depuis 48h.', 'warning', '/admin/leads/' || v_lead.id);
    END LOOP;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_partner_commissions(p_partner_id uuid)
 RETURNS TABLE(updated_count integer, current_rate numeric, next_rate numeric, extra_potential numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rate numeric; v_next_rate numeric; v_updated integer; v_total_estimated numeric;
BEGIN
  SELECT t.rate_percent INTO v_rate FROM public.get_partner_tier(p_partner_id) t;
  IF v_rate IS NULL THEN v_rate := 50; END IF;
  SELECT tr.rate_percent INTO v_next_rate FROM public.tier_rules tr
  WHERE tr.min_signed > (SELECT COUNT(*) FROM public.leads WHERE partner_id = p_partner_id AND status = 'SIGNE') ORDER BY tr.min_signed ASC LIMIT 1;
  UPDATE public.leads SET commission_estimated = annual_premium_estimated * (v_rate / 100)
  WHERE partner_id = p_partner_id AND status NOT IN ('SIGNE', 'REFUSE', 'PERDU') AND annual_premium_estimated IS NOT NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  SELECT COALESCE(SUM(COALESCE(annual_premium_estimated, 0)), 0) INTO v_total_estimated
  FROM public.leads WHERE partner_id = p_partner_id AND status NOT IN ('SIGNE', 'REFUSE', 'PERDU');
  RETURN QUERY SELECT v_updated, v_rate, v_next_rate,
    CASE WHEN v_next_rate IS NOT NULL THEN v_total_estimated * ((v_next_rate - v_rate) / 100) ELSE 0::numeric END;
END;
$function$;

-- Recreate restriction trigger
CREATE TRIGGER tr_enforce_partner_restrictions BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_lead_update_restrictions();
-- CRITICAL FIX C-02: refonte enum lead_status + trigger status_change robuste

-- 1) Désactiver les triggers applicatifs pendant la migration des données
ALTER TABLE public.leads DISABLE TRIGGER USER;

-- 2) Nouveau type métier cible (5 statuts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'lead_status_new'
  ) THEN
    CREATE TYPE public.lead_status_new AS ENUM ('NOUVEAU', 'CONTACT', 'SIMULATION', 'SIGNE', 'REFUSE');
  END IF;
END $$;

-- 3) Migrer la colonne leads.status vers le nouveau type
ALTER TABLE public.leads
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN status TYPE public.lead_status_new
  USING (
    CASE status::text
      WHEN 'ANALYSE' THEN 'NOUVEAU'
      WHEN 'NOUVEAU' THEN 'NOUVEAU'
      WHEN 'EN_COURS' THEN 'CONTACT'
      WHEN 'CONTACT' THEN 'CONTACT'
      WHEN 'SIGNATURE' THEN 'CONTACT'
      WHEN 'SIMULATION' THEN 'SIMULATION'
      WHEN 'DEVIS_ENVOYE' THEN 'SIMULATION'
      WHEN 'SIGNE' THEN 'SIGNE'
      WHEN 'REFUSE' THEN 'REFUSE'
      WHEN 'PERDU' THEN 'REFUSE'
      ELSE 'NOUVEAU'
    END::public.lead_status_new
  );

ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'NOUVEAU'::public.lead_status_new;

-- 4) Normaliser aussi l'historique JSON des changements de statut
UPDATE public.lead_events
SET new_value = jsonb_set(new_value, '{status}', to_jsonb(
  CASE COALESCE(new_value->>'status', '')
    WHEN 'ANALYSE' THEN 'NOUVEAU'
    WHEN 'NOUVEAU' THEN 'NOUVEAU'
    WHEN 'EN_COURS' THEN 'CONTACT'
    WHEN 'CONTACT' THEN 'CONTACT'
    WHEN 'SIGNATURE' THEN 'CONTACT'
    WHEN 'SIMULATION' THEN 'SIMULATION'
    WHEN 'DEVIS_ENVOYE' THEN 'SIMULATION'
    WHEN 'SIGNE' THEN 'SIGNE'
    WHEN 'REFUSE' THEN 'REFUSE'
    WHEN 'PERDU' THEN 'REFUSE'
    ELSE 'NOUVEAU'
  END
))
WHERE event_type = 'STATUS_CHANGE' AND new_value ? 'status';

UPDATE public.lead_events
SET old_value = jsonb_set(old_value, '{status}', to_jsonb(
  CASE COALESCE(old_value->>'status', '')
    WHEN 'ANALYSE' THEN 'NOUVEAU'
    WHEN 'NOUVEAU' THEN 'NOUVEAU'
    WHEN 'EN_COURS' THEN 'CONTACT'
    WHEN 'CONTACT' THEN 'CONTACT'
    WHEN 'SIGNATURE' THEN 'CONTACT'
    WHEN 'SIMULATION' THEN 'SIMULATION'
    WHEN 'DEVIS_ENVOYE' THEN 'SIMULATION'
    WHEN 'SIGNE' THEN 'SIGNE'
    WHEN 'REFUSE' THEN 'REFUSE'
    WHEN 'PERDU' THEN 'REFUSE'
    ELSE 'NOUVEAU'
  END
))
WHERE event_type = 'STATUS_CHANGE' AND old_value ? 'status';

-- 5) Remplacer l'ancien type par le nouveau
ALTER TYPE public.lead_status RENAME TO lead_status_old;
ALTER TYPE public.lead_status_new RENAME TO lead_status;
DROP TYPE public.lead_status_old;

-- 6) Trigger STATUS_CHANGE corrigé : jamais de write enum via labels
CREATE OR REPLACE FUNCTION public.on_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_old_rate numeric;
  v_new_rate numeric;
  v_signed_count bigint;
  v_commission numeric;
  v_status_emoji text;
  v_status_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  IF v_partner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(user_id) INTO v_admin_users
  FROM public.user_roles
  WHERE role = 'admin';

  -- IMPORTANT: mapping d'affichage en TEXT uniquement (aucune réinsertion enum)
  v_status_emoji := CASE NEW.status::text
    WHEN 'NOUVEAU' THEN '📥'
    WHEN 'CONTACT' THEN '📞'
    WHEN 'SIMULATION' THEN '📊'
    WHEN 'SIGNE' THEN '🎉'
    WHEN 'REFUSE' THEN '❌'
    ELSE '📌'
  END;

  v_status_label := CASE NEW.status::text
    WHEN 'NOUVEAU' THEN 'Nouveau'
    WHEN 'CONTACT' THEN 'Contact'
    WHEN 'SIMULATION' THEN 'Simulation'
    WHEN 'SIGNE' THEN 'Signé'
    WHEN 'REFUSE' THEN 'Refusé'
    ELSE NEW.status::text
  END;

  v_commission := COALESCE(NEW.commission_final, NEW.commission_estimated, 0);

  IF v_partner.user_id IS NOT NULL THEN
    IF NEW.status = 'SIGNE' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🎉 Dossier signé !',
        '🎉 Dossier ' || NEW.first_name || ' ' || NEW.last_name || ' signé ! +' || v_commission || '€ générés.',
        'success',
        '/leads/' || NEW.id
      );
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        v_status_emoji || ' Dossier ' || v_status_label,
        v_status_emoji || ' Votre dossier ' || NEW.first_name || ' ' || NEW.last_name || ' est passé en ' || v_status_label || '.',
        CASE WHEN NEW.status = 'REFUSE' THEN 'error' ELSE 'info' END,
        '/leads/' || NEW.id
      );
    END IF;
  END IF;

  IF NEW.status = 'SIGNE' AND OLD.status != 'SIGNE' THEN
    SELECT t.rate_percent INTO v_old_rate
    FROM public.get_partner_tier(NEW.partner_id) t;

    SELECT COUNT(*) INTO v_signed_count
    FROM public.leads
    WHERE partner_id = NEW.partner_id
      AND status = 'SIGNE';

    SELECT tr.rate_percent INTO v_new_rate
    FROM public.tier_rules tr
    WHERE v_signed_count >= tr.min_signed
      AND (tr.max_signed IS NULL OR v_signed_count <= tr.max_signed)
    ORDER BY tr.min_signed DESC
    LIMIT 1;

    IF v_new_rate IS NOT NULL
       AND v_old_rate IS NOT NULL
       AND v_new_rate > v_old_rate
       AND v_partner.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🚀 Nouveau palier débloqué !',
        '🚀 Félicitations ! Vous atteignez le palier ' || v_new_rate || '%. Vos gains sont boostés.',
        'success',
        '/dashboard'
      );
    END IF;

    IF v_admin_users IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_users LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_admin_id,
          '✅ Dossier signé',
          '✅ ' || NEW.first_name || ' ' || NEW.last_name || ' signé par ' || v_partner.display_name || '. +' || v_commission || '€.',
          'success',
          '/admin/leads/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 7) Fonctions métier alignées sur les 5 statuts
CREATE OR REPLACE FUNCTION public.check_48h_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_count integer := 0;
BEGIN
  SELECT array_agg(user_id) INTO v_admin_users
  FROM public.user_roles
  WHERE role = 'admin';

  IF v_admin_users IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_lead IN
    SELECT l.*
    FROM public.leads l
    WHERE l.status = 'NOUVEAU'
      AND l.created_at < now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.link = '/admin/leads/' || l.id
          AND n.title LIKE '%48h%'
          AND n.created_at > now() - interval '24 hours'
      )
  LOOP
    FOREACH v_admin_id IN ARRAY v_admin_users LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_admin_id,
        '⚠️ Alerte 48h',
        '⚠️ Le dossier ' || v_lead.first_name || ' ' || v_lead.last_name || ' attend une action depuis 48h.',
        'warning',
        '/admin/leads/' || v_lead.id
      );
    END LOOP;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_partner_commissions(p_partner_id uuid)
RETURNS TABLE(updated_count integer, current_rate numeric, next_rate numeric, extra_potential numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_next_rate numeric;
  v_updated integer;
  v_total_estimated numeric;
BEGIN
  SELECT t.rate_percent INTO v_rate
  FROM public.get_partner_tier(p_partner_id) t;

  IF v_rate IS NULL THEN
    v_rate := 50;
  END IF;

  SELECT tr.rate_percent INTO v_next_rate
  FROM public.tier_rules tr
  WHERE tr.min_signed > (
    SELECT COUNT(*)
    FROM public.leads
    WHERE partner_id = p_partner_id
      AND status = 'SIGNE'
  )
  ORDER BY tr.min_signed ASC
  LIMIT 1;

  UPDATE public.leads
  SET commission_estimated = annual_premium_estimated * (v_rate / 100)
  WHERE partner_id = p_partner_id
    AND status NOT IN ('SIGNE', 'REFUSE')
    AND annual_premium_estimated IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COALESCE(SUM(COALESCE(annual_premium_estimated, 0)), 0)
  INTO v_total_estimated
  FROM public.leads
  WHERE partner_id = p_partner_id
    AND status NOT IN ('SIGNE', 'REFUSE');

  RETURN QUERY
  SELECT
    v_updated,
    v_rate,
    v_next_rate,
    CASE
      WHEN v_next_rate IS NOT NULL THEN v_total_estimated * ((v_next_rate - v_rate) / 100)
      ELSE 0::numeric
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_events (lead_id, event_type, new_value, created_by)
    VALUES (NEW.id, 'CREATED', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
      VALUES (
        NEW.id,
        'STATUS_CHANGE',
        jsonb_build_object('status', OLD.status::text),
        jsonb_build_object('status', NEW.status::text),
        auth.uid()
      );
    END IF;

    IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN
      INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
      VALUES (
        NEW.id,
        'PREMIUM_ESTIMATED_CHANGE',
        jsonb_build_object('annual_premium_estimated', OLD.annual_premium_estimated),
        jsonb_build_object('annual_premium_estimated', NEW.annual_premium_estimated),
        auth.uid()
      );
    END IF;

    IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN
      INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
      VALUES (
        NEW.id,
        'PREMIUM_FINAL_CHANGE',
        jsonb_build_object('annual_premium_final', OLD.annual_premium_final),
        jsonb_build_object('annual_premium_final', NEW.annual_premium_final),
        auth.uid()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 8) Réactiver les triggers applicatifs
ALTER TABLE public.leads ENABLE TRIGGER USER;
-- Add 4 new values to the existing lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'EN_COURS' AFTER 'NOUVEAU';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'DEVIS_ENVOYE' AFTER 'EN_COURS';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'SIGNATURE' AFTER 'DEVIS_ENVOYE';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'PERDU' AFTER 'REFUSE';

-- Update on_lead_status_change trigger to handle 7 statuses
CREATE OR REPLACE FUNCTION public.on_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_old_rate numeric;
  v_new_rate numeric;
  v_signed_count bigint;
  v_commission numeric;
  v_status_emoji text;
  v_status_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_partner FROM public.partners WHERE id = NEW.partner_id;
  IF v_partner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(user_id) INTO v_admin_users
  FROM public.user_roles
  WHERE role = 'admin';

  v_status_emoji := CASE NEW.status::text
    WHEN 'NOUVEAU' THEN '📥'
    WHEN 'EN_COURS' THEN '📋'
    WHEN 'CONTACT' THEN '📞'
    WHEN 'DEVIS_ENVOYE' THEN '📊'
    WHEN 'SIMULATION' THEN '📊'
    WHEN 'SIGNATURE' THEN '✍️'
    WHEN 'SIGNE' THEN '🎉'
    WHEN 'REFUSE' THEN '❌'
    WHEN 'PERDU' THEN '💨'
    ELSE '📌'
  END;

  v_status_label := CASE NEW.status::text
    WHEN 'NOUVEAU' THEN 'Nouveau'
    WHEN 'EN_COURS' THEN 'En cours'
    WHEN 'CONTACT' THEN 'Contact'
    WHEN 'DEVIS_ENVOYE' THEN 'Devis envoyé'
    WHEN 'SIMULATION' THEN 'Simulation'
    WHEN 'SIGNATURE' THEN 'Signature'
    WHEN 'SIGNE' THEN 'Signé'
    WHEN 'REFUSE' THEN 'Refusé'
    WHEN 'PERDU' THEN 'Perdu'
    ELSE NEW.status::text
  END;

  v_commission := COALESCE(NEW.commission_final, NEW.commission_estimated, 0);

  IF v_partner.user_id IS NOT NULL THEN
    IF NEW.status = 'SIGNE' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🎉 Dossier signé !',
        '🎉 Dossier ' || NEW.first_name || ' ' || NEW.last_name || ' signé ! +' || v_commission || '€ générés.',
        'success',
        '/leads/' || NEW.id
      );
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        v_status_emoji || ' Dossier ' || v_status_label,
        v_status_emoji || ' Votre dossier ' || NEW.first_name || ' ' || NEW.last_name || ' est passé en ' || v_status_label || '.',
        CASE WHEN NEW.status IN ('REFUSE', 'PERDU') THEN 'error' ELSE 'info' END,
        '/leads/' || NEW.id
      );
    END IF;
  END IF;

  IF NEW.status = 'SIGNE' AND OLD.status != 'SIGNE' THEN
    SELECT t.rate_percent INTO v_old_rate
    FROM public.get_partner_tier(NEW.partner_id) t;

    SELECT COUNT(*) INTO v_signed_count
    FROM public.leads
    WHERE partner_id = NEW.partner_id AND status = 'SIGNE';

    SELECT tr.rate_percent INTO v_new_rate
    FROM public.tier_rules tr
    WHERE v_signed_count >= tr.min_signed
      AND (tr.max_signed IS NULL OR v_signed_count <= tr.max_signed)
    ORDER BY tr.min_signed DESC
    LIMIT 1;

    IF v_new_rate IS NOT NULL AND v_old_rate IS NOT NULL
       AND v_new_rate > v_old_rate AND v_partner.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        v_partner.user_id,
        '🚀 Nouveau palier débloqué !',
        '🚀 Félicitations ! Vous atteignez le palier ' || v_new_rate || '%. Vos gains sont boostés.',
        'success',
        '/dashboard'
      );
    END IF;

    IF v_admin_users IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_users LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_admin_id,
          '✅ Dossier signé',
          '✅ ' || NEW.first_name || ' ' || NEW.last_name || ' signé par ' || v_partner.display_name || '. +' || v_commission || '€.',
          'success',
          '/admin/leads/' || NEW.id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update recalculate function for new statuses
CREATE OR REPLACE FUNCTION public.recalculate_partner_commissions(p_partner_id uuid)
RETURNS TABLE(updated_count integer, current_rate numeric, next_rate numeric, extra_potential numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_next_rate numeric;
  v_updated integer;
  v_total_estimated numeric;
BEGIN
  SELECT t.rate_percent INTO v_rate
  FROM public.get_partner_tier(p_partner_id) t;

  IF v_rate IS NULL THEN v_rate := 50; END IF;

  SELECT tr.rate_percent INTO v_next_rate
  FROM public.tier_rules tr
  WHERE tr.min_signed > (SELECT COUNT(*) FROM public.leads WHERE partner_id = p_partner_id AND status = 'SIGNE')
  ORDER BY tr.min_signed ASC LIMIT 1;

  UPDATE public.leads
  SET commission_estimated = annual_premium_estimated * (v_rate / 100)
  WHERE partner_id = p_partner_id
    AND status NOT IN ('SIGNE', 'REFUSE', 'PERDU')
    AND annual_premium_estimated IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COALESCE(SUM(COALESCE(annual_premium_estimated, 0)), 0)
  INTO v_total_estimated
  FROM public.leads WHERE partner_id = p_partner_id AND status NOT IN ('SIGNE', 'REFUSE', 'PERDU');

  RETURN QUERY SELECT v_updated, v_rate, v_next_rate,
    CASE WHEN v_next_rate IS NOT NULL THEN v_total_estimated * ((v_next_rate - v_rate) / 100) ELSE 0::numeric END;
END;
$$;

-- Update check_48h_alerts for new statuses
CREATE OR REPLACE FUNCTION public.check_48h_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_admin_users uuid[];
  v_admin_id uuid;
  v_count integer := 0;
BEGIN
  SELECT array_agg(user_id) INTO v_admin_users FROM public.user_roles WHERE role = 'admin';
  IF v_admin_users IS NULL THEN RETURN 0; END IF;

  FOR v_lead IN
    SELECT l.* FROM public.leads l
    WHERE l.status = 'NOUVEAU'
      AND l.created_at < now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.link = '/admin/leads/' || l.id AND n.title LIKE '%48h%' AND n.created_at > now() - interval '24 hours'
      )
  LOOP
    FOREACH v_admin_id IN ARRAY v_admin_users LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_admin_id, '⚠️ Alerte 48h', '⚠️ Le dossier ' || v_lead.first_name || ' ' || v_lead.last_name || ' attend une action depuis 48h.', 'warning', '/admin/leads/' || v_lead.id);
    END LOOP;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
-- Table: per-product commission configuration
CREATE TABLE public.product_commission_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type public.contract_type NOT NULL UNIQUE,
  commission_mode text NOT NULL DEFAULT 'tiered',
  fixed_rate_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: per-product tier rules
CREATE TABLE public.product_tier_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type public.contract_type NOT NULL,
  tier_name text NOT NULL,
  min_signed integer NOT NULL,
  max_signed integer,
  rate_percent numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_commission_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tier_rules ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage, authenticated can view
CREATE POLICY "Admins can manage product commission configs" ON public.product_commission_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view product commission configs" ON public.product_commission_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage product tier rules" ON public.product_tier_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view product tier rules" ON public.product_tier_rules
  FOR SELECT TO authenticated USING (true);

-- Seed default configs for all contract types (all start as tiered)
INSERT INTO public.product_commission_configs (contract_type, commission_mode, fixed_rate_percent) VALUES
  ('emprunteur', 'tiered', 0),
  ('prevoyance', 'tiered', 0),
  ('rc_pro', 'tiered', 0),
  ('sante', 'tiered', 0),
  ('decennale', 'tiered', 0);

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
-- Ajout des champs commission et frais de courtage sur les leads

-- Commission de base (ce que Thomas reçoit de la compagnie, à partager avec le partenaire)
-- Note: commission_estimated et commission_final existent déjà, on les utilise pour ça.

-- Frais de courtage
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS frais_courtage numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS frais_courtage_mode text DEFAULT NULL
    CHECK (frais_courtage_mode IN ('fixe', 'etale')),
  ADD COLUMN IF NOT EXISTS frais_courtage_mois integer DEFAULT NULL;

COMMENT ON COLUMN public.leads.frais_courtage IS 'Montant des frais de courtage HT';
COMMENT ON COLUMN public.leads.frais_courtage_mode IS 'Mode de paiement : fixe (en une fois) ou etale (sur plusieurs mois)';
COMMENT ON COLUMN public.leads.frais_courtage_mois IS 'Nombre de mois si mode = etale';
-- Ajout du champ économies réalisées sur les leads
-- Permet à l'admin de saisir les économies constatées pour chaque client signé

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS savings_achieved numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.leads.savings_achieved IS 'Économies réalisées par le client grâce à la mise en relation (€/an)';
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
-- Fonction RPC pour compléter l'inscription d'un partenaire
-- Remplace l'edge function complete-partner-signup (non déployée)
-- Accepte tous les domaines email (gmail, hotmail, outlook, etc.)

CREATE OR REPLACE FUNCTION public.complete_partner_signup(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_partner_email text;
  v_invite_used_at timestamptz;
  v_invite_expires_at timestamptz;
BEGIN
  -- Vérifier que l'utilisateur est authentifié
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Récupérer l'email de l'utilisateur depuis auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Récupérer les infos du partenaire
  SELECT email, invite_used_at, invite_expires_at
  INTO v_partner_email, v_invite_used_at, v_invite_expires_at
  FROM public.partners
  WHERE id = p_partner_id;

  IF v_partner_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Partner not found');
  END IF;

  IF v_invite_used_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Invitation already used');
  END IF;

  IF v_invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Invitation expired');
  END IF;

  -- Vérification email (insensible à la casse)
  IF lower(v_user_email) != lower(v_partner_email) THEN
    RETURN jsonb_build_object('error', 'Email does not match invitation');
  END IF;

  -- Lier le partenaire à l'utilisateur et marquer l'invitation comme utilisée
  UPDATE public.partners
  SET
    user_id = v_user_id,
    invite_used_at = now()
  WHERE id = p_partner_id;

  -- Ajouter le rôle partenaire
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'partner')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Permettre à tous les utilisateurs authentifiés d'appeler cette fonction
GRANT EXECUTE ON FUNCTION public.complete_partner_signup(uuid) TO authenticated;
-- Fonction RPC pour compléter l'inscription d'un partenaire
CREATE OR REPLACE FUNCTION public.complete_partner_signup(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_partner_email text;
  v_invite_used_at timestamptz;
  v_invite_expires_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT email, invite_used_at, invite_expires_at
  INTO v_partner_email, v_invite_used_at, v_invite_expires_at
  FROM public.partners WHERE id = p_partner_id;

  IF v_partner_email IS NULL THEN RETURN jsonb_build_object('error', 'Partner not found'); END IF;
  IF v_invite_used_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Invitation already used'); END IF;
  IF v_invite_expires_at < now() THEN RETURN jsonb_build_object('error', 'Invitation expired'); END IF;
  IF lower(v_user_email) != lower(v_partner_email) THEN RETURN jsonb_build_object('error', 'Email does not match invitation'); END IF;

  UPDATE public.partners SET user_id = v_user_id, invite_used_at = now() WHERE id = p_partner_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'partner') ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_partner_signup(uuid) TO authenticated;
