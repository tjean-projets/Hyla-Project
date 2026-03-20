-- ============================================================
-- HYLA - Complete Schema Reset
-- CRM + MLM Network + Commission Tracking
-- ============================================================

-- Drop old tables from previous project (if they exist)
DROP TABLE IF EXISTS partner_documents CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS product_commission_configs CASCADE;
DROP TABLE IF EXISTS product_tier_rules CASCADE;
DROP TABLE IF EXISTS tier_rules CASCADE;
DROP TABLE IF EXISTS commission_rates CASCADE;
DROP TABLE IF EXISTS lead_events CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
DROP TABLE IF EXISTS partners CASCADE;

-- Drop old types
DROP TYPE IF EXISTS lead_status CASCADE;
DROP TYPE IF EXISTS contract_type CASCADE;
DROP TYPE IF EXISTS partner_type CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS check_48h_alerts CASCADE;
DROP FUNCTION IF EXISTS get_motivation_data CASCADE;
DROP FUNCTION IF EXISTS get_partner_id_for_user CASCADE;
DROP FUNCTION IF EXISTS get_partner_tier CASCADE;
DROP FUNCTION IF EXISTS recalculate_partner_commissions CASCADE;
DROP FUNCTION IF EXISTS sync_wallet_balance CASCADE;
DROP FUNCTION IF EXISTS validate_partner_invite CASCADE;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE contact_status AS ENUM (
  'prospect',
  'cliente',
  'recrue',
  'inactive',
  'perdue',
  'partenaire'
);

CREATE TYPE contact_priority AS ENUM ('basse', 'normale', 'haute', 'urgente');

CREATE TYPE deal_status AS ENUM (
  'en_cours',
  'signee',
  'annulee',
  'en_attente',
  'livree'
);

CREATE TYPE task_type AS ENUM ('relance', 'rdv', 'demo', 'suivi', 'admin', 'autre');
CREATE TYPE task_status AS ENUM ('a_faire', 'en_cours', 'terminee', 'annulee');

CREATE TYPE appointment_type AS ENUM ('rdv', 'demo', 'suivi', 'recrutement');
CREATE TYPE appointment_status AS ENUM ('planifie', 'realise', 'annule', 'reporte');

CREATE TYPE commission_type AS ENUM ('directe', 'reseau');
CREATE TYPE commission_source AS ENUM ('vente', 'import');
CREATE TYPE commission_status AS ENUM ('detectee', 'validee', 'en_attente', 'non_reconnue');

CREATE TYPE import_status AS ENUM ('en_cours', 'traite', 'partiel', 'erreur');
CREATE TYPE match_status AS ENUM ('auto', 'manuel', 'non_reconnu');

CREATE TYPE member_status AS ENUM ('actif', 'inactif');

-- ============================================================
-- TABLES
-- ============================================================

-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline stages (customizable Kanban columns)
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts (unified CRM)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  source TEXT,
  status contact_status NOT NULL DEFAULT 'prospect',
  priority contact_priority NOT NULL DEFAULT 'normale',
  tags TEXT[] DEFAULT '{}',
  pipeline_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_pipeline_stage ON contacts(pipeline_stage_id);

-- Team members (MLM network)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  internal_id TEXT,
  sponsor_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  level INT NOT NULL DEFAULT 1,
  status member_status NOT NULL DEFAULT 'actif',
  phone TEXT,
  email TEXT,
  joined_at DATE,
  matching_names TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_sponsor ON team_members(sponsor_id);

-- Deals (sales)
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  product TEXT,
  deal_type TEXT,
  status deal_status NOT NULL DEFAULT 'en_cours',
  signed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  sold_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  commission_direct NUMERIC(10,2) DEFAULT 0,
  commission_actual NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_signed_at ON deals(signed_at);

-- Commission imports (monthly file uploads)
CREATE TABLE commission_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT,
  period TEXT NOT NULL, -- YYYY-MM format
  status import_status NOT NULL DEFAULT 'en_cours',
  column_mapping JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_commission_imports_user_id ON commission_imports(user_id);
CREATE INDEX idx_commission_imports_period ON commission_imports(period);

