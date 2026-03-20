
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
