import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Users, ShoppingBag, Network, Wallet, ChevronRight, ChevronLeft,
  CheckCircle, Upload, Settings2, BookOpen, Clock, Star, Zap,
} from 'lucide-react';

const STORAGE_KEY = 'hyla_onboarding_done';

// ── Parcours Débutant ──
const BEGINNER_STEPS = [
  {
    icon: Sparkles, color: '#f59e0b', bg: '#fef3c7',
    title: 'Bienvenue sur Hyla Assistant !',
    description: 'Ton espace pour gérer contacts, ventes et commissions. Suis ce guide pour configurer ton outil en moins de 15 minutes.',
    action: null,
  },
  {
    icon: Settings2, color: '#3b82f6', bg: '#dbeafe',
    title: 'Étape 1 — Configure ton niveau',
    description: 'Dans Paramètres, définis ton niveau Hyla actuel (Vendeur, Manager, etc.). C\'est la base du calcul de tes commissions.',
    action: { label: 'Aller aux paramètres', path: '/settings' },
  },
  {
    icon: Users, color: '#8b5cf6', bg: '#ede9fe',
    title: 'Étape 2 — Ajoute tes premiers contacts',
    description: 'Dans Contacts, ajoute tes prospects et clients. Tu peux aussi importer une liste CSV directement depuis le bouton "Importer CSV".',
    action: { label: 'Aller aux contacts', path: '/contacts' },
  },
  {
    icon: ShoppingBag, color: '#10b981', bg: '#d1fae5',
    title: 'Étape 3 — Enregistre tes ventes',
    description: 'Dans Ventes, crée une vente pour chaque machine vendue. La commission se calcule automatiquement selon le barème glissant Hyla.',
    action: { label: 'Aller aux ventes', path: '/deals' },
  },
  {
    icon: Clock, color: '#f97316', bg: '#ffedd5',
    title: 'Étape 4 — Planifie tes RDV',
    description: 'Dans Calendrier et Tâches, organise tes démos, suivis, relances. Associe chaque tâche à un contact pour tout retrouver.',
    action: { label: 'Voir le calendrier', path: '/calendar' },
  },
  {
    icon: CheckCircle, color: '#3b82f6', bg: '#dbeafe',
    title: 'Tu es prêt(e) !',
    description: 'Continue à remplir tes données. Plus l\'outil a d\'historique, plus les statistiques et prévisions seront pertinentes.',
    action: null,
  },
];

// ── Parcours Vétéran ──
const VETERAN_STEPS = [
  {
    icon: Star, color: '#f59e0b', bg: '#fef3c7',
    title: 'Bienvenue — Mode reprise d\'activité',
    description: 'Tu arrives avec un historique existant. Ce guide te permet de tout importer en moins d\'une heure.',
    action: null,
  },
  {
    icon: Settings2, color: '#3b82f6', bg: '#dbeafe',
    title: 'Étape 1 — Configure ton niveau',
    description: 'Dans Paramètres, définis ton niveau Hyla. Cela impacte le calcul de tes commissions réseau.',
    action: { label: 'Paramètres', path: '/settings' },
  },
  {
    icon: Upload, color: '#8b5cf6', bg: '#ede9fe',
    title: 'Étape 2 — Importe tes fichiers TRV',
    description: 'Dans Finance → bouton "Multi", importe tous tes fichiers TRV passés d\'un coup. L\'outil crée toute ton équipe et reconstruit l\'historique de commissions automatiquement.',
    action: { label: 'Aller à Finance', path: '/finance' },
  },
  {
    icon: Network, color: '#ec4899', bg: '#fce7f3',
    title: 'Étape 3 — Définis les niveaux en masse',
    description: 'Dans Réseau, clique sur "Niveaux" pour passer en mode édition en masse. Change le niveau Hyla de tous tes membres en quelques secondes, sans ouvrir chaque fiche.',
    action: { label: 'Aller au réseau', path: '/network' },
  },
  {
    icon: Users, color: '#10b981', bg: '#d1fae5',
    title: 'Étape 4 — Importe tes prospects',
    description: 'Dans Contacts, utilise "Importer CSV" pour charger ta liste de prospects et clients personnels. Colonnes détectées automatiquement, doublons gérés.',
    action: { label: 'Aller aux contacts', path: '/contacts' },
  },
  {
    icon: Wallet, color: '#f97316', bg: '#ffedd5',
    title: 'Étape 5 — Vérifie tes commissions',
    description: 'Dans Commissions, vérifie l\'historique reconstruit. En Finance, importe le TRV du mois en cours pour valider les commissions de ce mois.',
    action: { label: 'Voir les commissions', path: '/commissions' },
  },
  {
    icon: Zap, color: '#3b82f6', bg: '#dbeafe',
    title: 'Tout est en place !',
    description: 'Ton espace est opérationnel. Les statistiques et le widget "Prochain niveau" se mettent à jour automatiquement chaque mois.',
    action: null,
  },
];

