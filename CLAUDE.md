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

### Campagnes événementielles (liens trackés + stats)
- Mig. `20260508_campaigns.sql` : table `campaigns(id, owner_id, name, slug, tag, color, start_date, end_date, status)` + ajout `campaign_id` FK nullable sur `public_leads`, `contact_link_clicks`, `contacts`. Suppression des CHECK constraints rigides sur les colonnes `source` (acceptent désormais n'importe quel slug). RPC `campaign_stats(p_campaign_id)` SECURITY DEFINER qui retourne clics/leads/conversions + graphique clics par jour.
- `SocialPage` → onglet **Campagnes** (route `/social` restaurée — était redirigée vers /settings) : CRUD complet (modale `CampaignEditor` avec slug auto-dérivé du nom, choix de couleur, période). Pour chaque campagne : lien tracké à copier (`?src=<slug>`), KPIs résumés (clics / leads / conversions / taux), section dépliable `CampaignStatsDetail` avec entonnoir de conversion + bar chart clics/jour.
- `PublicProfilePage` : accepte `?src=<slug>` libre, résout la campagne par `owner_id + slug + status='active'`, lie le clic + le lead à `campaign_id`.
- Conversion lead → contact dans SocialPage : si `lead.campaign_id` présent, récupère le tag de la campagne et l'applique automatiquement à `contacts.tags[]` + remplit `contacts.campaign_id` pour le filtrage pipeline. Le composant utilise `getSourceLabel()` avec fallback violet pour les slugs custom (évite le crash "Cannot read properties of undefined" quand la source n'est pas bio/story/direct).
- Lien d'accès depuis `SettingsPage` > ContactLinksSection (bouton "🎉 Campagnes événementielles → Gérer").

### Chargement du profile (`useAuth.fetchProfile`)
Récupère tous les champs nécessaires au fonctionnement de l'app en une seule query : `full_name, avatar_url, invite_code, sponsor_user_id, role, email, plan, plan_status, trial_ends_at, challenge_start_date, onboarding_completed_at`. Sans `plan/plan_status/trial_ends_at`, `usePlan()` considère l'user comme trial invalide → paywall permanent sur /network /finance /stats pour tout non super-admin. À ne surtout pas amputer.

### Tier 2 — features MLM (juillet 2026)
- **Tunnel de vente** (`pages/Deals.tsx > FunnelView`) : 3e vue à côté de Liste/Kanban. Cascade 5 étapes (En cours → En attente → Signée → En financement → Livrée) avec largeur proportionnelle + taux de conversion vs étape précédente coloré rouge/amber/vert. Header 3 cards (total pipeline, taux conversion global, perdus). Insight auto "Point de vigilance" pointe l'étape avec le plus gros drop.
- **Comparateur d'équipe** (`pages/NetworkPage.tsx > TeamComparatorWidget`) : 2 cards côte à côte dans NetworkPage — "Podium du mois" 🥇🥈🥉 (Top 3 basé sur deals via linked_user_id OU sold_by) + "Membres à booster" (jusqu'à 5 actifs sans vente ce mois). Ne s'affiche que si l'équipe ≥ 2 membres.
- **Badges gamification** (`pages/Dashboard.tsx > BadgesWidget`) : 10 trophées purement client-side (calculés depuis les KPIs) — 1ère vente, 5 ventes/mois, top mois (8+), 1ère recrue, 3 recrues, équipe active 5, manager 10, 20 contacts, 100 contacts, CA 10k€/mois. Grid débloqués + prochains grisés + hint "Prochain à débloquer".
- **Simulateur "Utiliser mes vraies stats"** (`pages/SimulateurPage.tsx`) : bouton en header qui fetch les KPIs réels (ventes signées, équipe active, hyla_level) et pré-remplit les sliders. Une fois activé, si l'user modifie nbVentes, bandeau "Et si tu fais +X ventes" affiche le delta de commission perso en €.
- **Distribution de leads** (`pages/SocialPage.tsx`) : Mig. `20260726_lead_assignment.sql` ajoute `public_leads.assigned_to_member_id` FK team_members + `assigned_at`. Dropdown "Affecter à…" à côté du bouton "Créer contact" sur chaque lead nouveau. Badge violet "→ Prénom" affiche l'assignation courante.

### Quick wins récents (juillet 2026)
- **Recherche globale ⌘K** (`components/AppLayout.tsx > GlobalSearch`) : commande palette avec fuzzy search sur contacts + deals + tâches + team_members. Cmd+K binding global. Deep-link vers `/tasks?taskId=xxx` pour ouvrir directement l'édition d'une tâche.
- **Templates WhatsApp/SMS** (`components/ContactDrawer.tsx`) : 5 templates par défaut + custom en localStorage. Sur chaque template, 3 boutons : **WhatsApp** (ouvre `wa.me/33...?text=` en normalisant les 06XX → 336XX), **SMS** (ouvre `sms:...?body=`), **Copier**. Variables `{{prénom}}`, `{{nom}}`, `{{date}}` substituées. Mig. `20260726_message_templates.sql` ajoute `user_settings.message_templates JSONB` pour sync cross-device future (pas encore utilisée par le code).
- **Widget "Contacts à réchauffer"** (`pages/Dashboard.tsx > ColdContactsWidget`) : liste les 5 prospects/clientes non contactés depuis 21j+ (null ou < now-21j sur `last_contacted_at`), triés par plus ancien.
- **Deltas mois vs mois précédent** sur Dashboard : nouvelle query `dashboard-kpis-prev` qui rappelle le RPC `get_dashboard_kpis` avec dates du mois précédent. Helper `deltaLabel(current, previous, isAmount)` qui formate ↗/↘/= avec couleur. Deltas sur CA (€), Ventes (unités), Équipe (nouvelles recrues).
- **Onboarding rouvrable à la demande** : icône `HelpCircle` dans le header (desktop + mobile) qui dispatch `window` event `triibu:open-onboarding`. `OnboardingGuide` écoute l'event → purge storage + reset state + réouvre.

## Projets connexes (ne pas confondre)
- `portfolio-navigator-6180a241-main` → CRM Courtage Thomas Jean (assurance) — projet SÉPARÉ
- `thomas-jean-courtage-main` → Lead Connector (autre projet SÉPARÉ)
