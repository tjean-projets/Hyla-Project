-- Add sold_by to deals table: links a deal to a team member who made the sale
-- Used for pre-import commission estimation

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sold_by UUID REFERENCES team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_sold_by ON deals(sold_by);

-- View: pending commission estimates (deals not yet signed, with sold_by or own deals)
-- Used by Commissions page to show "en cours" estimations
CREATE OR REPLACE VIEW pending_commission_estimates AS
SELECT
  d.id AS deal_id,
  d.user_id,
  d.sold_by AS team_member_id,
  d.amount,
  d.product,
  d.status,
  d.created_at,
  d.contact_id,
  tm.first_name AS seller_first_name,
  tm.last_name  AS seller_last_name
FROM deals d
LEFT JOIN team_members tm ON tm.id = d.sold_by
WHERE d.status IN ('en_cours', 'en_attente');

-- RLS: owner can see their own estimates + managers can see their team's
ALTER VIEW pending_commission_estimates OWNER TO postgres;