-- Commission import rows (individual lines from import)
CREATE TABLE commission_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES commission_imports(id) ON DELETE CASCADE,
  raw_data JSONB NOT NULL DEFAULT '{}',
  matched_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  is_owner_row BOOLEAN NOT NULL DEFAULT false,
  match_confidence NUMERIC(5,2) DEFAULT 0,
  match_status match_status NOT NULL DEFAULT 'non_reconnu',
  amount NUMERIC(10,2) DEFAULT 0,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_rows_import_id ON commission_import_rows(import_id);
CREATE INDEX idx_import_rows_match_status ON commission_import_rows(match_status);

-- Commissions (consolidated)
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- YYYY-MM
  type commission_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  source commission_source NOT NULL DEFAULT 'vente',
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  import_row_id UUID REFERENCES commission_import_rows(id) ON DELETE SET NULL,
  status commission_status NOT NULL DEFAULT 'en_attente',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commissions_user_id ON commissions(user_id);
CREATE INDEX idx_commissions_period ON commissions(period);
CREATE INDEX idx_commissions_type ON commissions(type);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type task_type NOT NULL DEFAULT 'autre',
  status task_status NOT NULL DEFAULT 'a_faire',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type appointment_type NOT NULL DEFAULT 'rdv',
  status appointment_status NOT NULL DEFAULT 'planifie',
  date TIMESTAMPTZ NOT NULL,
  duration INT DEFAULT 60, -- minutes
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_date ON appointments(date);

-- Notes (contact interaction log)
CREATE TABLE contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_notes_contact_id ON contact_notes(contact_id);

-- User settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_mappings JSONB DEFAULT '{}',
  mlm_config JSONB DEFAULT '{}',
  notification_prefs JSONB DEFAULT '{"relances": true, "imports": true, "anomalies": true}',
  owner_matching_names TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit their own
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- All user-owned tables: same pattern
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pipeline_stages', 'contacts', 'team_members', 'deals',
    'commission_imports', 'commissions', 'tasks', 'appointments',
    'contact_notes', 'user_settings'
  ]) LOOP
    EXECUTE format('CREATE POLICY "%s_select_own" ON %I FOR SELECT USING (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert_own" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update_own" ON %I FOR UPDATE USING (auth.uid() = user_id)', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete_own" ON %I FOR DELETE USING (auth.uid() = user_id)', tbl, tbl);
  END LOOP;
END $$;

-- Import rows: access through import ownership
CREATE POLICY "import_rows_select" ON commission_import_rows FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM commission_imports ci WHERE ci.id = import_id AND ci.user_id = auth.uid()
  ));
CREATE POLICY "import_rows_insert" ON commission_import_rows FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM commission_imports ci WHERE ci.id = import_id AND ci.user_id = auth.uid()
  ));
CREATE POLICY "import_rows_update" ON commission_import_rows FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM commission_imports ci WHERE ci.id = import_id AND ci.user_id = auth.uid()
  ));
