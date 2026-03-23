import { useState, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  FileText, Receipt,
} from 'lucide-react';
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
  const dist = matrix[na.length][nb.length];
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

const TABS = [
  { id: 'imports', label: 'Imports', icon: Upload },
  { id: 'factures', label: 'Factures', icon: Receipt },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Finance() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('imports');
  const [showImport, setShowImport] = useState(false);
  const [invoicePeriod, setInvoicePeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  const [flow, setFlow] = useState<ImportFlowState>({
    step: 'upload', rawData: [], columns: [],
    mapping: { name_col: '', amount_col: '', id_col: '' },
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    fileName: '',
  });
  const [matchResults, setMatchResults] = useState<any[]>([]);

  // ── Imports data ──
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

  // ── Commissions for invoice ──
  const { data: invoiceCommissions = [] } = useQuery({
    queryKey: ['invoice-commissions', user?.id, invoicePeriod],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('commissions')
        .select('*, team_members(first_name, last_name)')
        .eq('user_id', user.id)
        .eq('period', invoicePeriod)
        .eq('status', 'validee')
        .order('type');
      return data || [];
    },
    enabled: !!user && activeTab === 'factures',
  });

  const invoiceTotal = invoiceCommissions.reduce((s: number, c: any) => s + c.amount, 0);
  const invoiceDirecte = invoiceCommissions.filter((c: any) => c.type === 'directe').reduce((s: number, c: any) => s + c.amount, 0);
  const invoiceReseau = invoiceCommissions.filter((c: any) => c.type === 'reseau').reduce((s: number, c: any) => s + c.amount, 0);

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
    // Utilise le nom du profil pour identifier les lignes perso
    const ownerName = profile?.full_name || '';

    const results = rawData.map((row) => {
      const rowName = String(row[mapping.name_col] || '').trim();
      const rowId = String(row[mapping.id_col] || '').trim();
      const amount = parseFloat(String(row[mapping.amount_col] || '0').replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;

      const isOwner = ownerName ? matchScore(ownerName, rowName) >= 80 : false;

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
  }, [flow, teamMembers, profile]);

  // ── Save import ──
  const saveImport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');

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

  // ── Print invoice ──
  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const periodDate = new Date(invoicePeriod + '-01');
    const periodLabel = periodDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const today = new Date().toLocaleDateString('fr-FR');
    const invoiceNumber = `FACT-${invoicePeriod.replace('-', '')}-001`;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture ${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
  .logo { font-size: 28px; font-weight: 800; color: #3b82f6; }
  .logo span { color: #6b7280; font-weight: 400; }
  .invoice-info { text-align: right; }
  .invoice-info h2 { font-size: 20px; color: #3b82f6; margin-bottom: 8px; }
  .invoice-info p { font-size: 13px; color: #6b7280; line-height: 1.6; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .party { flex: 1; }
  .party h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
  .party p { font-size: 14px; line-height: 1.6; }
  .period-badge { display: inline-block; background: #eff6ff; color: #3b82f6; font-size: 14px; font-weight: 600; padding: 8px 16px; border-radius: 8px; margin-bottom: 24px; text-transform: capitalize; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f9fafb; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
  th:last-child { text-align: right; }
  td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  td:last-child { text-align: right; font-weight: 600; }
  .type-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
  .type-directe { background: #dbeafe; color: #2563eb; }
  .type-reseau { background: #fef3c7; color: #d97706; }
  .totals { margin-top: 16px; border-top: 2px solid #e5e7eb; padding-top: 16px; }
  .total-row { display: flex; justify-content: space-between; padding: 6px 16px; font-size: 14px; }
  .total-row.grand { font-size: 20px; font-weight: 800; color: #3b82f6; padding-top: 12px; border-top: 2px solid #3b82f6; margin-top: 8px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">HYLA <span>CRM</span></div>
  <div class="invoice-info">
    <h2>FACTURE</h2>
    <p>N° ${invoiceNumber}<br>Date : ${today}</p>
  </div>
</div>

<div class="parties">
  <div class="party">
    <h4>Émetteur</h4>
    <p><strong>${profile?.full_name || 'Conseiller Hyla'}</strong><br>${user?.email || ''}</p>
  </div>
  <div class="party" style="text-align: right;">
    <h4>Destinataire</h4>
    <p><strong>Hyla International</strong><br>Service Commissions</p>
  </div>
</div>

<div class="period-badge">Période : ${periodLabel}</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Type</th>
      <th>Montant</th>
    </tr>
  </thead>
  <tbody>
    ${invoiceCommissions.map((c: any) => `
    <tr>
      <td>${c.type === 'directe' ? 'Commission vente directe' : `Commission réseau${c.team_members ? ` - ${c.team_members.first_name} ${c.team_members.last_name}` : ''}`}${c.details ? ` (${c.details})` : ''}</td>
      <td><span class="type-badge type-${c.type}">${c.type === 'directe' ? 'Directe' : 'Réseau'}</span></td>
      <td>${c.amount.toLocaleString('fr-FR')} €</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="total-row"><span>Commissions directes</span><span>${invoiceDirecte.toLocaleString('fr-FR')} €</span></div>
  <div class="total-row"><span>Commissions réseau</span><span>${invoiceReseau.toLocaleString('fr-FR')} €</span></div>
  <div class="total-row grand"><span>TOTAL À PERCEVOIR</span><span>${invoiceTotal.toLocaleString('fr-FR')} €</span></div>
</div>

<div class="footer">
  <p>Document généré automatiquement par Hyla CRM le ${today}</p>
  <p>Ce document tient lieu de facture de commissions.</p>
</div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const autoMatched = matchResults.filter(r => r.match_status === 'auto').length;
  const manualNeeded = matchResults.filter(r => r.match_status === 'manuel').length;
  const unmatched = matchResults.filter(r => r.match_status === 'non_reconnu').length;

  return (
    <AppLayout title="Finance">
      <div className="space-y-5">
        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════ TAB: IMPORTS ══════════════ */}
        {activeTab === 'imports' && (
          <>
            <button
              onClick={() => { setShowImport(true); setFlow({ ...flow, step: 'upload', rawData: [] } as any); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3b82f6] text-white font-semibold rounded-xl active:scale-[0.98] transition-transform"
            >
              <Upload className="h-4 w-4" />
              Importer un fichier
            </button>

            {/* Import dialog */}
            <Dialog open={showImport} onOpenChange={setShowImport}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4">
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {flow.step === 'upload' && 'Importer des commissions'}
                    {flow.step === 'mapping' && 'Mapper les colonnes'}
                    {flow.step === 'matching' && 'Résultats du matching'}
                    {flow.step === 'done' && 'Import terminé'}
                  </DialogTitle>
                </DialogHeader>

                {flow.step === 'upload' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs">Période</Label>
                      <Input type="month" value={flow.period} onChange={(e) => setFlow({ ...flow, period: e.target.value })} className="h-11" />
                    </div>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <FileSpreadsheet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 mb-3">CSV ou Excel</p>
                      <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="text-sm" />
                    </div>
                  </div>
                )}

                {flow.step === 'mapping' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">{flow.rawData.length} lignes dans "{flow.fileName}"</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Colonne Nom *</Label>
                        <Select value={flow.mapping.name_col} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, name_col: v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Colonne Montant *</Label>
                        <Select value={flow.mapping.amount_col} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, amount_col: v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Colonne ID (optionnel)</Label>
                        <Select value={flow.mapping.id_col} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, id_col: v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Aucune" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Aucune</SelectItem>
                            {flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 max-h-28 overflow-y-auto">
                      <p className="text-[10px] font-semibold text-gray-400 mb-1.5">Aperçu</p>
                      {flow.rawData.slice(0, 3).map((row, i) => (
                        <div key={i} className="text-xs text-gray-600 mb-0.5">
                          <span className="font-medium">{row[flow.mapping.name_col] || '—'}</span>
                          {' → '}
                          <span className="text-green-700">{row[flow.mapping.amount_col] || '0'} €</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={runMatching}
                      disabled={!flow.mapping.name_col || !flow.mapping.amount_col}
                      className="w-full py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      Lancer le matching
                    </button>
                  </div>
                )}

                {flow.step === 'matching' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-green-700">{autoMatched}</p>
                        <p className="text-[10px] text-green-600">Auto</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                        <p className="text-lg font-bold text-amber-700">{manualNeeded}</p>
                        <p className="text-[10px] text-amber-600">Manuel</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
                        <p className="text-lg font-bold text-red-600">{unmatched}</p>
                        <p className="text-[10px] text-red-500">Inconnu</p>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {matchResults.map((r, i) => (
                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${
                          r.match_status === 'auto' ? 'bg-green-50' :
                          r.match_status === 'manuel' ? 'bg-amber-50' : 'bg-red-50'
                        }`}>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-800 truncate block">{r.row_name}</span>
                            {r.is_owner_row && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Moi</span>}
                            {r.matched_member && !r.is_owner_row && (
                              <span className="text-[10px] text-gray-500">→ {r.matched_member.first_name} {r.matched_member.last_name}</span>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900 ml-2 whitespace-nowrap">{r.amount.toLocaleString('fr-FR')} €</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => saveImport.mutate()}
                      disabled={saveImport.isPending}
                      className="w-full py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      {saveImport.isPending ? 'Traitement...' : 'Valider et consolider'}
                    </button>
                  </div>
                )}

                {flow.step === 'done' && (
                  <div className="text-center py-6">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-base font-semibold text-gray-900">Import terminé</p>
                    <p className="text-xs text-gray-500 mt-1">Les commissions ont été consolidées.</p>
                    <button onClick={() => setShowImport(false)} className="mt-4 px-6 py-2 bg-gray-100 rounded-xl text-sm font-medium">Fermer</button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Import history */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Historique des imports</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {imports.map((imp: any) => (
                  <div key={imp.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">{imp.file_name}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 ml-5.5">
                        {imp.period} • {new Date(imp.uploaded_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className={`shrink-0 ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${IMPORT_STATUS_COLORS[imp.status as keyof typeof IMPORT_STATUS_COLORS]}`}>
                      {IMPORT_STATUS_LABELS[imp.status as keyof typeof IMPORT_STATUS_LABELS]}
                    </span>
                  </div>
                ))}
                {imports.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-gray-400">Aucun import</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════ TAB: FACTURES ══════════════ */}
        {activeTab === 'factures' && (
          <>
            {/* Period selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <Label className="text-xs text-gray-500 mb-1.5 block">Période de facturation</Label>
              <Input
                type="month"
                value={invoicePeriod}
                onChange={(e) => setInvoicePeriod(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Invoice summary */}
            <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-2xl p-5 text-white">
              <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Total à facturer</p>
              <p className="text-3xl font-bold">{invoiceTotal.toLocaleString('fr-FR')} <span className="text-lg opacity-70">€</span></p>
              <div className="flex gap-6 mt-3">
                <div>
                  <p className="text-[10px] uppercase opacity-60">Directes</p>
                  <p className="text-sm font-semibold">{invoiceDirecte.toLocaleString('fr-FR')} €</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-60">Réseau</p>
                  <p className="text-sm font-semibold">{invoiceReseau.toLocaleString('fr-FR')} €</p>
                </div>
              </div>
            </div>

            {/* Commission list for this period */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Détail des commissions</h3>
                <span className="text-xs text-gray-400">{invoiceCommissions.length} lignes</span>
              </div>
              <div className="divide-y divide-gray-100">
                {invoiceCommissions.map((c: any) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.type === 'directe' ? 'Vente directe' : `Réseau${c.team_members ? ` - ${c.team_members.first_name} ${c.team_members.last_name}` : ''}`}
                      </p>
                      <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        c.type === 'directe' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {c.type === 'directe' ? 'Directe' : 'Réseau'}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 ml-2">{c.amount.toLocaleString('fr-FR')} €</span>
                  </div>
                ))}
                {invoiceCommissions.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Aucune commission validée pour cette période</p>
                  </div>
                )}
              </div>
            </div>

            {/* Generate invoice button */}
            {invoiceCommissions.length > 0 && (
              <button
                onClick={printInvoice}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white font-semibold rounded-xl active:scale-[0.98] transition-transform"
              >
                <FileText className="h-4 w-4" />
                Générer la facture PDF
              </button>
            )}
          </>
        )}

      </div>
    </AppLayout>
  );
}
