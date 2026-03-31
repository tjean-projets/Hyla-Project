import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, CalendarRange, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// ── Fuzzy name matching ──
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function matchScore(a: string, b: string): number {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  const matrix: number[][] = [];
  for (let i = 0; i <= na.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= nb.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= na.length; i++) {
    for (let j = 1; j <= nb.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (na[i - 1] === nb[j - 1] ? 0 : 1)
      );
    }
  }
  return Math.round((1 - matrix[na.length][nb.length] / maxLen) * 100);
}

const MONTHS_FR: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04',
  mai: '05', juin: '06', juillet: '07', août: '08', aout: '08',
  septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
};

/** Parse a raw cell value into YYYY-MM string. Returns '' if unrecognized. */
function parsePeriodCell(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // MM/YYYY or MM-YYYY
  const mmyyyy = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, '0')}`;

  // DD/MM/YYYY or D/M/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`;

  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{2})[\/\-]\d{2}$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;

  // "janvier 2024" or "Janvier 2024"
  const monthYear = s.match(/^([a-zA-ZÀ-ÿ]+)\s+(\d{4})$/);
  if (monthYear) {
    const m = MONTHS_FR[normalizeStr(monthYear[1])];
    if (m) return `${monthYear[2]}-${m}`;
  }

  // Excel serial number (days since 1900-01-01)
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return '';
}

interface ImportFlowState {
  step: 'upload' | 'mapping' | 'matching' | 'done';
  rawData: Record<string, string>[];
  columns: string[];
  mapping: { name_col: string; amount_col: string; id_col: string; period_col: string };
  period: string;          // used when !isMultiPeriod
  isMultiPeriod: boolean;
  fileName: string;
}

interface MatchRow {
  raw_data: Record<string, string>;
  row_name: string;
  amount: number;
  period: string;           // always set (from period_col or flow.period)
  is_owner_row: boolean;
  matched_member: any;
  match_confidence: number;
  match_status: 'auto' | 'manuel' | 'non_reconnu';
}

