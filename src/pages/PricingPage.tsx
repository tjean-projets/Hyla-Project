import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Zap, ArrowRight, ArrowLeft,
  Users, BarChart3, TrendingUp, Network, FileText,
  Star, Shield, RefreshCw,
} from 'lucide-react';

const conseillerFeatures = [
  { included: true,  text: 'Dashboard & KPIs personnels' },
  { included: true,  text: 'Contacts illimités (clients, prospects, recrues)' },
  { included: true,  text: 'Pipeline de ventes (Kanban + liste)' },
  { included: true,  text: 'Tâches & agenda' },
  { included: true,  text: 'Suivi des commissions personnelles' },
  { included: true,  text: 'Challenges & objectifs' },
  { included: true,  text: 'Simulateur de commissions' },
  { included: true,  text: 'Profil public partageable' },
  { included: true,  text: 'Carte & géolocalisation prospects' },
  { included: true,  text: 'Académie & formation' },
  { included: true,  text: 'Application mobile (PWA)' },
  { included: false, text: 'Gestion réseau & équipe' },
  { included: false, text: 'Import données de vente officiel' },
  { included: false, text: 'Statistiques avancées' },
  { included: false, text: 'Dashboard commissions réseau' },
  { included: false, text: 'Prime de groupe automatique' },
];

const managerFeatures = [
  { included: true, text: 'Tout ce qui est inclus dans Conseiller' },
  { included: true, text: 'Gestion réseau & visualisation équipe' },
  { included: true, text: 'Import données de vente officiel' },
  { included: true, text: 'Statistiques avancées & rapports' },
  { included: true, text: 'Dashboard commissions réseau' },
  { included: true, text: 'Prime de groupe calculée automatiquement' },
  { included: true, text: 'Suivi progression niveau' },
  { included: true, text: 'Widget "Prochain niveau" avec conditions' },
  { included: true, text: 'Facturation & rapports PDF mensuels' },
  { included: true, text: 'Import multi-périodes avec matching auto' },
];

