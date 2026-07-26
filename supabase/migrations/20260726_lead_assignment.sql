-- Distribution de leads : le manager peut affecter un lead reçu à un membre
-- de son équipe pour qu'il sache que c'est à lui de le traiter.

ALTER TABLE public_leads
  ADD COLUMN IF NOT EXISTS assigned_to_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_public_leads_assigned ON public_leads(assigned_to_member_id);

COMMENT ON COLUMN public_leads.assigned_to_member_id IS
  'Membre équipe à qui le manager a affecté ce lead (dispatch interne). Nullable.';
