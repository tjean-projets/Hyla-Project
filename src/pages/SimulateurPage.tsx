import { AppLayout } from '@/components/AppLayout';
import { HYLA_LEVELS, getPersonalSaleCommission, getGroupPrime } from '@/lib/supabase';
import type { HylaLevel } from '@/lib/supabase';
import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { useAmounts } from '@/contexts/AmountsContext';

export default function SimulateurPage() {
  return (
    <AppLayout title="Simulateur">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Simulateur de revenus</h2>
            <p className="text-xs text-muted-foreground">Projette tes commissions selon tes paramètres</p>
          </div>
        </div>
        <CommissionCalculator />
      </div>
    </AppLayout>
  );
}

/* ── Simulateur complet Hyla ── */
export function CommissionCalculator() {
  const [tab, setTab] = useState<'perso' | 'equipe' | 'niveaux'>('perso');
  const [nbVentes, setNbVentes] = useState(5);
  const [nbRecrues, setNbRecrues] = useState(3);
  const [ventesMoyRecrue, setVentesMoyRecrue] = useState(2);
  const [simLevel, setSimLevel] = useState<HylaLevel>('manager');

  const { visible, mask } = useAmounts();

  const levelData = HYLA_LEVELS.find(l => l.value === simLevel)!;
  const myLevelIdx = HYLA_LEVELS.findIndex(l => l.value === simLevel);
  const nextLevel = myLevelIdx < HYLA_LEVELS.length - 1 ? HYLA_LEVELS[myLevelIdx + 1] : null;

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const persoBreakdown = useMemo(() => {
    const rows: { rank: number; com: number }[] = [];
    for (let i = 1; i <= nbVentes; i++) rows.push({ rank: i, com: getPersonalSaleCommission(i) });
    return rows;
  }, [nbVentes]);
  const totalPerso = persoBreakdown.reduce((s, r) => s + r.com, 0);

  const teamSalesTotal = nbVentes + nbRecrues * ventesMoyRecrue;
  const recruesCommission = nbRecrues * ventesMoyRecrue * levelData.recruteCommission;
  const primeParMachine = getGroupPrime(simLevel, teamSalesTotal);
  const primeTotale = primeParMachine * teamSalesTotal;
  const totalGeneral = totalPerso + recruesCommission + primeTotale;

  const nextRecrueCom = nextLevel?.recruteCommission ?? 0;
  const nextPrimeParMachine = nextLevel ? getGroupPrime(nextLevel.value, teamSalesTotal) : 0;
  const gainNextLevel = nextLevel
    ? (nextRecrueCom - levelData.recruteCommission) * nbRecrues * ventesMoyRecrue
      + (nextPrimeParMachine - primeParMachine) * teamSalesTotal
    : 0;

  const sliderStyle = (val: number, max: number, color: string) => ({
    background: `linear-gradient(to right, ${color} ${(val / max) * 100}%, #e5e7eb ${(val / max) * 100}%)`,
  });

  /* Input numérique inline — éditable au clavier, synchro avec le slider */
  const NumInput = ({
    value, min, max, onChange, color = '#1e293b',
  }: { value: number; min: number; max: number; onChange: (v: number) => void; color?: string }) => (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={e => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(clamp(v, min, max));
      }}
      onBlur={e => {
        const v = parseInt(e.target.value, 10);
        onChange(isNaN(v) ? min : clamp(v, min, max));
      }}
      className="w-12 text-sm font-bold text-right bg-transparent appearance-none focus:outline-none focus:border-b border-dashed border-current"
      style={{ color }}
    />
  );

  /* Formate et masque un montant */
  const fmt = (n: number) => visible ? n.toLocaleString('fr-FR') : '•••';

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Simulateur Hyla</p>
            <p className="text-[10px] text-muted-foreground">Commissions · Équipe · Progression</p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold text-[#3b82f6] transition-all ${!visible ? 'blur-sm select-none' : ''}`}>
              {fmt(totalGeneral)} €
            </p>
            <p className="text-[10px] text-muted-foreground">total estimé/mois</p>
          </div>
        </div>

        {/* Level selector */}
        <div className="mb-3">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-2">Niveau simulé</p>
          <div className="flex flex-wrap gap-1.5">
            {HYLA_LEVELS.map(l => (
              <button
                key={l.value}
                onClick={() => setSimLevel(l.value)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all ${
                  simLevel === l.value
                    ? `bg-gradient-to-r ${l.color} text-white shadow-sm scale-105`
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {l.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(['perso', 'equipe', 'niveaux'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-[11px] py-1.5 rounded-lg font-semibold transition-all ${
                tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              {t === 'perso' ? 'Ventes perso' : t === 'equipe' ? 'Mon équipe' : 'Niveaux'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">

        {/* ── TAB PERSO ── */}
        {tab === 'perso' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Ventes personnelles ce mois</span>
                <div className="flex items-center gap-1">
                  <NumInput value={nbVentes} min={1} max={12} onChange={setNbVentes} color="#3b82f6" />
                  <span className="text-[11px] text-muted-foreground">vente{nbVentes > 1 ? 's' : ''}</span>
                </div>
              </div>
              <input
                type="range" min={1} max={12} value={nbVentes}
                onChange={e => setNbVentes(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={sliderStyle(nbVentes - 1, 11, '#3b82f6')}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1 px-0.5">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                  <span key={n} className={n === nbVentes ? 'text-[#3b82f6] font-bold' : ''}>{n}</span>
                ))}
              </div>
            </div>

            {/* Barème visuel */}
            <div className="grid grid-cols-5 gap-1">
              {[
                { label: '1ère', com: 300, from: 1, to: 1 },
                { label: '2ème', com: 350, from: 2, to: 2 },
                { label: '3ème', com: 400, from: 3, to: 3 },
                { label: '4→7', com: 450, from: 4, to: 7 },
                { label: '8+', com: 500, from: 8, to: 99 },
              ].map(({ label, com, from, to }) => {
                const active = nbVentes >= from && nbVentes <= to;
                const reached = nbVentes >= from;
                return (
                  <div key={label} className={`text-center rounded-lg p-1.5 transition-all ${active ? 'bg-blue-500 shadow-sm' : reached ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted'}`}>
                    <p className={`text-[8px] mb-0.5 leading-tight ${active ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</p>
                    <p className={`text-[10px] font-bold leading-tight ${active ? 'text-white' : reached ? 'text-[#3b82f6]' : 'text-muted-foreground'}`}>{com}€</p>
                  </div>
                );
              })}
            </div>

            {/* Détail par vente */}
            <div className="space-y-1">
              {persoBreakdown.map(({ rank, com }, idx) => {
                const cumul = persoBreakdown.slice(0, idx + 1).reduce((s, r) => s + r.com, 0);
                return (
                  <div key={rank} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-11 flex-shrink-0">Vente {rank}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-0">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-indigo-400 transition-all" style={{ width: `${(com / 500) * 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold text-[#3b82f6] w-12 text-right flex-shrink-0 transition-all ${!visible ? 'blur-sm select-none' : ''}`}>+{fmt(com)} €</span>
                    <span className={`text-[10px] text-muted-foreground w-14 text-right flex-shrink-0 hidden sm:block transition-all ${!visible ? 'blur-sm select-none' : ''}`}>{fmt(cumul)} €</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Commission perso</span>
              <span className={`text-lg font-bold text-[#3b82f6] transition-all ${!visible ? 'blur-sm select-none' : ''}`}>{fmt(totalPerso)} €</span>
            </div>
            {nbVentes === 5 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-2.5 text-center">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">🎯 5 ventes → Challenge Countdown débloqué (+800€)</p>
              </div>
            )}
            {nbVentes >= 8 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-2.5 text-center">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">🔥 Palier maximum atteint : 500€ par machine</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB ÉQUIPE ── */}
        {tab === 'equipe' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Mes ventes perso</span>
                <div className="flex items-center gap-1">
                  <NumInput value={nbVentes} min={1} max={12} onChange={setNbVentes} color="#3b82f6" />
                  <span className="text-[11px] text-muted-foreground">vente{nbVentes > 1 ? 's' : ''}</span>
                </div>
              </div>
              <input type="range" min={1} max={12} value={nbVentes}
                onChange={e => setNbVentes(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={sliderStyle(nbVentes - 1, 11, '#3b82f6')} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Recrues actives sous toi</span>
                <div className="flex items-center gap-1">
                  <NumInput value={nbRecrues} min={0} max={50} onChange={setNbRecrues} color="#8b5cf6" />
                  <span className="text-[11px] text-muted-foreground">personne{nbRecrues > 1 ? 's' : ''}</span>
                </div>
              </div>
              <input type="range" min={0} max={50} value={nbRecrues}
                onChange={e => setNbRecrues(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={sliderStyle(nbRecrues, 50, '#8b5cf6')} />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Ventes moy. / recrue / mois</span>
                <div className="flex items-center gap-1">
                  <NumInput value={ventesMoyRecrue} min={0} max={12} onChange={setVentesMoyRecrue} color="#8b5cf6" />
                  <span className="text-[11px] text-muted-foreground">vente{ventesMoyRecrue > 1 ? 's' : ''}</span>
                </div>
              </div>
              <input type="range" min={0} max={12} value={ventesMoyRecrue}
                onChange={e => setVentesMoyRecrue(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={sliderStyle(ventesMoyRecrue, 12, '#8b5cf6')} />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0</span><span>3</span><span>6</span><span>9</span><span>12</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1 bg-muted/50 rounded-xl px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Volume équipe total</span>
              <span className="text-[11px] font-semibold text-foreground">
                {nbVentes} + {nbRecrues}×{ventesMoyRecrue} = <strong>{teamSalesTotal} ventes</strong>
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Commission perso</p>
                  <p className="text-[9px] text-muted-foreground">{nbVentes} vente{nbVentes > 1 ? 's' : ''} — barème glissant</p>
                </div>
                <span className={`text-sm font-bold text-[#3b82f6] transition-all ${!visible ? 'blur-sm select-none' : ''}`}>{fmt(totalPerso)} €</span>
              </div>

              <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-950/20 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Commission recrues</p>
                  <p className="text-[9px] text-muted-foreground">{nbRecrues} × {ventesMoyRecrue}v × {levelData.recruteCommission}€</p>
                </div>
                <span className={`text-sm font-bold text-violet-600 transition-all ${!visible ? 'blur-sm select-none' : ''}`}>{fmt(recruesCommission)} €</span>
              </div>

              <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${primeParMachine > 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-muted'}`}>
                <div>
                  <p className={`text-xs font-semibold ${primeParMachine > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>Prime de groupe</p>
                  {primeParMachine > 0
                    ? <p className="text-[9px] text-emerald-600">{primeParMachine}€ × {teamSalesTotal} machines</p>
                    : <p className="text-[9px] text-muted-foreground">
                        {levelData.quotaMois > 0 ? `Requiert ${levelData.quotaMois} ventes équipe (${teamSalesTotal} actuel.)` : 'Dès niveau Manager'}
                      </p>
                  }
                </div>
                <span className={`text-sm font-bold flex-shrink-0 transition-all ${primeParMachine > 0 ? 'text-emerald-600' : 'text-muted-foreground'} ${!visible && primeParMachine > 0 ? 'blur-sm select-none' : ''}`}>
                  {primeParMachine > 0 ? `${fmt(primeTotale)} €` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl px-4 py-3">
                <span className="text-white text-sm font-bold">Total estimé</span>
                <span className={`text-white text-xl font-black transition-all ${!visible ? 'blur-sm select-none' : ''}`}>{fmt(totalGeneral)} €</span>
              </div>
            </div>

            {nextLevel && gainNextLevel > 0 && (
              <div className="border border-dashed border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Si tu passes {nextLevel.label}</p>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-foreground">
                      Recrues : <span className="font-bold text-violet-600">{nextLevel.recruteCommission}€</span>
                      <span className="text-muted-foreground"> (vs {levelData.recruteCommission}€)</span>
                    </p>
                    {nextPrimeParMachine > primeParMachine && (
                      <p className="text-xs text-foreground">
                        Prime : <span className="font-bold text-emerald-600">{nextPrimeParMachine}€</span>/machine
                        <span className="text-muted-foreground"> (vs {primeParMachine}€)</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-base font-bold text-emerald-600 transition-all ${!visible ? 'blur-sm select-none' : ''}`}>+{fmt(gainNextLevel)} €</p>
                    <p className="text-[9px] text-muted-foreground">gain/mois</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB NIVEAUX ── */}
        {tab === 'niveaux' && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground mb-1">
              Avec <span className="font-semibold text-foreground">{nbVentes}v perso</span> + <span className="font-semibold text-foreground">{nbRecrues} recrues × {ventesMoyRecrue}v</span>
            </p>
            {HYLA_LEVELS.map((level, idx) => {
              const isCurrent = level.value === simLevel;
              const isPast = idx < myLevelIdx;
              const simRecrueCom = nbRecrues * ventesMoyRecrue * level.recruteCommission;
              const simPrimePMachine = getGroupPrime(level.value, teamSalesTotal);
              const simTotal = totalPerso + simRecrueCom + simPrimePMachine * teamSalesTotal;
              const gainVsCurrent = simTotal - totalGeneral;

              return (
                <div key={level.value} className={`rounded-xl overflow-hidden transition-all ${isCurrent ? 'ring-2 ring-blue-400' : ''}`}>
                  <div className={`flex items-center gap-2 px-3 py-2.5 ${isCurrent ? `bg-gradient-to-r ${level.color} text-white` : isPast ? 'bg-muted/40' : 'bg-muted/70'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[11px] font-bold ${isCurrent ? 'text-white' : isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{level.label}</span>
                        {isCurrent && <span className="text-[9px] bg-white/25 text-white rounded-full px-1.5 py-0.5 font-semibold">Actuel</span>}
                      </div>
                      <p className={`text-[9px] mt-0.5 ${isCurrent ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {level.recruteCommission}€/recrue · {level.quotaMois > 0 ? `prime dès ${level.quotaMois}v` : 'pas de prime'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold transition-all ${isCurrent ? 'text-white' : isPast ? 'text-muted-foreground' : 'text-foreground'} ${!visible ? 'blur-sm select-none' : ''}`}>
                        {fmt(simTotal)} €
                      </p>
                      {!isCurrent && nbRecrues > 0 && (
                        <p className={`text-[9px] font-semibold transition-all ${gainVsCurrent > 0 ? 'text-emerald-500' : gainVsCurrent < 0 ? 'text-red-400' : 'text-muted-foreground'} ${!visible ? 'blur-sm select-none' : ''}`}>
                          {gainVsCurrent > 0 ? '+' : ''}{fmt(gainVsCurrent)} €
                        </p>
                      )}
                    </div>
                  </div>
                  {!isCurrent && !isPast && (
                    <div className="px-3 py-1.5 bg-muted/30 border-t border-border/50">
                      <p className="text-[9px] text-muted-foreground">{level.conditions}</p>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="bg-muted/30 rounded-xl p-2.5">
              <p className="text-[9px] text-muted-foreground italic">⚠ Le niveau est attribué par Hyla — non modifiable librement.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
