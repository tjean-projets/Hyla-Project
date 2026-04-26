import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase, HYLA_LEVELS } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, ChevronRight, Check, User, ShoppingBag, Settings2 } from 'lucide-react';

const STORAGE_KEY = 'hyla_setup_done';

export default function SetupWizard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<string>('vendeur');
  const [saving, setSaving] = useState(false);

  // Only show to genuinely new users (no contacts + no deals)
  const { data: hasData, isLoading } = useQuery({
    queryKey: ['setup-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return true;
      const [{ count: contactCount }, { count: dealCount }] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      return (contactCount ?? 0) > 0 || (dealCount ?? 0) > 0;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (isLoading) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done && hasData === false) {
      setOpen(true);
    }
  }, [isLoading, hasData]);

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  const saveLevel = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      hyla_level: selectedLevel,
    }, { onConflict: 'user_id' });
    queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    setSaving(false);
    setStep(1);
  };

  const steps = [
    { label: 'Mon niveau', icon: Settings2 },
    { label: 'Premier contact', icon: User },
    { label: 'Première vente', icon: ShoppingBag },
  ];

  const levelDef = HYLA_LEVELS.find(l => l.value === selectedLevel);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 pt-8 pb-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-base font-bold text-white">Bienvenue sur Hyla Assistant !</DialogTitle>
          </div>
          <p className="text-sm text-blue-100">3 étapes pour bien démarrer</p>

          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex-1">
                  <div className={`h-1 rounded-full transition-all ${i <= step ? 'bg-white' : 'bg-white/30'}`} />
                  <div className="flex items-center gap-1 mt-1.5">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      i < step ? 'bg-green-400' : i === step ? 'bg-white text-blue-600' : 'bg-white/30'
                    }`}>
                      {i < step ? <Check className="h-3 w-3 text-white" /> : <Icon className={`h-3 w-3 ${i === step ? 'text-blue-600' : 'text-white/70'}`} />}
                    </div>
                    <span className={`text-[10px] font-medium ${i === step ? 'text-white' : 'text-white/60'}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1 — Choisir niveau */}
        {step === 0 && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Quel est ton niveau Hyla actuel ?</p>
              <p className="text-xs text-muted-foreground">Cela permet de calculer correctement tes commissions</p>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {HYLA_LEVELS.slice(0, 6).map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => setSelectedLevel(lvl.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    selectedLevel === lvl.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border hover:border-blue-200'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{lvl.label}</p>
                    <p className="text-[10px] text-muted-foreground">{lvl.recruteCommission}€/vente recrue</p>
                  </div>
                  {selectedLevel === lvl.value && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
            <button
              onClick={saveLevel}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {saving ? 'Enregistrement...' : <>Continuer <ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
        )}

        {/* Step 2 — Premier contact */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Ajoute ton premier contact</p>
              <p className="text-xs text-muted-foreground">Prospects, clients, recrues — tout commence ici</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 text-center">
              <User className="h-10 w-10 text-blue-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Va dans l'onglet <strong className="text-foreground">Contacts</strong> pour ajouter tes premiers prospects ou clients.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground font-medium active:scale-[0.98]"
              >
                Plus tard
              </button>
              <button
                onClick={() => { handleFinish(); window.location.href = '/contacts'; }}
                className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                Aller aux contacts <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Première vente */}
        {step === 2 && (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Enregistre ta première vente</p>
              <p className="text-xs text-muted-foreground">Ta commission est calculée automatiquement dès la 1ère vente</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4 text-center">
              <ShoppingBag className="h-10 w-10 text-purple-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Dans l'onglet <strong className="text-foreground">Ventes</strong>, clique sur <strong className="text-foreground">+ Nouvelle vente</strong> pour créer ta première.</p>
              {levelDef && (
                <p className="text-xs text-blue-600 font-semibold mt-2">
                  Ta 1ère vente = 300€ de commission
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleFinish}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground font-medium active:scale-[0.98]"
              >
                Plus tard
              </button>
              <button
                onClick={() => { handleFinish(); window.location.href = '/deals'; }}
                className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                Aller aux ventes <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground pb-4 -mt-2">
          <button onClick={handleFinish} className="underline">Passer l'onboarding</button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
