
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
