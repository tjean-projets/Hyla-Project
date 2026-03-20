-- ============================================
-- CORRECTION: Changer la vue en SECURITY INVOKER
-- ============================================

-- Supprimer et recréer la vue avec security_invoker = true
-- Cela signifie que la vue exécutera les requêtes avec les permissions de l'utilisateur appelant
DROP VIEW IF EXISTS public.partner_invite_validation;

CREATE VIEW public.partner_invite_validation 
WITH (security_invoker = true) AS
SELECT 
  id,
  invite_code,
  invite_expires_at,
  invite_used_at,
  is_active
FROM public.partners;

-- Réaccorder les permissions
GRANT SELECT ON public.partner_invite_validation TO anon;
GRANT SELECT ON public.partner_invite_validation TO authenticated;

-- Maintenant il faut une policy sur partners pour permettre à la vue de fonctionner
-- Créer une policy SELECT restrictive qui ne permet l'accès qu'aux champs nécessaires
-- via une condition sur invite_code non null (pour la validation publique)
-- MAIS cette policy doit être restrictive et ne pas exposer toutes les données

-- En fait, avec security_invoker, anon n'aura pas accès car partners a des RLS strictes
-- Solution: Créer une fonction SECURITY DEFINER pour valider les invitations

-- Supprimons la vue et créons une fonction à la place
DROP VIEW IF EXISTS public.partner_invite_validation;

-- Créer une fonction sécurisée pour valider les codes d'invitation
CREATE OR REPLACE FUNCTION public.validate_partner_invite(p_invite_code text)
RETURNS TABLE (
  id uuid,
  invite_expires_at timestamptz,
  invite_used_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    invite_expires_at,
    invite_used_at,
    is_active
  FROM public.partners
  WHERE invite_code = p_invite_code
  LIMIT 1;
$$;

-- Permettre aux utilisateurs anonymes d'appeler cette fonction
GRANT EXECUTE ON FUNCTION public.validate_partner_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_partner_invite(text) TO authenticated;

-- Ajouter un commentaire
COMMENT ON FUNCTION public.validate_partner_invite IS 
'Fonction sécurisée pour valider un code d''invitation partenaire.
Retourne uniquement les champs nécessaires (id, expiration, utilisation, statut actif).
N''expose PAS les données sensibles (email, display_name, user_id).';