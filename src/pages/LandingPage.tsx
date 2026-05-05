import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, Award, BarChart3, Target, Zap,
  ArrowRight, CheckCircle2, Calendar, FileText,
  Network, Smartphone, BookOpen, MapPin, Clock,
  ChevronRight, Star,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const painPoints = [
  { icon: Clock,    text: 'Perdre du temps à tout gérer sur Excel ou papier' },
  { icon: Users,    text: 'Oublier de relancer un prospect au bon moment' },
  { icon: BarChart3,text: 'Ne pas savoir exactement ce que vous avez gagné ce mois' },
  { icon: Network,  text: 'Manquer de visibilité sur la performance de votre équipe' },
];

const features = [
  {
    icon: TrendingUp,
    title: 'Pipeline de ventes',
    description: 'Visualisez vos deals en kanban ou liste. Suivez chaque opportunité de la prise de contact à la signature. Plus aucune vente ne tombe dans les oublis.',
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.07]',
    tag: 'Ventes',
  },
  {
    icon: Users,
    title: 'CRM contacts complet',
    description: 'Clients, prospects, recrues : tout dans un seul endroit. Fiches détaillées, historique des échanges, étiquettes et notes personnalisées.',
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/[0.07]',
    tag: 'Contacts',
  },
  {
    icon: Award,
    title: 'Commissions automatiques',
    description: 'Barème glissant calculé en temps réel. Commissions attendues et confirmées côte à côte. Import de vos données officielles en un clic.',
    color: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/[0.07]',
    tag: 'Finance',
  },
  {
    icon: Network,
    title: 'Réseau & recrutement',
    description: 'Visualisez votre downline en temps réel. Suivez l\'activité de chaque recrue, identifiez vos tops performers et accélérez la montée en niveau.',
    color: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/[0.07]',
    tag: 'Réseau',
  },
  {
    icon: BarChart3,
    title: 'Statistiques & performances',
    description: 'Tableaux de bord visuels : CA mensuel, volume équipe, taux de conversion, top recruteurs. Prenez les bonnes décisions au bon moment.',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.07]',
    tag: 'Stats',
  },
  {
    icon: Target,
    title: 'Challenges & objectifs',
    description: 'Countdown, Rookie... suivez vos challenges en temps réel avec décompte et bonus à la clé. La gamification au service de votre motivation.',
    color: 'text-rose-400',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/[0.07]',
    tag: 'Objectifs',
  },
  {
    icon: Calendar,
    title: 'Agenda & tâches',
    description: 'Planifiez vos rendez-vous, rappels et actions de suivi. Ne manquez plus jamais une relance ou un événement important pour votre activité.',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.07]',
    tag: 'Organisation',
  },
  {
    icon: FileText,
    title: 'Finance & facturation',
    description: 'Générez vos factures et rapports mensuels comptables en PDF. Toute votre comptabilité simplifiée, prête pour votre expert-comptable.',
    color: 'text-teal-400',
    border: 'border-teal-500/20',
    bg: 'bg-teal-500/[0.07]',
    tag: 'Comptabilité',
  },
  {
    icon: BookOpen,
    title: 'Formation intégrée',
    description: 'Académie et ressources directement dans l\'app. Formez vos recrues, partagez les bonnes pratiques et accélérez leur montée en compétences.',
    color: 'text-orange-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/[0.07]',
    tag: 'Formation',
  },
  {
    icon: MapPin,
    title: 'Carte & géolocalisation',
    description: 'Visualisez vos contacts et prospects sur une carte. Optimisez vos tournées, identifiez les zones à fort potentiel près de chez vous.',
    color: 'text-lime-400',
    border: 'border-lime-500/20',
    bg: 'bg-lime-500/[0.07]',
    tag: 'Terrain',
  },
  {
    icon: Star,
    title: 'Profil public partageable',
    description: 'Votre page de présentation personnelle avec votre offre et vos coordonnées. Partagez un simple lien pour recruter ou prospecter en ligne.',
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/[0.07]',
    tag: 'Visibilité',
  },
  {
    icon: Smartphone,
    title: 'App mobile native',
    description: 'Installez Triibu sur votre téléphone comme une vraie app, sans passer par l\'App Store. iOS et Android, disponible immédiatement.',
    color: 'text-indigo-400',
    border: 'border-indigo-500/20',
    bg: 'bg-indigo-500/[0.07]',
    tag: 'Mobile',
  },
];

const stats = [
  { value: '100 %', label: 'des commissions calculées automatiquement' },
  { value: '< 2 min', label: 'pour importer vos données de vente' },
  { value: '12', label: 'modules pour gérer toute votre activité' },
  { value: '0 €', label: 'de logiciel supplémentaire à acheter' },
];

