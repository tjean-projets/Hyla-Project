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

## Projets connexes (ne pas confondre)
- `portfolio-navigator-6180a241-main` → CRM Courtage Thomas Jean (assurance) — projet SÉPARÉ
- `thomas-jean-courtage-main` → Lead Connector (autre projet SÉPARÉ)
