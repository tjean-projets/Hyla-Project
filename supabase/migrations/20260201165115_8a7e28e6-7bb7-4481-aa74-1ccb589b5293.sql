-- ============================================
-- SÉCURISATION COMPLÈTE DE LA TABLE PARTNERS
-- ============================================

-- 1. Supprimer la policy publique problématique qui expose tous les partners
DROP POLICY IF EXISTS "Public can view partners by invite code" ON public.partners;

-- 2. Créer une vue sécurisée pour la validation des invitations
-- Cette vue n'expose QUE les champs nécessaires pour valider un code d'invitation
-- Les données sensibles (email, display_name, user_id) ne sont PAS exposées
CREATE OR REPLACE VIEW public.partner_invite_validation 
WITH (security_invoker = false) AS
SELECT 
  id,
  invite_code,
  invite_expires_at,
  invite_used_at,
  is_active
FROM public.partners;

-- 3. Révoquer tous les accès puis accorder uniquement l'accès anon à la vue
REVOKE ALL ON public.partner_invite_validation FROM public;
REVOKE ALL ON public.partner_invite_validation FROM anon;
REVOKE ALL ON public.partner_invite_validation FROM authenticated;

GRANT SELECT ON public.partner_invite_validation TO anon;
GRANT SELECT ON public.partner_invite_validation TO authenticated;

-- 4. Ajouter un commentaire pour documenter la vue
COMMENT ON VIEW public.partner_invite_validation IS 
'Vue publique restreinte pour validation des codes d''invitation. 
N''expose PAS les données sensibles (email, display_name, user_id).
Utilisée par la page /invite/:code pour vérifier la validité d''une invitation.';