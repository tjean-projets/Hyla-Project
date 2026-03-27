import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Users,
  ShoppingBag,
  CheckSquare,
  Network,
  Wallet,
  TrendingUp,
  Rocket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const STORAGE_KEY = 'hyla_onboarding_done';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Bienvenue !',
    description:
      'Bienvenue sur Hyla Assistant, ton espace personnel pour g\u00e9rer ton activit\u00e9 Hyla. D\u00e9couvre les fonctionnalit\u00e9s en quelques \u00e9tapes.',
    icon: Sparkles,
    color: '#f59e0b',
    bgColor: '#fef3c7',
  },
  {
    title: 'Contacts',
    description:
      'Ajoute tes contacts (prospects, clients, recrues) pour suivre ta relation avec chacun. Tu retrouveras ici toutes leurs informations.',
    icon: Users,
    color: '#3b82f6',
    bgColor: '#dbeafe',
  },
  {
    title: 'Ventes',
    description:
      'Enregistre tes ventes de machines Hyla. Le bar\u00e8me de commissions se calcule automatiquement en fonction du nombre de ventes.',
    icon: ShoppingBag,
    color: '#8b5cf6',
    bgColor: '#ede9fe',
  },
  {
    title: 'T\u00e2ches & Calendrier',
    description:
      'Organise ton quotidien : relances, d\u00e9mos, suivis clients. Associe chaque t\u00e2che \u00e0 un contact pour ne rien oublier.',
    icon: CheckSquare,
    color: '#10b981',
    bgColor: '#d1fae5',
  },
  {
    title: 'R\u00e9seau (Managers)',
    description:
      "Si tu es manager, ajoute les membres de ton \u00e9quipe dans l\u2019onglet R\u00e9seau. Indique qui est leur sponsor pour cr\u00e9er l\u2019arborescence automatiquement.",
    icon: Network,
    color: '#ec4899',
    bgColor: '#fce7f3',
  },
  {
    title: 'Finance & Import CSV',
    description:
      "Dans l\u2019onglet Finance, importe ton relev\u00e9 de commissions (fichier Excel/CSV). L\u2019outil fait le tri automatiquement en fonction des noms renseign\u00e9s dans ton R\u00e9seau et tes contacts.",
    icon: Wallet,
    color: '#f97316',
    bgColor: '#ffedd5',
  },
  {
    title: 'Commissions',
    description:
      'Suis l\u2019\u00e9volution de tes commissions directes et r\u00e9seau mois par mois. Tout est calcul\u00e9 automatiquement.',
    icon: TrendingUp,
    color: '#06b6d4',
    bgColor: '#cffafe',
  },
  {
    title: "C'est parti !",
    description:
      'Tu es pr\u00eat(e) ! Commence par ajouter tes premiers contacts et enregistrer tes ventes. Bonne r\u00e9ussite avec Hyla !',
    icon: Rocket,
    color: '#3b82f6',
    bgColor: '#dbeafe',
  },
];

export default function OnboardingGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep((s) => s - 1);
  };

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* ── Colored header area ── */}
        <div
          className="flex flex-col items-center pt-10 pb-6 transition-colors duration-300"
          style={{ backgroundColor: current.bgColor }}
        >
          <div
            className="flex items-center justify-center w-20 h-20 rounded-full mb-4 shadow-md transition-all duration-300"
            style={{ backgroundColor: 'white' }}
          >
            <Icon className="h-10 w-10 transition-colors duration-300" style={{ color: current.color }} />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900 text-center px-6">
            {current.title}
          </DialogTitle>
        </div>

        {/* ── Body ── */}
        <div className="px-6 pb-2">
          <DialogDescription className="text-sm text-gray-600 text-center leading-relaxed">
            {current.description}
          </DialogDescription>
        </div>

        {/* ── Progress dots ── */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                backgroundColor: i === step ? '#3b82f6' : '#e5e7eb',
              }}
              aria-label={`\u00c9tape ${i + 1}`}
            />
          ))}
        </div>

        {/* ── Step counter ── */}
        <p className="text-center text-[11px] text-gray-400 -mt-1">
          \u00c9tape {step + 1} sur {STEPS.length}
        </p>

        {/* ── Navigation buttons ── */}
        <div className="flex items-center gap-3 px-6 pb-6 pt-2">
          {!isFirst && (
            <button
              onClick={handlePrev}
              className="flex items-center justify-center gap-1 flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 active:scale-[0.97] transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              Pr\u00e9c\u00e9dent
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex items-center justify-center gap-1 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-[0.97] transition-all"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {isLast ? 'Terminer' : 'Suivant'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
