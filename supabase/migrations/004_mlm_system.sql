-- =============================================
-- MLM System: sponsor chain + invite codes
-- =============================================

-- 1. Add sponsor_user_id and invite_code to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sponsor_user_id uuid REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- 2. Generate random invite codes for existing profiles
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS text AS $$
DECLARE
  chars text := 'abcdefghjkmnpqrstuvwxyz23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Backfill invite_code for existing profiles
UPDATE profiles SET invite_code = generate_invite_code() WHERE invite_code IS NULL;

-- 3. Auto-generate invite_code on new profile creation
CREATE OR REPLACE FUNCTION set_invite_code() RETURNS trigger AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_invite_code ON profiles;
CREATE TRIGGER tr_set_invite_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_invite_code();

-- 4. Recursive function to get full downline user IDs
CREATE OR REPLACE FUNCTION get_downline(root_user_id uuid)
RETURNS TABLE(user_id uuid, depth int) AS $$
  WITH RECURSIVE tree AS (
    SELECT p.id AS user_id, 1 AS depth
    FROM profiles p
    WHERE p.sponsor_user_id = root_user_id

    UNION ALL

    SELECT p.id AS user_id, t.depth + 1
    FROM profiles p
    INNER JOIN tree t ON p.sponsor_user_id = t.user_id
    WHERE t.depth < 10  -- safety limit
  )
  SELECT * FROM tree;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. RLS: allow reading profiles of downline members
CREATE POLICY "read_downline_profiles" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR sponsor_user_id = auth.uid()
    OR id IN (SELECT d.user_id FROM get_downline(auth.uid()) d)
  );

-- 6. RLS: allow manager to read downline's data tables
-- Contacts
DROP POLICY IF EXISTS "manager_read_downline_contacts" ON contacts;
CREATE POLICY "manager_read_downline_contacts" ON contacts
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id IN (SELECT d.user_id FROM get_downline(auth.uid()) d)
  );

-- Deals
DROP POLICY IF EXISTS "manager_read_downline_deals" ON deals;
CREATE POLICY "manager_read_downline_deals" ON deals
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id IN (SELECT d.user_id FROM get_downline(auth.uid()) d)
  );

-- Commissions
DROP POLICY IF EXISTS "manager_read_downline_commissions" ON commissions;
CREATE POLICY "manager_read_downline_commissions" ON commissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id IN (SELECT d.user_id FROM get_downline(auth.uid()) d)
  );

-- Team members
DROP POLICY IF EXISTS "manager_read_downline_team" ON team_members;
CREATE POLICY "manager_read_downline_team" ON team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id IN (SELECT d.user_id FROM get_downline(auth.uid()) d)
  );

-- Tasks
DROP POLICY IF EXISTS "manager_read_downline_tasks" ON tasks;
CREATE POLICY "manager_read_downline_tasks" ON tasks
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id IN (SELECT d.user_id FROM get_downline(auth.uid()) d)
  );
