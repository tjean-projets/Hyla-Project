# Hyla Assistant — CRM

Projet CRM pour conseillers Hyla (MLM purificateurs d'eau).
Propriétaire : Thomas Jean
GitHub : `tjean-projets/Hyla-Project`
Déployé sur Vercel (auto-deploy depuis main)

## Stack
React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui + Supabase + React Query

## Lancer le projet
```bash
npm run dev
```
Port par défaut : 5174

## Règles métier Hyla

### 6 niveaux (hyla_level dans user_settings + team_members)
| Niveau | Valeur DB | Com recrue directe | Conditions |
|---|---|---|---|
| Vendeur commerçant | `vendeur` | 100€ | Niveau de départ |
| Manager | `manager` | 120€ | 3 vendeurs directs actifs + >15 ventes équipe/mois × 3 mois |
| Chef de groupe | `chef_groupe` | 140€ | 4 directs + 1 indirect + >30 ventes/mois × 3 mois |
| Chef d'agence | `chef_agence` | 160€ | 4 directs + 1 lignée manager + >60 ventes/mois × 3 mois |
| Distributeur | `distributeur` | 180€ | 2 lignées managers + >90 ventes/mois × 3 mois |
| Elite Manager Bronze | `elite_bronze` | 200€ | 3 lignées managers + >120 ventes/mois × 3 mois |
| Elite Manager Argent | `elite_argent` | 225€ | idem + qualification Argent |
| Elite Manager Or | `elite_or` | 250€ | idem + qualification Or |

⚠ Le niveau est attribué par Hyla — pas modifiable librement. Override admin via `<details>` dans Paramètres.

### Ventes personnelles — échelle glissante mensuelle
- 1ère vente : 300€ — 2ème : 350€ — 3ème : 400€ — 4→7 : 450€ — 8+ : 500€

### Prime de gestion de groupe (€/machine/mois selon volume équipe)
- Manager : 15-29 → 30€, 30+ → 50€
- Chef groupe : 15-29 → 30€, 30+ → 50€
- Chef agence : 15-29 → 30€, 30-59 → 50€, 60+ → 70€
- Distributeur : 15-29 → 30€, 30-59 → 50€, 60-89 → 70€, 90+ → 85€
- Elite Manager : 15-29 → 30€, 30-59 → 50€, 60-89 → 70€, 90-119 → 85€, 120+ → 100€

### Commissions : Attendue vs Confirmée
- **Com attendue** : calculée depuis les deals saisis manuellement (barème glissant). Affichée en ambre.
- **Com confirmée** : issue de l'import TRV Hyla officiel. Affichée en vert.
- L'import TRV crée les `commission_imports` et consolide via `consolidate_import_commissions` RPC.

### Statuts deal (`deal_status` enum)
`en_cours`, `en_attente`, `signee`, `en_financement`, `livree`, `annulee`.
- `en_financement` (mig. `20260506_deal_status_financement.sql`) : deal signé bloqué en attente de validation bancaire. Compte dans le CA / barème comme `signee`. Le bouton **Reporter au mois prochain** (visible sur cette colonne du Kanban) décale `signed_at` + le `period` de la commission au mois suivant — utile quand le financement est validé un mois plus tard.

### Challenges
- Countdown : 2 mois, 5 ventes, bonus 800€
- Rookie : 6 mois, 15 ventes, bonus 1000€

## Fonctionnalités clés

### Import TRV Hyla
- Fichier CSV national → parse `parseTRVCsv()` → matching vendeurs vs équipe
- `computeTRVMatching()` : taux recrue = `getRecrueCommission(settings.hyla_level)`, taux perso = `getPersonalSaleCommission(rank)`
- Crée automatiquement contacts (CLIENT), deals (avec financement), détecte transitions cliente→vendeuse
- Filtrage : lignes non reconnues (autres managers) ignorées

### Widget "Prochain niveau" (Dashboard)
- Calcule vendeurs directs actifs, lignées managers, volume équipe
- Vérifie 3 mois consécutifs via `commission_imports` des 3 derniers mois
- Affiche conditions ✓/· et barre de progression

### Helpers commissions (src/lib/supabase.ts)
- `getRecrueCommission(level)` → commission recrue par niveau
- `getPersonalSaleCommission(rank)` → barème glissant ventes perso
- `getGroupPrime(level, teamSales)` → prime groupe €/machine
- `getHylaCommission(n)` → cumul estimé pour n ventes perso

### Impersonation admin
- `useEffectiveUserId()` + `useEffectiveProfile()` dans `src/hooks/useEffectiveUser.ts`
- `isSuperAdmin` depuis `src/lib/supabase.ts`

### Import Finance
- Input natif caché pour contourner le focus trap Radix UI Dialog

### Académies privées
- Tables : `academies`, `academy_sections`, `academy_files`, `academy_access`, `academy_file_progress`, `academy_lesson_comments` (RLS owner-all + invitees-read).
- **RLS recursion fix** (mig. `20260507_fix_academies_rls_recursion.sql`) : helpers `is_academy_owner()` / `has_academy_access()` SECURITY DEFINER pour briser le cycle academies ↔ academy_access.
- `MonAcademiePage` (créateur) : édition complète, **renommer dans Paramètres → l'onglet sidebar reflète le nouveau nom**, Accès, **Carte** (mini-map pigeon-maps des `team_members` géolocalisés), Stats. Bouton vert prominent "Ajouter un membre" dans le header (modal rapide qui réutilise `grantAccess`).
- Upload : accept `video/*,image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt` — vidéos et PDFs supportés directement.
- `AcademieViewPage` (`/academie/:slug`) : vue lecture seule pour les invités (suivi progression + commentaires).
- Sidebar : section "Mes académies" (AppLayout) — liste les académies possédées + celles partagées via `academy_access`. Query `accessible-academies-nav` invalidée à chaque mutation (création / accès accordé / révoqué) pour refresh immédiat.

### Objectifs membres — dates de suivi & dashboard
- Mig. `20260507_member_objectives_followups.sql` : ajoute `start_date`, `follow_up_1mo_at`, `follow_up_3mo_at`, `follow_up_1mo_done_at`, `follow_up_3mo_done_at`. Trigger `member_objectives_compute_followups` calcule auto `+1mo` et `+3mo` à partir de `start_date`.
- NetworkPage `ObjectifsView` : input date de départ + cartes "Point à 1 mois" / "Point à 3 mois" avec bouton "Marquer comme fait" quand la date est échue.
- Dashboard côté **recrue** (`myRecruitObjective`) : affiche les rappels à 1 mois / 3 mois (couleurs : à venir / dû / fait).
- Dashboard côté **manager** : nouveau widget `FollowUpsManagerWidget` qui liste les membres dont un point 1mo/3mo est dû (lien direct vers `/network`).

### Tâches — colonnes Kanban personnalisables
- Mig. `20260507_task_columns.sql` : table `task_columns(id, user_id, name, position, color, base_status, is_default)` mirror de `pipeline_stages`. Ajout `tasks.column_id` FK nullable. Seed automatique des 3 colonnes par défaut (À faire / En cours / Terminée) à la création du user (trigger `seed_task_columns_on_user_create`). Backfill des tâches existantes.
- Tasks.tsx : Kanban dynamique qui rend les colonnes depuis `task_columns`. Bouton "+ Ajouter une colonne" en bout de Kanban. Modale `ColumnEditor` pour créer/renommer/supprimer + choisir une couleur et un `base_status` (le statut "officiel" assigné aux tâches déposées dans la colonne — garde la cohérence avec les filtres et les rappels).
- Suppression d'une colonne custom : les tâches qu'elle contient sont réassignées à la colonne par défaut correspondant à `base_status`. Les colonnes par défaut (`is_default = true`) ne peuvent pas être supprimées (renommables uniquement).

### Dashboard — widgets cliquables
Toutes les KPI cards sont des `<a href>` :
- CA du mois / Ventes → `/deals`
- Équipe → `/network`
- Commissions du mois → `/commissions`
- Mon rang (anciennement "Progression niveau") → `/settings#mon-rang` (ancre vers la section rang Hyla détaillée)
- Prochaines tâches → `/tasks?taskId=<id>` ouvre directement le modal d'édition dans Tasks.tsx (lecture du query param via `useSearchParams`).

### Tâches — vues
Ordre du toggle : **Kanban (défaut) → Liste → Terminées**.
- Kanban : drag-and-drop HTML5, surlignage par classes Tailwind theme-safe (`ring-2 ring-blue-500/40 bg-blue-500/5`).
- Click sur la pastille d'une tâche terminée → re-passe en `a_faire` (mutation `uncompleteTask`) — effet inverse de `completeTask`.

### Ventes — Kanban + Financement
Vue Kanban par défaut. Drop sur une colonne appelle `applyStatusUpdate()` qui :
- Met à jour `status` + `signed_at` (si passage à `signee` ou `en_financement` et pas encore signé).
- Crée la commission via `ensureCommission()` si elle n'existe pas.
- Invalide `deals`, `commissions`, `dashboard-kpis` → barème commissions, CA, etc. se rafraîchissent.

### Support / SAV
Section "Support & suggestions" en bas de `SettingsPage` — formulaire simple (type + message) qui ouvre un `mailto:contact@triibu.fr` pré-rempli avec contexte technique (URL, user-agent, profil). Pas de table dédiée, géré côté mail.

## Projets connexes (ne pas confondre)
- `portfolio-navigator-6180a241-main` → CRM Courtage Thomas Jean (assurance) — projet SÉPARÉ
- `thomas-jean-courtage-main` → Lead Connector (autre projet SÉPARÉ)
