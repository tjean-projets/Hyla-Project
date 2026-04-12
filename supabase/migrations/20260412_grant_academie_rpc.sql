-- RPC permettant à un utilisateur avec can_grant_academie_access=true
-- de donner/retirer l'accès Respire Académie à un membre de son équipe directe.
-- SECURITY DEFINER = s'exécute avec les droits du créateur (contourne RLS).

CREATE OR REPLACE FUNCTION grant_academie_access(
  p_target_user_id UUID,
  p_value BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_email TEXT := auth.jwt() ->> 'email';
  v_can_grant BOOLEAN := false;
  v_is_super_admin BOOLEAN := false;
BEGIN
  -- Super admin peut tout faire
  IF v_caller_email IN ('thomas.jean28@outlook.fr', 't.jean@360courtage.fr') THEN
    v_is_super_admin := true;
  END IF;

  -- Vérifier can_grant_academie_access du caller
  IF NOT v_is_super_admin THEN
    SELECT COALESCE(can_grant_academie_access, false)
    INTO v_can_grant
    FROM user_settings
    WHERE user_id = v_caller_id;

    IF NOT v_can_grant THEN
      RAISE EXCEPTION 'Permission refusée : tu n''as pas le droit d''accorder l''accès Académie.';
    END IF;

    -- Vérifier que la cible est dans l'équipe directe du caller
    IF NOT EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = v_caller_id
        AND linked_user_id = p_target_user_id
    ) THEN
      RAISE EXCEPTION 'Permission refusée : cet utilisateur n''est pas dans ton équipe directe.';
    END IF;
  END IF;

  -- Upsert user_settings pour la cible
  INSERT INTO user_settings (user_id, respire_academie_access)
  VALUES (p_target_user_id, p_value)
  ON CONFLICT (user_id) DO UPDATE
  SET respire_academie_access = p_value;
END;
$$;
