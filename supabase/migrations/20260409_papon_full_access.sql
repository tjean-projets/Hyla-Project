-- Accès complet manager pour vd.respire@gmail.com (Papon)
-- role = 'manager' : tier Hyla (4+ partenaires actifs)

UPDATE profiles
SET role = 'manager'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'vd.respire@gmail.com'
);
