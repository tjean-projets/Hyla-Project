import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  // Simple Levenshtein-based similarity
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  let dist = 0;
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
  dist = matrix[na.length][nb.length];
  return Math.round((1 - dist / maxLen) * 100);
}

interface ImportFlowState {
  step: 'upload' | 'mapping' | 'matching' | 'done';
  rawData: Record<string, string>[];
  columns: string[];
  mapping: { name_col: string; amount_col: string; id_col: string };
  period: string;
  fileName: string;
}

export default function Imports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [flow, setFlow] = useState<ImportFlowState>({
    step: 'upload', rawData: [], columns: [],
    mapping: { name_col: '', amount_col: '', id_col: '' },
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    fileName: '',
  });
  const [matchResults, setMatchResults] = useState<any[]>([]);

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
        // Try to auto-detect column mapping
        const nameCol = columns.find(c => /nom|name|conseiller|vendeur/i.test(c)) || '';
        const amountCol = columns.find(c => /montant|amount|commission|total/i.test(c)) || '';
        const idCol = columns.find(c => /id|matricule|code/i.test(c)) || '';

        setFlow({
          step: 'mapping',
          rawData: json,
          columns,
          mapping: { name_col: nameCol, amount_col: amountCol, id_col: idCol },
          period: flow.period,
          fileName: file.name,
        });
      } catch {
        toast({ title: 'Erreur de lecture du fichier', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [flow.period, toast]);

  // ── Run matching ──
  const runMatching = useCallback(() => {
    const { rawData, mapping } = flow;
    const ownerNames = settings?.owner_matching_names || [];

    const results = rawData.map((row) => {
      const rowName = String(row[mapping.name_col] || '').trim();
      const rowId = String(row[mapping.id_col] || '').trim();
      const amount = parseFloat(String(row[mapping.amount_col] || '0').replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;

      // Check if it's the owner's row
      const isOwner = ownerNames.some((n: string) => matchScore(n, rowName) >= 85);

      // Try matching against team members
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
        // Also try matching by internal ID
        if (rowId && member.internal_id && normalizeStr(rowId) === normalizeStr(member.internal_id)) {
          bestMatch = { member, confidence: 100 };
          break;
        }
      }

      return {
        raw_data: row,
        row_name: rowName,
        amount,
        is_owner_row: isOwner,
        matched_member: bestMatch?.confidence && bestMatch.confidence >= 60 ? bestMatch.member : null,
        match_confidence: bestMatch?.confidence || 0,
        match_status: isOwner ? 'auto' as const :
          (bestMatch?.confidence || 0) >= 85 ? 'auto' as const :
          (bestMatch?.confidence || 0) >= 60 ? 'manuel' as const :
          'non_reconnu' as const,
      };
    });

    setMatchResults(results);
    setFlow({ ...flow, step: 'matching' });
  }, [flow, teamMembers, settings]);

  // ── Save import ──
  const saveImport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('commission_imports')
        .insert({
          user_id: user.id,
          file_name: flow.fileName,
          period: flow.period,
          column_mapping: flow.mapping as any,
          status: 'en_cours',
        })
        .select()
        .single();

      if (importError || !importRecord) throw importError || new Error('Échec création import');

      // Insert rows
      const rows = matchResults.map(r => ({
        import_id: importRecord.id,
        raw_data: r.raw_data as any,
        matched_member_id: r.matched_member?.id || null,
        is_owner_row: r.is_owner_row,
        match_confidence: r.match_confidence,
        match_status: r.match_status as any,
        amount: r.amount,
        details: r.row_name,
      }));

      const { error: rowsError } = await supabase.from('commission_import_rows').insert(rows);
      if (rowsError) throw rowsError;

      // Consolidate commissions
      await supabase.rpc('consolidate_import_commissions', { p_import_id: importRecord.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-imports'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      setFlow({ ...flow, step: 'done' });
      toast({ title: 'Import traité avec succès' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const autoMatched = matchResults.filter(r => r.match_status === 'auto').length;
  const manualNeeded = matchResults.filter(r => r.match_status === 'manuel').length;
  const unmatched = matchResults.filter(r => r.match_status === 'non_reconnu').length;

  return (
    <AppLayout
      title="Imports"
      actions={
        <Button onClick={() => { setShowImport(true); setFlow({ ...flow, step: 'upload', rawData: [], matchResults: [] } as any); }} className="bg-[#3b82f6] hover:bg-[#3b82f6]/90">
          <Upload className="h-4 w-4 mr-2" />
          Nouvel import
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Import dialog */}
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                <div>
                  <Label>Période</Label>
                  <Input type="month" value={flow.period} onChange={(e) => setFlow({ ...flow, period: e.target.value })} />
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-3">Glissez un fichier CSV ou Excel, ou cliquez pour sélectionner</p>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="max-w-xs mx-auto" />
                </div>
              </div>
            )}

            {/* Step 2: Column mapping */}
            {flow.step === 'mapping' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">{flow.rawData.length} lignes détectées dans "{flow.fileName}"</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Colonne Nom / Prénom *</Label>
                    <Select value={flow.mapping.name_col} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, name_col: v } })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Colonne Montant *</Label>
                    <Select value={flow.mapping.amount_col} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, amount_col: v } })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Colonne ID / Matricule (optionnel)</Label>
                    <Select value={flow.mapping.id_col} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, id_col: v } })}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucune</SelectItem>
                        {flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Aperçu (3 premières lignes)</p>
                  {flow.rawData.slice(0, 3).map((row, i) => (
                    <div key={i} className="text-xs text-gray-600 mb-1">
                      <span className="font-medium">{row[flow.mapping.name_col] || '—'}</span>
                      {' → '}
                      <span className="text-green-700">{row[flow.mapping.amount_col] || '0'} €</span>
                    </div>
                  ))}
                </div>
                <Button onClick={runMatching} disabled={!flow.mapping.name_col || !flow.mapping.amount_col} className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90">
                  Lancer le matching
                </Button>
              </div>
            )}

            {/* Step 3: Matching results */}
            {flow.step === 'matching' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-700">{autoMatched}</p>
                    <p className="text-xs text-green-600">Auto-matchées</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-amber-700">{manualNeeded}</p>
                    <p className="text-xs text-amber-600">À confirmer</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-red-600">{unmatched}</p>
                    <p className="text-xs text-red-500">Non reconnues</p>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {matchResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${
                      r.match_status === 'auto' ? 'bg-green-50' :
                      r.match_status === 'manuel' ? 'bg-amber-50' :
                      'bg-red-50'
                    }`}>
                      <div>
                        <span className="font-medium text-gray-800">{r.row_name}</span>
                        {r.is_owner_row && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Moi</span>}
                        {r.matched_member && !r.is_owner_row && (
                          <span className="ml-2 text-xs text-gray-500">
                            → {r.matched_member.first_name} {r.matched_member.last_name} ({r.match_confidence}%)
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">{r.amount.toLocaleString('fr-FR')} €</span>
                    </div>
                  ))}
                </div>

                <Button onClick={() => saveImport.mutate()} disabled={saveImport.isPending} className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90">
                  {saveImport.isPending ? 'Traitement...' : 'Valider et consolider'}
                </Button>
              </div>
            )}

            {/* Step 4: Done */}
            {flow.step === 'done' && (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900">Import terminé</p>
                <p className="text-sm text-gray-500 mt-1">Les commissions ont été consolidées dans votre tableau de bord.</p>
                <Button onClick={() => setShowImport(false)} className="mt-4">Fermer</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Import history */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Historique des imports</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Fichier</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Période</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Stats</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imports.map((imp: any) => {
                const stats = imp.stats || {};
                return (
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                      {imp.file_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{imp.period}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${IMPORT_STATUS_COLORS[imp.status as keyof typeof IMPORT_STATUS_COLORS]}`}>
                        {IMPORT_STATUS_LABELS[imp.status as keyof typeof IMPORT_STATUS_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {stats.matched_rows !== undefined && (
                        <span>{stats.matched_rows}/{stats.total_rows} matchées • {(stats.total_amount || 0).toLocaleString('fr-FR')} €</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(imp.uploaded_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                );
              })}
              {imports.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Aucun import</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
