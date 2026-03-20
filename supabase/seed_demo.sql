-- =================================================================
-- DONNÉES DE DÉMONSTRATION — Hyla
-- 5 partenaires · 41 leads · pipeline réaliste
--
-- ▶ Coller et exécuter dans l'éditeur SQL Supabase
--   https://supabase.com/dashboard/project/[votre-projet]/sql
-- =================================================================

DO $$
DECLARE
  p_julien  UUID := gen_random_uuid();
  p_sophie  UUID := gen_random_uuid();
  p_lucas   UUID := gen_random_uuid();
  p_claire  UUID := gen_random_uuid();
  p_marc    UUID := gen_random_uuid();
BEGIN

-- =================================================================
-- 1. PARTENAIRES
-- =================================================================

INSERT INTO public.partners
  (id, user_id, display_name, email, is_active, partner_type,
   invite_code, invite_expires_at, invite_used_at, created_at)
VALUES
  (p_julien, NULL, 'Julien MARTIN',   'julien.martin@safti.fr',              true, 'professional', 'DEMO-JM01', NOW() + INTERVAL '365 days', NULL, NOW() - INTERVAL '45 days'),
  (p_sophie, NULL, 'Sophie DURAND',   'sophie.durand@credit-conseil.fr',     true, 'professional', 'DEMO-SD02', NOW() + INTERVAL '365 days', NULL, NOW() - INTERVAL '38 days'),
  (p_lucas,  NULL, 'Lucas MOREL',     'lucas.morel@investimmo.fr',           true, 'professional', 'DEMO-LM03', NOW() + INTERVAL '365 days', NULL, NOW() - INTERVAL '30 days'),
  (p_claire, NULL, 'Claire BERTRAND', 'claire.bertrand@cabinet-compta.fr',   true, 'professional', 'DEMO-CB04', NOW() + INTERVAL '365 days', NULL, NOW() - INTERVAL '25 days'),
  (p_marc,   NULL, 'Marc PETIT',      'marc.petit@gestion-patrimoine.fr',    true, 'professional', 'DEMO-MP05', NOW() + INTERVAL '365 days', NULL, NOW() - INTERVAL '20 days');


-- =================================================================
-- 2. LEADS — JULIEN MARTIN (10 × assurance emprunteur)
--    Mandataire immobilier — Réseau SAFTI
-- =================================================================

INSERT INTO public.leads
  (partner_id, first_name, last_name, phone, email,
   contract_type, status, montant, banque, type_projet,
   annual_premium_estimated, annual_premium_final,
   commission_estimated, commission_final,
   frais_courtage, frais_courtage_mode,
   consent_confirmed, consent_timestamp,
   paiement_compagnie_recu, is_paid,
   created_at, updated_at)