export default function Imports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [flow, setFlow] = useState<ImportFlowState>({
    step: 'upload', rawData: [], columns: [],
    mapping: { name_col: '', amount_col: '', id_col: '', period_col: '' },
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    isMultiPeriod: false,
    fileName: '',
  });
  const [matchResults, setMatchResults] = useState<MatchRow[]>([]);

  const { data: imports = [] } = useQuery({
    queryKey: ['commission-imports', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('commission_imports')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-import', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('team_members').select('*').eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // ── File upload handler ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        if (json.length === 0) {
          toast({ title: 'Fichier vide', variant: 'destructive' });
          return;
        }

        const columns = Object.keys(json[0]);
        const nameCol = columns.find(c => /nom|name|conseiller|vendeur/i.test(c)) || '';
        const amountCol = columns.find(c => /montant|amount|commission|total/i.test(c)) || '';
        const idCol = columns.find(c => /id|matricule|code/i.test(c)) || '';
        const periodCol = columns.find(c => /période|periode|mois|month|date/i.test(c)) || '';

        setFlow(prev => ({
          ...prev,
          step: 'mapping',
          rawData: json,
          columns,
          mapping: { name_col: nameCol, amount_col: amountCol, id_col: idCol, period_col: periodCol },
          fileName: file.name,
          // Auto-enable multi-period if a period column was found
          isMultiPeriod: !!periodCol,
        }));
      } catch {
        toast({ title: 'Erreur de lecture du fichier', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  // ── Run matching ──
  const runMatching = useCallback(() => {
    const { rawData, mapping, isMultiPeriod, period } = flow;
    const ownerNames = settings?.owner_matching_names || [];

    const results: MatchRow[] = rawData.map((row) => {
      const rowName = String(row[mapping.name_col] || '').trim();
      const rowId = String(row[mapping.id_col] || '').trim();
      const amount = parseFloat(String(row[mapping.amount_col] || '0').replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;

      // Determine period for this row
      const rowPeriod = isMultiPeriod && mapping.period_col
        ? parsePeriodCell(String(row[mapping.period_col] || ''))
        : period;

      const isOwner = ownerNames.some((n: string) => matchScore(n, rowName) >= 85);

      let bestMatch: { member: any; confidence: number } | null = null;
      for (const member of teamMembers) {
        const fullName = `${member.first_name} ${member.last_name}`;
        const names = [fullName, ...(member.matching_names || [])];
        for (const name of names) {
          const score = matchScore(name, rowName);
          if (score > (bestMatch?.confidence || 0)) {
            bestMatch = { member, confidence: score };
          }
        }
        if (rowId && member.internal_id && normalizeStr(rowId) === normalizeStr(member.internal_id)) {
          bestMatch = { member, confidence: 100 };
          break;
        }
      }

      return {
        raw_data: row,
        row_name: rowName,
        amount,
        period: rowPeriod || period,
        is_owner_row: isOwner,
        matched_member: bestMatch?.confidence && bestMatch.confidence >= 60 ? bestMatch.member : null,
        match_confidence: bestMatch?.confidence || 0,
        match_status: isOwner ? 'auto' :
          (bestMatch?.confidence || 0) >= 85 ? 'auto' :
          (bestMatch?.confidence || 0) >= 60 ? 'manuel' :
          'non_reconnu',
      };
    });

    setMatchResults(results);
    setFlow(prev => ({ ...prev, step: 'matching' }));
  }, [flow, teamMembers, settings]);

  // ── Save import — groups by period, creates one import record per unique period ──
  const saveImport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');

      // Group rows by period
      const byPeriod = matchResults.reduce((acc, r) => {
        const p = r.period;
        if (!acc[p]) acc[p] = [];
        acc[p].push(r);
        return acc;
      }, {} as Record<string, MatchRow[]>);

      const periods = Object.keys(byPeriod).sort();

      for (const p of periods) {
        const rows = byPeriod[p];

        const { data: importRecord, error: importError } = await supabase
          .from('commission_imports')
          .insert({
            user_id: user.id,
            file_name: flow.isMultiPeriod ? `${flow.fileName} — ${p}` : flow.fileName,
            period: p,
            column_mapping: flow.mapping as any,
            status: 'en_cours',
          })
          .select()
          .single();

        if (importError || !importRecord) throw importError || new Error(`Échec création import pour ${p}`);

        const dbRows = rows.map(r => ({
          import_id: importRecord.id,
          raw_data: r.raw_data as any,
          matched_member_id: r.matched_member?.id || null,
          is_owner_row: r.is_owner_row,
          match_confidence: r.match_confidence,
          match_status: r.match_status as any,
          amount: r.amount,
          details: r.row_name,
        }));

        const { error: rowsError } = await supabase.from('commission_import_rows').insert(dbRows);
        if (rowsError) throw rowsError;

        await supabase.rpc('consolidate_import_commissions', { p_import_id: importRecord.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-imports'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['stats-commissions'] });
      setFlow(prev => ({ ...prev, step: 'done' }));
      toast({ title: 'Import traité avec succès' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const autoMatched = matchResults.filter(r => r.match_status === 'auto').length;
  const manualNeeded = matchResults.filter(r => r.match_status === 'manuel').length;
  const unmatched = matchResults.filter(r => r.match_status === 'non_reconnu').length;

  // Unique periods detected in multi-period mode
  const detectedPeriods = flow.isMultiPeriod
    ? [...new Set(matchResults.map(r => r.period).filter(Boolean))].sort()
    : [];

  const resetFlow = () => {
    setFlow({
      step: 'upload', rawData: [], columns: [],
      mapping: { name_col: '', amount_col: '', id_col: '', period_col: '' },
      period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      isMultiPeriod: false,
      fileName: '',
    });
    setMatchResults([]);
  };

  return (
    <AppLayout
      title="Imports"
      actions={
        <Button onClick={() => { resetFlow(); setShowImport(true); }} className="bg-[#3b82f6] hover:bg-[#3b82f6]/90">
          <Upload className="h-4 w-4 mr-2" />
          Nouvel import
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Import dialog */}
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {flow.step === 'upload' && 'Importer un fichier de commissions'}
                {flow.step === 'mapping' && 'Mapper les colonnes'}
                {flow.step === 'matching' && 'Résultats du matching'}
                {flow.step === 'done' && 'Import terminé'}
              </DialogTitle>
            </DialogHeader>

            {/* Step 1: Upload */}
            {flow.step === 'upload' && (
              <div className="space-y-4">
                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, isMultiPeriod: false }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      !flow.isMultiPeriod
                        ? 'border-[#3b82f6] bg-blue-50 dark:bg-blue-950/40'
                        : 'border-border bg-card hover:border-[#3b82f6]/50'
                    }`}
                  >
                    <Calendar className={`h-5 w-5 flex-shrink-0 ${!flow.isMultiPeriod ? 'text-[#3b82f6]' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Mois unique</p>
                      <p className="text-xs text-muted-foreground">Un mois, un fichier</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setFlow(prev => ({ ...prev, isMultiPeriod: true }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      flow.isMultiPeriod
                        ? 'border-[#3b82f6] bg-blue-50 dark:bg-blue-950/40'
                        : 'border-border bg-card hover:border-[#3b82f6]/50'
                    }`}
                  >
                    <CalendarRange className={`h-5 w-5 flex-shrink-0 ${flow.isMultiPeriod ? 'text-[#3b82f6]' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Multi-périodes</p>
                      <p className="text-xs text-muted-foreground">Historique complet</p>
                    </div>
                  </button>
                </div>

                {/* Period picker — only for single mode */}
                {!flow.isMultiPeriod && (
                  <div>
                    <Label>Période</Label>
                    <Input
                      type="month"
                      value={flow.period}
                      onChange={(e) => setFlow(prev => ({ ...prev, period: e.target.value }))}
                    />
                  </div>
                )}

                {flow.isMultiPeriod && (
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
                    <strong>Mode historique :</strong> le fichier doit contenir une colonne avec la date ou la période de chaque ligne (ex. "01/2023", "janvier 2023", "2023-01"). L'import créera automatiquement un enregistrement par mois détecté.
                  </div>
                )}

                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Glissez un fichier CSV ou Excel, ou cliquez pour sélectionner</p>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="max-w-xs mx-auto" />
                </div>
              </div>
            )}

            {/* Step 2: Column mapping */}
            {flow.step === 'mapping' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{flow.rawData.length} lignes détectées dans «&nbsp;{flow.fileName}&nbsp;»</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Colonne Nom / Prénom *</Label>
                    <Select value={flow.mapping.name_col} onValueChange={(v) => setFlow(prev => ({ ...prev, mapping: { ...prev.mapping, name_col: v } }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Colonne Montant *</Label>
                    <Select value={flow.mapping.amount_col} onValueChange={(v) => setFlow(prev => ({ ...prev, mapping: { ...prev.mapping, amount_col: v } }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* Period column — only in multi-period mode */}
                  {flow.isMultiPeriod && (
                    <div>
                      <Label>Colonne Période / Date *</Label>
                      <Select value={flow.mapping.period_col} onValueChange={(v) => setFlow(prev => ({ ...prev, mapping: { ...prev.mapping, period_col: v } }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      {flow.mapping.period_col && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Aperçu : «&nbsp;{String(flow.rawData[0]?.[flow.mapping.period_col] || '')}&nbsp;»
                          {' → '}
                          <strong>{parsePeriodCell(String(flow.rawData[0]?.[flow.mapping.period_col] || '')) || '⚠ non reconnu'}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label>Colonne ID / Matricule (optionnel)</Label>
                    <Select value={flow.mapping.id_col} onValueChange={(v) => setFlow(prev => ({ ...prev, mapping: { ...prev.mapping, id_col: v } }))}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucune</SelectItem>
                        {flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-muted/40 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Aperçu (3 premières lignes)</p>
                  {flow.rawData.slice(0, 3).map((row, i) => (
                    <div key={i} className="text-xs text-foreground mb-1 flex items-center gap-2">
                      <span className="font-medium">{row[flow.mapping.name_col] || '—'}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-emerald-600 font-semibold">{row[flow.mapping.amount_col] || '0'} €</span>
                      {flow.isMultiPeriod && flow.mapping.period_col && (
                        <span className="text-[#3b82f6] text-[10px] bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                          {parsePeriodCell(String(row[flow.mapping.period_col] || '')) || row[flow.mapping.period_col] || '?'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  onClick={runMatching}
                  disabled={!flow.mapping.name_col || !flow.mapping.amount_col || (flow.isMultiPeriod && !flow.mapping.period_col)}
                  className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                >
                  Lancer le matching
                </Button>
              </div>
            )}

            {/* Step 3: Matching results */}
            {flow.step === 'matching' && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{autoMatched}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Auto-matchées</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{manualNeeded}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">À confirmer</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                    <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{unmatched}</p>
                    <p className="text-xs text-red-500 dark:text-red-400">Non reconnues</p>
                  </div>
                </div>

                {/* Detected periods summary (multi-period mode) */}
                {detectedPeriods.length > 1 && (
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                      {detectedPeriods.length} périodes détectées — un import sera créé par mois
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedPeriods.map(p => (
                        <span key={p} className="text-[11px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">
                          {p} ({matchResults.filter(r => r.period === p).length} lignes)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rows list */}
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {matchResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg text-sm gap-2 ${
                      r.match_status === 'auto' ? 'bg-green-50 dark:bg-green-950/20' :
                      r.match_status === 'manuel' ? 'bg-amber-50 dark:bg-amber-950/20' :
                      'bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{r.row_name}</span>
                        {r.is_owner_row && <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">Moi</span>}
                        {r.matched_member && !r.is_owner_row && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            → {r.matched_member.first_name} {r.matched_member.last_name} ({r.match_confidence}%)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {flow.isMultiPeriod && (
                          <span className="text-[10px] text-[#3b82f6] bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded font-medium">
                            {r.period}
                          </span>
                        )}
                        <span className="font-semibold text-foreground">{r.amount.toLocaleString('fr-FR')} €</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => saveImport.mutate()}
                  disabled={saveImport.isPending}
                  className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90"
                >
                  {saveImport.isPending
                    ? 'Traitement...'
                    : flow.isMultiPeriod && detectedPeriods.length > 1
                      ? `Valider — ${detectedPeriods.length} imports (${matchResults.length} lignes)`
                      : 'Valider et consolider'
                  }
                </Button>
              </div>
            )}

            {/* Step 4: Done */}
            {flow.step === 'done' && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground">Import terminé</p>
                {detectedPeriods.length > 1 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {detectedPeriods.length} périodes importées — {matchResults.length} lignes consolidées.
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-1">Les commissions ont été consolidées dans votre tableau de bord.</p>
                <Button onClick={() => setShowImport(false)} className="mt-4">Fermer</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Import history */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Historique des imports</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fichier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Période</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Stats</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {imports.map((imp: any) => {
                const stats = imp.stats || {};
                return (
                  <tr key={imp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{imp.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-mono text-xs">{imp.period}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${IMPORT_STATUS_COLORS[imp.status as keyof typeof IMPORT_STATUS_COLORS]}`}>
                        {IMPORT_STATUS_LABELS[imp.status as keyof typeof IMPORT_STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {stats.matched_rows !== undefined && (
                        <span>{stats.matched_rows}/{stats.total_rows} matchées · {(stats.total_amount || 0).toLocaleString('fr-FR')} €</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(imp.uploaded_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                );
              })}
              {imports.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Aucun import</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