const faqs = [
  {
    q: "Y a-t-il un engagement ?",
    a: "Non, aucun. Vous pouvez résilier à tout moment en un clic, sans frais ni préavis.",
  },
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "Vous bénéficiez de 7 jours d'accès complet à la formule Manager, sans carte bancaire requise.",
  },
  {
    q: "Puis-je changer de formule ?",
    a: "Oui, à tout moment. La mise à niveau est immédiate, le downgrade prend effet à la prochaine période.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Vos données sont hébergées en Europe sur une infrastructure sécurisée (Supabase). Elles vous appartiennent entièrement.",
  },
  {
    q: "La formule Conseiller convient-elle aux débutants ?",
    a: "Absolument. Elle couvre tous les outils essentiels pour gérer vos ventes et vos contacts dès le premier jour.",
  },
  {
    q: "Quand passer à la formule Manager ?",
    a: "Dès que vous avez des recrues et que vous souhaitez suivre les performances de votre réseau et gérer vos commissions groupe.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#08090f] text-white overflow-x-hidden">

      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-violet-600/[0.04] rounded-full blur-[120px]" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Triibu</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.07] border border-white/[0.10] text-sm font-medium hover:bg-white/[0.12] transition-all"
          >
            Se connecter <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center px-6 pt-12 pb-16 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
          <Shield className="h-3.5 w-3.5" />
          7 jours d'essai gratuit · Sans engagement
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
          Des tarifs simples,{' '}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            adaptés à votre niveau
          </span>
        </h1>
        <p className="text-white/45 text-base max-w-xl mx-auto">
          Commencez en tant que Conseiller et passez Manager quand votre réseau grandit. Changez à tout moment.
        </p>
      </section>

      {/* ── Pricing cards ── */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* ─ Conseiller ─ */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.10] p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 rounded-xl bg-white/[0.08] border border-white/[0.10] flex items-center justify-center">
                  <TrendingUp className="h-4.5 w-4.5 text-white/70" />
                </div>
                <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Conseiller</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-white">9.99€</span>
                <span className="text-white/40 text-sm mb-2">/mois</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                Tous les outils essentiels pour gérer vos ventes, vos contacts et vos commissions personnelles.
              </p>
            </div>

            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white font-semibold text-sm hover:bg-white/[0.13] transition-all mb-8"
            >
              Commencer l'essai gratuit
            </Link>

            <div className="space-y-3 flex-1">
              {conseillerFeatures.map((f) => (
                <div key={f.text} className="flex items-start gap-3">
                  {f.included
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    : <XCircle className="h-4 w-4 text-white/15 shrink-0 mt-0.5" />
                  }
                  <span className={`text-sm ${f.included ? 'text-white/65' : 'text-white/20'}`}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─ Manager ─ */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/15 border border-blue-500/30 p-8 flex flex-col relative overflow-hidden">
            {/* Popular badge */}
            <div className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-bold">
              <Star className="h-3 w-3" />
              Recommandé
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <Network className="h-4.5 w-4.5 text-blue-400" />
                </div>
                <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Manager</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-white">29.99€</span>
                <span className="text-white/40 text-sm mb-2">/mois</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                La suite complète pour piloter votre réseau, gérer vos recrues et maximiser vos revenus groupe.
              </p>
            </div>

            <a
              href="mailto:contact@triibu.fr?subject=Abonnement Triibu Manager"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/25 mb-8"
            >
              <Zap className="h-4 w-4" />
              Démarrer avec Manager
              <ArrowRight className="h-4 w-4" />
            </a>

            <div className="space-y-3 flex-1">
              {managerFeatures.map((f) => (
                <div key={f.text} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Reassurance strip ── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Shield,     text: '7 jours d\'essai gratuit', sub: 'Aucune carte bancaire requise' },
            { icon: RefreshCw,  text: 'Sans engagement', sub: 'Résiliation en 1 clic, sans frais' },
            { icon: Users,      text: 'Support inclus', sub: 'Réponse par email sous 24h' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.text} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3">
                <Icon className="h-4 w-4 text-white/30 shrink-0" />
                <div>
                  <p className="text-white/70 text-sm font-medium">{item.text}</p>
                  <p className="text-white/30 text-xs">{item.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Comparison table (desktop) ── */}
      <section className="relative z-10 px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="text-2xl font-black tracking-tight text-center mb-8">
          Comparaison détaillée
        </h2>
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
          <div className="grid grid-cols-3 bg-white/[0.04] border-b border-white/[0.07] px-6 py-4">
            <span className="text-white/40 text-sm font-medium">Fonctionnalité</span>
            <span className="text-white/70 text-sm font-semibold text-center">Conseiller</span>
            <span className="text-blue-400 text-sm font-semibold text-center">Manager</span>
          </div>
          {[
            ['Dashboard & KPIs', true, true],
            ['Contacts illimités', true, true],
            ['Pipeline de ventes', true, true],
            ['Tâches & calendrier', true, true],
            ['Challenges & objectifs', true, true],
            ['Simulateur de commissions', true, true],
            ['Profil public partageable', true, true],
            ['App mobile (PWA)', true, true],
            ['Formation & académie', true, true],
            ['Gestion réseau équipe', false, true],
            ['Import données officiel', false, true],
            ['Statistiques avancées', false, true],
            ['Commissions réseau & groupe', false, true],
            ['Suivi progression niveau', false, true],
            ['Facturation & rapports PDF', false, true],
          ].map(([label, conseiller, manager], i) => (
            <div
              key={String(label)}
              className={`grid grid-cols-3 px-6 py-3.5 items-center ${i % 2 === 0 ? '' : 'bg-white/[0.02]'} border-b border-white/[0.05] last:border-0`}
            >
              <span className="text-white/55 text-sm">{String(label)}</span>
              <div className="flex justify-center">
                {conseiller
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : <XCircle className="h-4 w-4 text-white/15" />
                }
              </div>
              <div className="flex justify-center">
                {manager
                  ? <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  : <XCircle className="h-4 w-4 text-white/15" />
                }
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative z-10 px-6 pb-20 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black tracking-tight text-center mb-8">Questions fréquentes</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-5">
              <p className="text-white/80 font-semibold text-sm mb-2">{faq.q}</p>
              <p className="text-white/40 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="relative z-10 px-6 py-20 text-center max-w-xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
          Prêt à démarrer ?
        </h2>
        <p className="text-white/40 text-sm mb-8">
          7 jours gratuits, sans carte bancaire. Annulez quand vous voulez.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 hover:-translate-y-0.5"
        >
          <Zap className="h-4 w-4" />
          Commencer l'essai gratuit
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-white/20 text-xs mt-6">
          Des questions ? <a href="mailto:contact@triibu.fr" className="underline hover:text-white/40 transition-colors">contact@triibu.fr</a>
        </p>
      </section>
    </div>
  );
}