const testimonialBullets = [
  'Je sais exactement ce que j\'ai gagné chaque mois, sans calcul manuel',
  'Je ne perds plus de prospects — tout est dans Triibu',
  'Mes recrues progressent plus vite grâce au suivi en temps réel',
  'J\'ai enfin une vue claire sur la performance de toute mon équipe',
  'Mon comptable reçoit mes rapports PDF en 2 clics',
  'Je gère tout depuis mon téléphone entre deux rendez-vous',
];

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08090f] text-white overflow-x-hidden">

      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/[0.06] rounded-full blur-[140px]" />
        <div className="absolute top-[60%] right-[-150px] w-[600px] h-[600px] bg-violet-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-emerald-600/[0.03] rounded-full blur-[100px]" />
      </div>

      {/* ════════════════════════════════════════
          HEADER
      ════════════════════════════════════════ */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Triibu</span>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.07] border border-white/[0.10] text-sm font-medium hover:bg-white/[0.12] transition-all"
        >
          Se connecter <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="relative z-10 text-center px-6 pt-14 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Le CRM pensé pour les réseaux de vente directe
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] mb-6">
          Votre business MLM,{' '}
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
            enfin sous contrôle
          </span>
        </h1>

        <p className="text-white/50 text-lg max-w-2xl mx-auto mb-4 leading-relaxed">
          Triibu centralise tout ce dont vous avez besoin pour développer votre réseau, suivre vos ventes et maximiser vos revenus — dans une seule application.
        </p>
        <p className="text-white/30 text-sm max-w-xl mx-auto mb-10">
          Moins de temps sur l'administratif. Plus de temps sur le terrain.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/25 hover:-translate-y-0.5"
          >
            <Zap className="h-4 w-4" />
            Accéder à mon espace
          </Link>
          <a
            href="#fonctionnalites"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/70 font-medium text-base hover:bg-white/[0.10] transition-all"
          >
            Voir les fonctionnalités <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PAIN POINTS
      ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-16 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-6 sm:p-8">
          <p className="text-white/40 text-sm text-center mb-6 uppercase tracking-widest font-medium">
            Vous en avez assez de…
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {painPoints.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.text} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-red-400" />
                  </div>
                  <span className="text-white/60 text-sm">{p.text}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-6 border-t border-white/[0.07] text-center">
            <p className="text-white/70 text-sm font-medium">
              Triibu résout tous ces problèmes — dès le premier jour.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          STATS
      ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 text-center">
              <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent mb-2">
                {s.value}
              </p>
              <p className="text-white/40 text-xs leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          APP PREVIEW
      ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-white/30 text-xs uppercase tracking-widest font-medium">Aperçu de l'application</p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.05] text-white/25 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
                triibu.fr/dashboard
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ventes ce mois', value: '7', sub: '+3 vs mois dernier', color: 'text-emerald-400' },
              { label: 'Com. attendue', value: '3 150 €', sub: 'Barème glissant auto', color: 'text-amber-400' },
              { label: 'Com. confirmée', value: '2 800 €', sub: 'Import officiel', color: 'text-green-400' },
              { label: 'Équipe active', value: '12', sub: 'Recrues directes', color: 'text-blue-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
                <p className="text-white/35 text-xs mb-2">{kpi.label}</p>
                <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className="text-white/25 text-[10px] mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Challenge Sprint', pct: 80, value: '4/5 ventes', color: 'from-amber-500 to-orange-500' },
              { label: 'Challenge Rookie', pct: 73, value: '11/15 ventes', color: 'from-violet-500 to-purple-600' },
              { label: 'Prochain niveau', pct: 60, value: '2/3 conditions', color: 'from-blue-500 to-cyan-500' },
            ].map((bar) => (
              <div key={bar.label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-white/45 text-xs">{bar.label}</p>
                  <p className="text-white/70 text-xs font-semibold">{bar.value}</p>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FEATURES GRID
      ════════════════════════════════════════ */}
      <section id="fonctionnalites" className="relative z-10 px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Tout ce qu'il vous faut pour{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              scaler votre réseau
            </span>
          </h2>
          <p className="text-white/40 text-base max-w-2xl mx-auto">
            12 modules intégrés pour couvrir chaque aspect de votre activité, du premier contact à la commission encaissée.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={`group rounded-2xl p-5 border ${feat.border} ${feat.bg} transition-all duration-200 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex p-2.5 rounded-xl ${feat.bg} border ${feat.border}`}>
                    <Icon className={`h-5 w-5 ${feat.color}`} />
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${feat.color} opacity-60`}>
                    {feat.tag}
                  </span>
                </div>
                <h3 className="font-bold text-white mb-2 text-[15px]">{feat.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════
          TESTIMONIAL BULLETS
      ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600/[0.12] to-violet-600/[0.08] border border-blue-500/20 p-8 sm:p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
              Ce que disent vos futurs résultats
            </h2>
            <p className="text-white/40 text-sm">
              Ce que vous entendrez de vous-même dans 30 jours d'utilisation.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {testimonialBullets.map((b) => (
              <div key={b} className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-white/65 text-sm leading-relaxed">"{b}"</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MOBILE CTA
      ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-8 sm:p-12 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
              <Smartphone className="h-3.5 w-3.5" />
              Application mobile
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
              Dans votre poche, partout, tout le temps
            </h2>
            <p className="text-white/45 text-sm leading-relaxed">
              Triibu s'installe sur votre iPhone ou Android comme une vraie application native — sans passer par l'App Store. Un raccourci sur votre écran d'accueil et vous êtes opérationnel en 10 secondes.
            </p>
          </div>
          <div className="flex-shrink-0 flex flex-col gap-3 text-sm">
            {['Fonctionne hors connexion', 'Notifications en temps réel', 'Interface optimisée mobile', 'Installation en 1 clic'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                <span className="text-white/60">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA FINAL
      ════════════════════════════════════════ */}
      <section className="relative z-10 px-6 py-24 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Accès immédiat — aucune installation requise
        </div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
          Prêt à passer à la vitesse supérieure ?
        </h2>
        <p className="text-white/40 text-base mb-10 leading-relaxed">
          Rejoignez les distributeurs qui ont arrêté de subir leur activité et ont commencé à la piloter.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg transition-all shadow-xl shadow-blue-600/25 hover:-translate-y-0.5"
        >
          <Zap className="h-5 w-5" />
          Accéder à mon espace
          <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="text-white/20 text-xs mt-8">
          Triibu · Votre partenaire de croissance en vente directe
        </p>
      </section>
    </div>
  );
}
