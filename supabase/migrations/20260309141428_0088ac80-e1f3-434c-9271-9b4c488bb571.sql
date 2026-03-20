
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
