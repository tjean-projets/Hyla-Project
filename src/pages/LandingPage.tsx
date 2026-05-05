import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, Award, BarChart3,
  CheckCircle2, ArrowRight, Zap, Target,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Gestion des contacts',
    description: 'Centralisez vos prospects, clients et recrues. Suivez chaque relation et ne laissez plus aucune opportunité passer.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: TrendingUp,
    title: 'Suivi des ventes',
    description: 'Visualisez votre pipeline en kanban ou liste. Barème glissant automatique, commissions en temps réel.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Award,
    title: 'Commissions & finances',
    description: 'Commissions attendues et confirmées, prime de groupe, import TRV Hyla. Tout est calculé pour vous.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: BarChart3,
    title: 'Statistiques & réseau',
    description: "Visualisez la performance de votre équipe, suivez votre progression vers le prochain niveau Hyla.",
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: Target,
    title: 'Challenges & objectifs',
    description: 'Countdown, Rookie... suivez vos challenges en temps réel avec bonus à la clé.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    icon: Zap,
    title: 'Application mobile',
    description: "Installez Triibu sur votre téléphone comme une app native. Disponible sur iOS et Android, sans App Store.",
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
  },
];

const benefits = [
  'Tableau de bord centralisé',
  'Import TRV Hyla automatique',
  'Gestion multi-niveaux (Vendeur → Elite Or)',
  'Simulateur de commissions',
  'Profil public partageable',
  'Académie de formation',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08090f] text-white overflow-x-hidden">
      {/* ── Ambient glow ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-violet-600/[0.05] rounded-full blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <img src="/Hyla_logo_bold.png" alt="Triibu" className="h-8 w-8 object-contain brightness-0 invert" />
          <span className="text-xl font-bold tracking-tight">Triibu</span>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/[0.12] text-sm font-medium hover:bg-white/[0.12] transition-all"
        >
          Se connecter
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center px-6 pt-16 pb-20 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          CRM dédié aux conseillers Hyla
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6">
          Gérez votre activité{' '}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Hyla
          </span>
          <br />comme un pro
        </h1>

        <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Triibu centralise vos contacts, ventes, commissions et réseau dans une seule app.
          Conçu spécifiquement pour les conseillers et managers Hyla.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 hover:-translate-y-0.5"
          >
            <Zap className="h-4 w-4" />
            Accéder à mon espace
          </Link>
          <a
            href="#fonctionnalites"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white/70 font-medium text-base hover:bg-white/[0.1] transition-all"
          >
            Découvrir les fonctionnalités
          </a>
        </div>
      </section>

      {/* ── App preview / mockup ── */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/40">
          {/* Fake browser bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] border-b border-white/[0.06]">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.06] text-white/30 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
                triibu.fr
              </div>
            </div>
          </div>
          {/* KPI preview */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ventes ce mois', value: '7', sub: '+3 vs mois dernier', color: 'text-emerald-400' },
              { label: 'Com. attendue', value: '3 150 €', sub: 'Barème glissant', color: 'text-amber-400' },
              { label: 'Com. confirmée', value: '2 800 €', sub: 'Import TRV', color: 'text-green-400' },
              { label: 'Équipe active', value: '12', sub: 'Recrues directes', color: 'text-blue-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <p className="text-white/40 text-xs mb-1.5">{kpi.label}</p>
                <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className="text-white/25 text-[10px] mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Challenge Rebours', value: '4/5 ventes', pct: 80, color: 'bg-amber-500' },
              { label: 'Challenge Rookie', value: '11/15 ventes', pct: 73, color: 'bg-violet-500' },
              { label: 'Prochain niveau', value: 'Manager', pct: 60, color: 'bg-blue-500' },
            ].map((bar) => (
              <div key={bar.label} className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/50 text-xs">{bar.label}</p>
                  <p className="text-white text-xs font-semibold">{bar.value}</p>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="fonctionnalites" className="relative z-10 px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-white/40 text-base max-w-xl mx-auto">
            Une plateforme complète pensée pour le métier Hyla, du premier contact à la commission confirmée.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={`rounded-2xl p-5 border ${feat.bg} transition-all hover:-translate-y-1 hover:shadow-lg`}
              >
                <div className={`inline-flex p-2.5 rounded-xl ${feat.bg} mb-4`}>
                  <Icon className={`h-5 w-5 ${feat.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{feat.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Benefits checklist ── */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center gap-10">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
              Inclus dans chaque accès
            </h2>
            <p className="text-white/40 text-sm mb-0">
              Tout est intégré. Pas de module en option, pas de surprise.
            </p>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((b) => (
              <div key={b} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-white/70 text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="relative z-10 px-6 py-20 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
          Prêt à passer à la vitesse supérieure ?
        </h2>
        <p className="text-white/40 text-base mb-8">
          Connectez-vous à votre espace ou demandez un accès à votre manager.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 hover:-translate-y-0.5"
        >
          <Zap className="h-5 w-5" />
          Accéder à mon espace
          <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="text-white/20 text-xs mt-6">
          Triibu · Conçu pour les conseillers et managers Hyla
        </p>
      </section>
    </div>
  );
}
