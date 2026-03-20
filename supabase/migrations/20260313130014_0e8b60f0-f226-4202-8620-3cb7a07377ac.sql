
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
