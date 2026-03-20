-- Fonction RPC pour compléter l'inscription d'un partenaire
CREATE OR REPLACE FUNCTION public.complete_partner_signup(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_partner_email text;
  v_invite_used_at timestamptz;
  v_invite_expires_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT email, invite_used_at, invite_expires_at
  INTO v_partner_email, v_invite_used_at, v_invite_expires_at
  FROM public.partners WHERE id = p_partner_id;

  IF v_partner_email IS NULL THEN RETURN jsonb_build_object('error', 'Partner not found'); END IF;
  IF v_invite_used_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Invitation already used'); END IF;
  IF v_invite_expires_at < now() THEN RETURN jsonb_build_object('error', 'Invitation expired'); END IF;
  IF lower(v_user_email) != lower(v_partner_email) THEN RETURN jsonb_build_object('error', 'Email does not match invitation'); END IF;

  UPDATE public.partners SET user_id = v_user_id, invite_used_at = now() WHERE id = p_partner_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'partner') ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_partner_signup(uuid) TO authenticated;
