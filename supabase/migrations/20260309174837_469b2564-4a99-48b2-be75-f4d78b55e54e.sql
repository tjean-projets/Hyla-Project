
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
