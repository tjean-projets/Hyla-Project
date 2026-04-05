-- Colonnes abonnement sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial'
    CHECK (plan IN ('legacy', 'trial', 'conseillere', 'manager', 'expired')),
  ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trialing'
    CHECK (plan_status IN ('active', 'trialing', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_current_period_end TIMESTAMPTZ;

-- Utilisateurs existants → legacy (accès complet, pas de paiement)
UPDATE profiles
  SET plan = 'legacy',
      plan_status = 'active',
      trial_ends_at = NULL
  WHERE plan IS NULL OR plan = 'trial';

-- Index pour les lookups Stripe
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
