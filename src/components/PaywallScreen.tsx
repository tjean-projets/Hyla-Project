import { Lock, Zap, ArrowRight, Clock } from 'lucide-react';

interface PaywallScreenProps {
  feature: 'network' | 'finance' | 'stats';
  trialDaysLeft?: number;
  isTrial?: boolean;
}

const FEATURE_INFO = {
  network: {
    title: 'Réseau & équipe',
    description: 'Gérez votre équipe de conseillers, suivez leurs performances, visualisez votre arbre réseau et estimez vos commissions manager.',
    icon: '👥',
  },
  finance: {
    title: 'Import Finance',
    description: 'Importez vos fichiers de commissions multi-périodes, automatisez le matching avec vos membres et consolidez vos données financières.',
    icon: '📊',
  },
  stats: {
    title: 'Statistiques avancées',
    description: 'Analysez vos performances sur l\'année, visualisez vos commissions par mois, et identifiez les raisons de perte de vos deals.',
    icon: '📈',
  },
};

export function PaywallScreen({ feature, trialDaysLeft = 0, isTrial = false }: PaywallScreenProps) {
  const info = FEATURE_INFO[feature];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12 text-center">
      <div className="max-w-md w-full space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto text-3xl">
          {info.icon}
        </div>

        {/* Lock badge */}
        <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
          <Lock className="h-3 w-3" />
          Formule Manager requise
        </div>

        {/* Title & description */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">{info.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{info.description}</p>
        </div>

        {/* Trial warning */}
        {isTrial && trialDaysLeft <= 3 && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <div className="flex items-center gap-2 justify-center">
              <Clock className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Essai gratuit : {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Conseillère</p>
            <p className="text-xl font-black text-foreground">9.99€ <span className="text-xs font-normal text-muted-foreground">/mois</span></p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>✅ Dashboard & KPIs</li>
              <li>✅ Contacts illimités</li>
              <li>✅ Deals & Kanban</li>
              <li>✅ Tâches & Calendrier</li>
              <li>✅ Commissions</li>
              <li className="text-muted-foreground/50">❌ Réseau équipe</li>
              <li className="text-muted-foreground/50">❌ Import Finance</li>
              <li className="text-muted-foreground/50">❌ Stats avancées</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-xl p-4 text-white relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Manager</div>
            <p className="text-xs font-semibold opacity-70 mb-1">Manager</p>
            <p className="text-xl font-black">29.99€ <span className="text-xs font-normal opacity-70">/mois</span></p>
            <ul className="mt-3 space-y-1.5 text-xs opacity-90">
              <li>✅ Tout Conseillère</li>
              <li>✅ Réseau équipe</li>
              <li>✅ Import Finance</li>
              <li>✅ Stats avancées</li>
              <li>✅ Dashboard réseau</li>
              <li>✅ Commissions réseau</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-2">
          <a
            href="mailto:contact@hyla-crm.fr?subject=Abonnement Hyla CRM Manager"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold text-sm rounded-xl hover:bg-[#3b82f6]/90 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Passer à la formule Manager
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="text-[10px] text-muted-foreground">14 jours d'essai gratuit · Sans engagement · Résiliation en 1 clic</p>
        </div>
      </div>
    </div>
  );
}
