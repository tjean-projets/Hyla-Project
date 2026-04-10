-- Membre test pour Thomas (voir interface Équipes)
-- À exécuter dans Supabase SQL Editor, puis supprimer après test

INSERT INTO team_members (
  user_id,
  first_name,
  last_name,
  level,
  status,
  phone,
  email,
  internal_id,
  joined_at,
  matching_names
)
SELECT
  id,
  'Sophie',
  'Martin',
  1,
  'actif',
  '06 12 34 56 78',
  'sophie.martin@email.com',
  'HYL-TEST1',
  CURRENT_DATE,
  ARRAY['sophie martin']
FROM auth.users
WHERE email = 'thomas.jean28@outlook.fr'
ON CONFLICT DO NOTHING;
