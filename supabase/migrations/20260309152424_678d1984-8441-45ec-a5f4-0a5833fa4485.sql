
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
