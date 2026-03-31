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
- 2 tiers uniquement : **Conseillère** (base) et **Manager** (4+ partenaires actifs)
- Commission recrue directe : 100€/vente (conseillère), 120€/vente (manager)
- Commission réseau : 0€ (conseillère), 30€/vente (manager)
- Challenge Countdown : 2 mois, 5 ventes, bonus 800€
- Challenge Rookie : 6 mois, 15 ventes, bonus 1000€

## Fonctionnalités clés
- Impersonation admin : `useEffectiveUserId()` + `useEffectiveProfile()` dans `src/hooks/useEffectiveUser.ts`
- Import Finance : input natif caché pour contourner le focus trap Radix UI Dialog
- Données graphique Dashboard : vraies ventes filtrées par mois

## Projets connexes (ne pas confondre)
- `portfolio-navigator-6180a241-main` → CRM Courtage Thomas Jean (assurance) — projet SÉPARÉ
- `thomas-jean-courtage-main` → Lead Connector (autre projet SÉPARÉ)
