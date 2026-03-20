-- Create a trigger function to enforce column-level restrictions for partners
-- Partners can only update: first_name, last_name, phone, email, notes_partner
-- They CANNOT update: status, commission_estimated, commission_final, annual_premium_estimated,
-- annual_premium_final, admin_notes, consent_confirmed, consent_timestamp, consent_text_version, lost_reason

CREATE OR REPLACE FUNCTION public.enforce_partner_lead_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  
  -- If admin, allow all updates
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  -- For non-admins (partners), enforce column restrictions
  -- Prevent changes to sensitive fields by reverting them to old values
  
  -- Status can only be changed by admin
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Partners cannot modify lead status';
  END IF;
  
  -- Commission fields are admin-only
  IF OLD.commission_estimated IS DISTINCT FROM NEW.commission_estimated THEN
    RAISE EXCEPTION 'Partners cannot modify commission_estimated';
  END IF;
  
  IF OLD.commission_final IS DISTINCT FROM NEW.commission_final THEN
    RAISE EXCEPTION 'Partners cannot modify commission_final';
  END IF;
  
  -- Premium fields are admin-only
  IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN
    RAISE EXCEPTION 'Partners cannot modify annual_premium_estimated';
  END IF;
  
  IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN
    RAISE EXCEPTION 'Partners cannot modify annual_premium_final';
  END IF;
  
  -- Admin notes are admin-only
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    RAISE EXCEPTION 'Partners cannot modify admin_notes';
  END IF;
  
  -- Lost reason is admin-only
  IF OLD.lost_reason IS DISTINCT FROM NEW.lost_reason THEN
    RAISE EXCEPTION 'Partners cannot modify lost_reason';
  END IF;
  
  -- Consent fields are immutable once set (cannot be changed by partners)
  IF OLD.consent_confirmed IS DISTINCT FROM NEW.consent_confirmed THEN
    RAISE EXCEPTION 'Partners cannot modify consent_confirmed';
  END IF;
  
  IF OLD.consent_timestamp IS DISTINCT FROM NEW.consent_timestamp THEN
    RAISE EXCEPTION 'Partners cannot modify consent_timestamp';
  END IF;
  
  IF OLD.consent_text_version IS DISTINCT FROM NEW.consent_text_version THEN
    RAISE EXCEPTION 'Partners cannot modify consent_text_version';
  END IF;
  
  -- partner_id cannot be changed
  IF OLD.partner_id IS DISTINCT FROM NEW.partner_id THEN
    RAISE EXCEPTION 'Partners cannot modify partner_id';
  END IF;
  
  -- All checks passed - allow update of allowed fields (first_name, last_name, phone, email, notes_partner)
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_partner_lead_restrictions ON public.leads;
CREATE TRIGGER enforce_partner_lead_restrictions
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_partner_lead_update_restrictions();