VALUES
  -- ── 3 NOUVEAUX ──
  (p_julien,'Thomas',  'LECLERC', '06 12 34 56 01','thomas.leclerc@gmail.com',
   'emprunteur','NOUVEAU',  280000,'Crédit Agricole','Résidence principale',
   980, NULL,147,NULL, 220,'fixe', true,NOW()-INTERVAL '3 days',  false,false, NOW()-INTERVAL '3 days', NOW()-INTERVAL '3 days'),

  (p_julien,'Marie',   'ROUSSEAU','06 12 34 56 02','marie.rousseau@gmail.com',
   'emprunteur','NOUVEAU',  195000,'BNP Paribas',    'Résidence principale',
   820, NULL,123,NULL, 190,'fixe', true,NOW()-INTERVAL '4 days',  false,false, NOW()-INTERVAL '4 days', NOW()-INTERVAL '4 days'),

  (p_julien,'Pierre',  'DUMONT',  '06 12 34 56 03','pierre.dumont@gmail.com',
   'emprunteur','NOUVEAU',  310000,'Société Générale','Investissement locatif',
   1050,NULL,158,NULL, 240,'fixe', true,NOW()-INTERVAL '2 days',  false,false, NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days'),

  -- ── 2 CONTACTÉS ──
  (p_julien,'Emma',    'GARNIER', '06 12 34 56 04','emma.garnier@gmail.com',
   'emprunteur','CONTACT',  400000,'Caisse d''Épargne','Résidence principale',
   1280,NULL,192,NULL, 280,'fixe', true,NOW()-INTERVAL '8 days',  false,false, NOW()-INTERVAL '8 days', NOW()-INTERVAL '5 days'),

  (p_julien,'Nicolas', 'BLANC',   '06 12 34 56 05','nicolas.blanc@gmail.com',
   'emprunteur','CONTACT',  220000,'LCL',            'Résidence principale',
   880, NULL,132,NULL, 200,'fixe', true,NOW()-INTERVAL '10 days', false,false, NOW()-INTERVAL '10 days',NOW()-INTERVAL '7 days'),

  -- ── 2 DEVIS ENVOYÉS ──
  (p_julien,'Laura',   'FAURE',   '06 12 34 56 06','laura.faure@gmail.com',
   'emprunteur','DEVIS_ENVOYE',260000,'Crédit Mutuel',  'Résidence principale',
   960, NULL,144,NULL, 220,'fixe', true,NOW()-INTERVAL '14 days', false,false, NOW()-INTERVAL '14 days',NOW()-INTERVAL '10 days'),

  (p_julien,'Maxime',  'HENRY',   '06 12 34 56 07','maxime.henry@gmail.com',
   'emprunteur','DEVIS_ENVOYE',400000,'BNP Paribas',    'Investissement locatif',
   1300,NULL,195,NULL, 280,'fixe', true,NOW()-INTERVAL '12 days', false,false, NOW()-INTERVAL '12 days',NOW()-INTERVAL '8 days'),

  -- ── 2 EN RÉFLEXION ──
  (p_julien,'Camille', 'PERROT',  '06 12 34 56 08','camille.perrot@gmail.com',
   'emprunteur','SIMULATION',120000,'La Banque Postale','Résidence principale',
   800, NULL,120,NULL, 170,'fixe', true,NOW()-INTERVAL '18 days', false,false, NOW()-INTERVAL '18 days',NOW()-INTERVAL '12 days'),

  (p_julien,'Antoine', 'SIMON',   '06 12 34 56 09','antoine.simon@gmail.com',
   'emprunteur','SIMULATION',185000,'Crédit Agricole', 'Résidence principale',
   850, NULL,128,NULL, 195,'fixe', true,NOW()-INTERVAL '20 days', false,false, NOW()-INTERVAL '20 days',NOW()-INTERVAL '14 days'),

  -- ── 1 SIGNÉ ──
  (p_julien,'Julie',   'MOREAU',  '06 12 34 56 10','julie.moreau@gmail.com',
   'emprunteur','SIGNE',    620000,'BPCE',            'Investissement locatif',
   1850,1850,278,278, 350,'fixe', true,NOW()-INTERVAL '30 days', true, false, NOW()-INTERVAL '30 days',NOW()-INTERVAL '15 days');


-- =================================================================
-- 3. LEADS — SOPHIE DURAND (6 leads : 2 emprunteur + 3 prévoyance + 1 RC Pro)
--    Courtière en crédit immobilier
-- =================================================================

INSERT INTO public.leads
  (partner_id, first_name, last_name, phone, email,
   contract_type, status, montant, banque, type_projet,
   annual_premium_estimated, annual_premium_final,
   commission_estimated, commission_final,
   frais_courtage, frais_courtage_mode,
   notes_partner, consent_confirmed, consent_timestamp,
   paiement_compagnie_recu, is_paid,
   created_at, updated_at)
VALUES
  -- Emprunteur 350k couple — DEVIS_ENVOYE
  (p_sophie,'François', 'LAMBERT',  '06 23 45 67 01','francois.lambert@gmail.com',
   'emprunteur','DEVIS_ENVOYE',350000,'Société Générale','Résidence principale',
   1150,NULL,173,NULL, 260,'fixe',
   'Couple — co-emprunteurs',true,NOW()-INTERVAL '9 days',
   false,false, NOW()-INTERVAL '9 days', NOW()-INTERVAL '5 days'),

  -- Emprunteur 210k investisseur — EN_COURS (découverte)
  (p_sophie,'Isabelle', 'VIDAL',    '06 23 45 67 02','isabelle.vidal@gmail.com',
   'emprunteur','EN_COURS',  210000,'Crédit Agricole', 'Investissement locatif',
   870, NULL,131,NULL, 200,'fixe',
   'Investissement locatif',true,NOW()-INTERVAL '11 days',
   false,false, NOW()-INTERVAL '11 days',NOW()-INTERVAL '8 days'),

  -- Prévoyance TNS kiné — EN_COURS (découverte)
  (p_sophie,'Éric',     'BONNET',   '06 23 45 67 03','eric.bonnet@gmail.com',
   'prevoyance','EN_COURS',  NULL,NULL,NULL,
   1200,NULL,480,NULL, 0,NULL,
   'Kinésithérapeute libéral',true,NOW()-INTERVAL '7 days',
   false,false, NOW()-INTERVAL '7 days', NOW()-INTERVAL '4 days'),

  -- Prévoyance TNS consultant IT — SIGNÉ
  (p_sophie,'Alexandre','LEVY',     '06 23 45 67 04','alexandre.levy@gmail.com',
   'prevoyance','SIGNE',     NULL,NULL,NULL,
   1450,1450,580,580, 0,NULL,
   'Consultant IT indépendant',true,NOW()-INTERVAL '35 days',
   true, false, NOW()-INTERVAL '35 days',NOW()-INTERVAL '20 days'),

  -- Prévoyance TNS gérante e-commerce — SIGNÉ
  (p_sophie,'Nathalie', 'COSTA',    '06 23 45 67 05','nathalie.costa@gmail.com',
   'prevoyance','SIGNE',     NULL,NULL,NULL,
   980, 980, 392,392, 0,NULL,
   'Gérante e-commerce',     true,NOW()-INTERVAL '28 days',
   false,false, NOW()-INTERVAL '28 days',NOW()-INTERVAL '18 days'),

  -- RC Pro artisan électricien — NOUVEAU
  (p_sophie,'Sébastien','THOMAS',   '06 23 45 67 06','sebastien.thomas@gmail.com',
   'rc_pro',   'NOUVEAU',   NULL,NULL,NULL,
   650, NULL,163,NULL, 0,NULL,
   'Artisan électricien — auto-entrepreneur',true,NOW()-INTERVAL '2 days',
   false,false, NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days');


-- =================================================================
-- 4. LEADS — LUCAS MOREL (13 × assurance emprunteur)
--    Créateur de contenu immobilier / finance — 75k abonnés
-- =================================================================

INSERT INTO public.leads
  (partner_id, first_name, last_name, phone, email,
   contract_type, status, montant, banque, type_projet,
   annual_premium_estimated, annual_premium_final,
   commission_estimated, commission_final,
   frais_courtage, frais_courtage_mode,
   notes_partner, consent_confirmed, consent_timestamp,
   paiement_compagnie_recu, is_paid,
   created_at, updated_at)
VALUES
  -- ── 5 NOUVEAUX ──
  (p_lucas,'Romain',    'PETIT',   '06 34 56 78 01','romain.petit@gmail.com',
   'emprunteur','NOUVEAU',   175000,'LCL',              'Résidence principale',
   900, NULL,135,NULL, 195,'fixe',
   'Primo-accédant',true,NOW()-INTERVAL '1 day',
   false,false, NOW()-INTERVAL '1 day',  NOW()-INTERVAL '1 day'),

  (p_lucas,'Aurélie',   'MARTIN',  '06 34 56 78 02','aurelie.martin@gmail.com',
   'emprunteur','NOUVEAU',   220000,'BNP Paribas',      'Investissement locatif',
   960, NULL,144,NULL, 210,'fixe',
   'Investisseur immobilier',true,NOW()-INTERVAL '2 days',
   false,false, NOW()-INTERVAL '2 days', NOW()-INTERVAL '2 days'),

  (p_lucas,'Kevin',     'GIRARD',  '06 34 56 78 03','kevin.girard@gmail.com',
   'emprunteur','NOUVEAU',   195000,'Crédit Agricole',  'Résidence principale',
   920, NULL,138,NULL, 200,'fixe',
   'Primo-accédant',true,NOW()-INTERVAL '3 days',
   false,false, NOW()-INTERVAL '3 days', NOW()-INTERVAL '3 days'),

  (p_lucas,'Stéphanie', 'RICHARD', '06 34 56 78 04','stephanie.richard@gmail.com',
   'emprunteur','NOUVEAU',   240000,'Caisse d''Épargne','Investissement locatif',
   990, NULL,149,NULL, 220,'fixe',
   'Investissement locatif',true,NOW()-INTERVAL '4 days',
   false,false, NOW()-INTERVAL '4 days', NOW()-INTERVAL '4 days'),

  (p_lucas,'Yann',      'DUBOIS',  '06 34 56 78 05','yann.dubois@gmail.com',
   'emprunteur','NOUVEAU',   165000,'La Banque Postale','Résidence principale',
   870, NULL,131,NULL, 185,'fixe',
   'Primo-accédant',true,NOW()-INTERVAL '5 days',
   false,false, NOW()-INTERVAL '5 days', NOW()-INTERVAL '5 days'),

  -- ── 3 CONTACTÉS ──
  (p_lucas,'Céline',    'MORIN',   '06 34 56 78 06','celine.morin@gmail.com',
   'emprunteur','CONTACT',   320000,'Crédit Mutuel',    'Investissement locatif',
   1080,NULL,162,NULL, 245,'fixe',
   'Investisseur expérimenté',true,NOW()-INTERVAL '10 days',
   false,false, NOW()-INTERVAL '10 days',NOW()-INTERVAL '7 days'),

  (p_lucas,'David',     'LEGRAND', '06 34 56 78 07','david.legrand@gmail.com',
   'emprunteur','CONTACT',   380000,'Société Générale', 'Résidence principale',
   1180,NULL,177,NULL, 265,'fixe',
   'Résidence principale',true,NOW()-INTERVAL '12 days',
   false,false, NOW()-INTERVAL '12 days',NOW()-INTERVAL '9 days'),

  (p_lucas,'Marion',    'ROUX',    '06 34 56 78 08','marion.roux@gmail.com',
   'emprunteur','CONTACT',   290000,'BNP Paribas',      'Investissement locatif',
   1020,NULL,153,NULL, 235,'fixe',
   'Investissement locatif',true,NOW()-INTERVAL '9 days',
   false,false, NOW()-INTERVAL '9 days', NOW()-INTERVAL '6 days'),

  -- ── 2 DEVIS ENVOYÉS ──
  (p_lucas,'Paul',      'VINCENT', '06 34 56 78 09','paul.vincent@gmail.com',
   'emprunteur','DEVIS_ENVOYE',420000,'Crédit Agricole','Investissement SCI',
   1320,NULL,198,NULL, 290,'fixe',
   'Investisseur SCI',true,NOW()-INTERVAL '16 days',
   false,false, NOW()-INTERVAL '16 days',NOW()-INTERVAL '11 days'),

  (p_lucas,'Sandra',    'MERCIER', '06 34 56 78 10','sandra.mercier@gmail.com',
   'emprunteur','DEVIS_ENVOYE',340000,'LCL',            'Résidence principale',
   1100,NULL,165,NULL, 250,'fixe',
   'Résidence principale',true,NOW()-INTERVAL '14 days',
   false,false, NOW()-INTERVAL '14 days',NOW()-INTERVAL '10 days'),

  -- ── 2 EN RÉFLEXION ──
  (p_lucas,'Bruno',     'FONTAINE','06 34 56 78 11','bruno.fontaine@gmail.com',
   'emprunteur','SIMULATION',510000,'BPCE',             'Investissement locatif',
   1520,NULL,228,NULL, 320,'fixe',
   'Portefeuille locatif',true,NOW()-INTERVAL '20 days',
   false,false, NOW()-INTERVAL '20 days',NOW()-INTERVAL '14 days'),

  (p_lucas,'Virginie',  'PERRIN',  '06 34 56 78 12','virginie.perrin@gmail.com',
   'emprunteur','SIMULATION',650000,'Crédit Mutuel',    'Investissement locatif',
   1780,NULL,267,NULL, 360,'fixe',
   'Gros portefeuille locatif',true,NOW()-INTERVAL '22 days',
   false,false, NOW()-INTERVAL '22 days',NOW()-INTERVAL '15 days'),

  -- ── 1 SIGNÉ ──
  (p_lucas,'Christophe','ADAM',    '06 34 56 78 13','christophe.adam@gmail.com',
   'emprunteur','SIGNE',     200000,'Caisse d''Épargne','Résidence principale',
   940, 940, 141,141, 210,'fixe',
   'Primo-accédant',true,NOW()-INTERVAL '32 days',
   false,false, NOW()-INTERVAL '32 days',NOW()-INTERVAL '18 days');


-- =================================================================
-- 5. LEADS — CLAIRE BERTRAND (6 leads : 4 prévoyance + 2 santé)
--    Expert-comptable
-- =================================================================

INSERT INTO public.leads
  (partner_id, first_name, last_name, phone, email,
   contract_type, status,
   annual_premium_estimated, annual_premium_final,
   commission_estimated, commission_final,
   frais_courtage,
   notes_partner, consent_confirmed, consent_timestamp,
   paiement_compagnie_recu, is_paid,
   created_at, updated_at)
VALUES
  -- Prévoyance chirurgien dentiste — EN_COURS (découverte)
  (p_claire,'Michel',       'RENARD',  '06 45 67 89 01','michel.renard@gmail.com',
   'prevoyance','EN_COURS',
   1700,NULL,680,NULL, 0,
   'Chirurgien dentiste — secteur 2',true,NOW()-INTERVAL '6 days',
   false,false, NOW()-INTERVAL '6 days', NOW()-INTERVAL '4 days'),

  -- Prévoyance kiné — EN_COURS (découverte)
  (p_claire,'Sandrine',     'GIRAUD',  '06 45 67 89 02','sandrine.giraud@gmail.com',
   'prevoyance','EN_COURS',
   1100,NULL,440,NULL, 0,
   'Kinésithérapeute libérale',true,NOW()-INTERVAL '8 days',
   false,false, NOW()-INTERVAL '8 days', NOW()-INTERVAL '5 days'),

  -- Prévoyance avocat — DEVIS_ENVOYE
  (p_claire,'Paul',         'FERRARI', '06 45 67 89 03','paul.ferrari@gmail.com',
   'prevoyance','DEVIS_ENVOYE',
   1450,NULL,580,NULL, 0,
   'Avocat associé — cabinet libéral',true,NOW()-INTERVAL '13 days',
   false,false, NOW()-INTERVAL '13 days',NOW()-INTERVAL '9 days'),

  -- Prévoyance consultant indépendant — SIMULATION (en réflexion)
  (p_claire,'Jean-Baptiste', 'CLEMENT','06 45 67 89 04','jb.clement@gmail.com',
   'prevoyance','SIMULATION',
   950, NULL,380,NULL, 0,
   'Consultant indépendant',true,NOW()-INTERVAL '18 days',
   false,false, NOW()-INTERVAL '18 days',NOW()-INTERVAL '12 days'),

  -- Santé TNS restaurateur — DEVIS_ENVOYE
  (p_claire,'Patrick',      'GAUTHIER','06 45 67 89 05','patrick.gauthier@gmail.com',
   'sante',    'DEVIS_ENVOYE',
   1560,NULL,390,NULL, 0,
   'Restaurateur — gérant SARL',true,NOW()-INTERVAL '11 days',
   false,false, NOW()-INTERVAL '11 days',NOW()-INTERVAL '7 days'),

  -- Santé TNS architecte — SIGNÉ
  (p_claire,'Hélène',       'AUBRY',   '06 45 67 89 06','helene.aubry@gmail.com',
   'sante',    'SIGNE',
   1440,1440,360,360, 0,
   'Architecte libérale',    true,NOW()-INTERVAL '25 days',
   true, false, NOW()-INTERVAL '25 days',NOW()-INTERVAL '16 days');


-- =================================================================
-- 6. LEADS — MARC PETIT (6 leads : 3 emprunteur + 2 prévoyance + 1 RC Pro)
--    Gestionnaire de patrimoine
-- =================================================================

INSERT INTO public.leads
  (partner_id, first_name, last_name, phone, email,
   contract_type, status, montant, banque, type_projet,
   annual_premium_estimated, annual_premium_final,
   commission_estimated, commission_final,
   frais_courtage, frais_courtage_mode,
   notes_partner, consent_confirmed, consent_timestamp,
   paiement_compagnie_recu, is_paid,
   created_at, updated_at)
VALUES
  -- Emprunteur 420k — CONTACT
  (p_marc,'Bernard',  'LAROCHE','06 56 78 90 01','bernard.laroche@gmail.com',
   'emprunteur','CONTACT',    420000,'Société Générale','Résidence principale',
   1320,NULL,198,NULL, 290,'fixe',
   'Résidence principale + investissement',true,NOW()-INTERVAL '7 days',
   false,false, NOW()-INTERVAL '7 days', NOW()-INTERVAL '5 days'),

  -- Emprunteur 510k — DEVIS_ENVOYE
  (p_marc,'Christine','LEROY',  '06 56 78 90 02','christine.leroy@gmail.com',
   'emprunteur','DEVIS_ENVOYE',510000,'BNP Paribas',     'Résidence principale',
   1550,NULL,233,NULL, 330,'fixe',
   'Cadre dirigeant',             true,NOW()-INTERVAL '12 days',
   false,false, NOW()-INTERVAL '12 days',NOW()-INTERVAL '8 days'),

  -- Emprunteur 290k — CONTACT
  (p_marc,'Thierry',  'NGUYEN', '06 56 78 90 03','thierry.nguyen@gmail.com',
   'emprunteur','CONTACT',    290000,'Crédit Agricole', 'Investissement locatif',
   1020,NULL,153,NULL, 235,'fixe',
   'Investissement locatif — Pinel',true,NOW()-INTERVAL '9 days',
   false,false, NOW()-INTERVAL '9 days', NOW()-INTERVAL '6 days'),

  -- Prévoyance dirigeant SASU — DEVIS_ENVOYE
  (p_marc,'Frédéric', 'DUPONT', '06 56 78 90 04','frederic.dupont@gmail.com',
   'prevoyance','DEVIS_ENVOYE',NULL,NULL,NULL,
   2100,NULL,840,NULL, 0,NULL,
   'Dirigeant SASU — secteur digital',true,NOW()-INTERVAL '15 days',
   false,false, NOW()-INTERVAL '15 days',NOW()-INTERVAL '10 days'),

  -- Prévoyance dirigeante SASU — SIMULATION (en réflexion)
  (p_marc,'Valérie',  'MASSON', '06 56 78 90 05','valerie.masson@gmail.com',
   'prevoyance','SIMULATION', NULL,NULL,NULL,
   1800,NULL,720,NULL, 0,NULL,
   'Dirigeante SASU — conseil RH',true,NOW()-INTERVAL '17 days',
   false,false, NOW()-INTERVAL '17 days',NOW()-INTERVAL '11 days'),

  -- RC Pro consultant stratégie — SIGNÉ
  (p_marc,'Xavier',   'COLIN',  '06 56 78 90 06','xavier.colin@gmail.com',
   'rc_pro',   'SIGNE',      NULL,NULL,NULL,
   850, 850, 213,213, 0,NULL,
   'Consultant en stratégie — SASU',true,NOW()-INTERVAL '28 days',
   true, false, NOW()-INTERVAL '28 days',NOW()-INTERVAL '19 days');


RAISE NOTICE '✅ Seed terminé — 5 partenaires et 41 leads créés avec succès.';

END $$;