CREATE POLICY "import_rows_delete" ON commission_import_rows FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM commission_imports ci WHERE ci.id = import_id AND ci.user_id = auth.uid()
  ));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  -- Create default pipeline stages
  INSERT INTO pipeline_stages (user_id, name, position, color) VALUES
    (NEW.id, 'Nouveau contact', 0, '#6B7280'),
    (NEW.id, 'À appeler', 1, '#3B82F6'),
    (NEW.id, 'RDV à fixer', 2, '#8B5CF6'),
    (NEW.id, 'Démo prévue', 3, '#F59E0B'),
    (NEW.id, 'Démo faite', 4, '#F97316'),
    (NEW.id, 'En réflexion', 5, '#EC4899'),
    (NEW.id, 'Vente signée', 6, '#10B981'),
    (NEW.id, 'Vente perdue', 7, '#EF4444'),
    (NEW.id, 'À relancer', 8, '#6366F1'),
    (NEW.id, 'Fidélisation', 9, '#14B8A6');
  -- Create default settings
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Dashboard KPI function
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_user_id UUID,
  p_period_start DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_period_end DATE DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'ca_mois', COALESCE((SELECT SUM(amount) FROM deals WHERE user_id = p_user_id AND status = 'signee' AND signed_at >= p_period_start AND signed_at <= p_period_end), 0),
    'ca_annee', COALESCE((SELECT SUM(amount) FROM deals WHERE user_id = p_user_id AND status = 'signee' AND signed_at >= date_trunc('year', CURRENT_DATE)), 0),
    'ventes_signees', (SELECT COUNT(*) FROM deals WHERE user_id = p_user_id AND status = 'signee' AND signed_at >= p_period_start AND signed_at <= p_period_end),
    'rdv_pris', (SELECT COUNT(*) FROM appointments WHERE user_id = p_user_id AND date >= p_period_start AND date <= p_period_end),
    'demos_realisees', (SELECT COUNT(*) FROM appointments WHERE user_id = p_user_id AND type = 'demo' AND status = 'realise' AND date >= p_period_start AND date <= p_period_end),
    'commissions_mois_directe', COALESCE((SELECT SUM(amount) FROM commissions WHERE user_id = p_user_id AND period = to_char(p_period_start, 'YYYY-MM') AND type = 'directe' AND status = 'validee'), 0),
    'commissions_mois_reseau', COALESCE((SELECT SUM(amount) FROM commissions WHERE user_id = p_user_id AND period = to_char(p_period_start, 'YYYY-MM') AND type = 'reseau' AND status = 'validee'), 0),
    'commissions_annee', COALESCE((SELECT SUM(amount) FROM commissions WHERE user_id = p_user_id AND period >= to_char(date_trunc('year', CURRENT_DATE), 'YYYY-MM') AND status = 'validee'), 0),
    'nouvelles_recrues', (SELECT COUNT(*) FROM team_members WHERE user_id = p_user_id AND joined_at >= p_period_start AND joined_at <= p_period_end),
    'equipe_active', (SELECT COUNT(*) FROM team_members WHERE user_id = p_user_id AND status = 'actif'),
    'contacts_total', (SELECT COUNT(*) FROM contacts WHERE user_id = p_user_id),
    'prospects_actifs', (SELECT COUNT(*) FROM contacts WHERE user_id = p_user_id AND status = 'prospect')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commission consolidation after import validation
CREATE OR REPLACE FUNCTION consolidate_import_commissions(p_import_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_period TEXT;
  row RECORD;
BEGIN
  SELECT user_id, period INTO v_user_id, v_period
  FROM commission_imports WHERE id = p_import_id;

  -- Delete previous commissions from this import
  DELETE FROM commissions WHERE import_row_id IN (
    SELECT id FROM commission_import_rows WHERE import_id = p_import_id
  );

  -- Create commission entries for matched rows
  FOR row IN
    SELECT cir.id, cir.amount, cir.is_owner_row, cir.matched_member_id
    FROM commission_import_rows cir
    WHERE cir.import_id = p_import_id
      AND cir.match_status IN ('auto', 'manuel')
      AND cir.amount > 0
  LOOP
    INSERT INTO commissions (user_id, period, type, amount, source, team_member_id, import_row_id, status)
    VALUES (
      v_user_id,
      v_period,
      CASE WHEN row.is_owner_row THEN 'directe' ELSE 'reseau' END,
      row.amount,
      'import',
      row.matched_member_id,
      row.id,
      'validee'
    );
  END LOOP;

  -- Update import stats
  UPDATE commission_imports SET
    status = 'traite',
    processed_at = now(),
    stats = (
      SELECT json_build_object(
        'total_rows', COUNT(*),
        'matched_rows', COUNT(*) FILTER (WHERE match_status IN ('auto', 'manuel')),
        'unmatched_rows', COUNT(*) FILTER (WHERE match_status = 'non_reconnu'),
        'total_amount', COALESCE(SUM(amount) FILTER (WHERE match_status IN ('auto', 'manuel')), 0),
        'owner_amount', COALESCE(SUM(amount) FILTER (WHERE is_owner_row), 0),
        'network_amount', COALESCE(SUM(amount) FILTER (WHERE NOT is_owner_row AND match_status IN ('auto', 'manuel')), 0)
      )
      FROM commission_import_rows WHERE import_id = p_import_id
    )
  WHERE id = p_import_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done. Schema ready for Hyla CRM.