export default function OnboardingGuide() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choice' | 'beginner' | 'veteran'>('choice');
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!done) {
      setOpen(true);
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }
  }, []);

  const steps = mode === 'beginner' ? BEGINNER_STEPS : VETERAN_STEPS;
  const current = steps[step];
  const isFirst = step === 0;
  const isLast = mode !== 'choice' && step === steps.length - 1;
  const Icon = current?.icon;

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  const handleActionClick = () => {
    if (current?.action?.path) {
      handleFinish();
      navigate(current.action.path);
    }
  };

  if (!open) return null;

  // ── Choix du parcours ──
  if (mode === 'choice') {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 pt-8 pb-6 text-white text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-3" />
            <DialogTitle className="text-xl font-bold text-white">Bienvenue sur Hyla Assistant</DialogTitle>
            <p className="text-sm text-blue-100 mt-2">Quel est ton profil pour personnaliser le guide ?</p>
          </div>
          <div className="p-5 space-y-3">
            <button
              onClick={() => { setMode('beginner'); setStep(0); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all text-left active:scale-[0.98]"
            >
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Je débute</p>
                <p className="text-xs text-muted-foreground mt-0.5">Moins d'1 an, moins de 10 personnes dans mon équipe</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
            </button>

            <button
              onClick={() => { setMode('veteran'); setStep(0); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all text-left active:scale-[0.98]"
            >
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">J'ai de l'historique</p>
                <p className="text-xs text-muted-foreground mt-0.5">Plus d'1 an, équipe existante, fichiers TRV à importer</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
            </button>

            <button onClick={handleFinish} className="w-full text-xs text-muted-foreground py-2 text-center hover:text-foreground transition-colors">
              Passer le guide
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Guide pas-à-pas ──
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Colored header */}
        <div className="flex flex-col items-center pt-10 pb-6 transition-colors duration-300" style={{ backgroundColor: current.bg }}>
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-md mb-4">
            <Icon className="h-10 w-10 transition-colors duration-300" style={{ color: current.color }} />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900 text-center px-6">{current.title}</DialogTitle>
        </div>

        {/* Body */}
        <div className="px-6 pb-2 pt-4">
          <p className="text-sm text-gray-600 text-center leading-relaxed">{current.description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {steps.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className="transition-all duration-300 rounded-full"
              style={{ width: i === step ? 24 : 8, height: 8, backgroundColor: i === step ? current.color : '#e5e7eb' }}
            />
          ))}
        </div>
        <p className="text-center text-[11px] text-gray-400 -mt-1">Étape {step + 1} sur {steps.length}</p>

        {/* Action button */}
        {current.action && (
          <div className="px-6 pt-1">
            <button
              onClick={handleActionClick}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: current.color }}
            >
              {current.action.label}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3 px-6 pb-6 pt-3">
          {!isFirst && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center justify-center gap-1 flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 active:scale-[0.97] transition-all"
            >
              <ChevronLeft className="h-4 w-4" />Précédent
            </button>
          )}
          <button
            onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
            className="flex items-center justify-center gap-1 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-[0.97] transition-all"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {isLast ? 'Terminer' : 'Suivant'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {isFirst && (
          <p className="text-center text-[10px] text-gray-400 -mt-4 pb-4">
            <button onClick={() => { setMode('choice'); setStep(0); }} className="underline mr-2">Changer de parcours</button>
            ·
            <button onClick={handleFinish} className="underline ml-2">Passer le guide</button>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
