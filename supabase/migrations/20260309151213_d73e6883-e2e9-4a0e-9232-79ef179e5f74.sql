
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
