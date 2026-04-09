-- Fix RLS team_members : supprimer la policy manager_read_downline_team
-- qui causait une récursion infinie (sous-requête sur team_members dans la policy team_members)
-- La policy "Public can read team members by slug" (USING true) suffit pour tous les accès

DROP POLICY IF EXISTS "manager_read_downline_team" ON team_members;
