import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { PaywallScreen } from '@/components/PaywallScreen';
import { supabase, IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS, getRecrueCommission, getPersonalSaleCommission } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, CalendarRange, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SkeletonTable } from '@/components/ui/skeleton-card';
import * as XLSX from 'xlsx';

// ── CSV line parser (handles quoted fields with commas inside) ──
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === '\u201c' || ch === '\u201d') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── TRV Hyla CSV parser ──
function parseTRVCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  const rows: Record<string, string>[] = [];
  for (const line of lines) {
    const cells = parseCSVLine(line);
    if (cells.length < 4) continue;
    // Col 1: row number
    const rawNum = (cells[1] || '').replace(/[´`'\u2019\u0060]/g, '').trim();
    if (!/^\d+$/.test(rawNum)) continue;
    // Col 2: VENDEUR — strip * prefix
    const rawVendeur = (cells[2] || '').replace(/^\*+\s*/, '').trim();
    if (!rawVendeur || rawVendeur.length < 3) continue;
    // Col 3: date DD/MM/YYYY
    const rawDate = (cells[3] || '').trim();
    const dm = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dm) continue;
    const [, day, month, year] = dm;
    const period = `${year}-${month}`;
    const soldAt = `${year}-${month}-${day}`; // date ISO de la vente
    // Reconstruct vendeur: NOM PRÉNOM → PRÉNOM NOM
    const parts = rawVendeur.split(/\s+/);
    const prenom = parts.slice(1).join(' ');
    const nom = parts[0];
    const vendeurNorm = prenom ? `${prenom} ${nom}` : nom;
    // Col 15: prix de vente (montant client)
    const prixRaw = (cells[15] || '').replace(/["\u201c\u201d]/g, '').trim();
    const montant = prixRaw.replace(',', '.').replace(/[^\d.]/g, '');
    rows.push({
      VENDEUR: vendeurNorm,
      VENDEUR_ORIGINAL: rawVendeur,
      MONTANT: montant || '0',    // prix de vente (ce que le client paie)
      PÉRIODE: period,
      DATE: soldAt,               // date ISO de la vente
      CLIENT: (cells[4] || '').trim(),
      TÉLÉPHONE: (cells[8] || '').replace(/\s/g, '').trim(),
      EMAIL: (cells[9] || '').trim().toLowerCase(),
      ADRESSE: (cells[5] || '').trim(),
      CP: (cells[6] || '').trim(),
      VILLE: (cells[7] || '').trim(),
      PACK: (cells[13] || '').trim(),
      FINANCEMENT: (cells[16] || '').trim(),
      N_DOSSIER: (cells[18] || '').trim(),
    });
  }
  return rows;
}

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

  // ── TRV import state ──
  const [showTRVImport, setShowTRVImport] = useState(false);
  const [trvStep, setTrvStep] = useState<'upload' | 'processing' | 'done'>('upload');
  const [trvFileName, setTrvFileName] = useState('');
  const [trvResults, setTrvResults] = useState<MatchRow[]>([]);
  const [trvImportStats, setTrvImportStats] = useState<{ contactsCreated: number; dealsCreated: number; transitions: string[] }>({ contactsCreated: 0, dealsCreated: 0, transitions: [] });

  const { data: imports = [], isLoading: importsLoading } = useQuery({
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

  // ── TRV matching ──
  const computeTRVMatching = useCallback((rawData: Record<string, string>[]): MatchRow[] => {
    const ownerNames = settings?.owner_matching_names || [];

    // Taux Hyla — commission recrue directe selon le niveau de l'utilisateur
    const TAUX_RECRUE_DIRECTE = getRecrueCommission(settings?.hyla_level || 'manager');
    // Taux personnels (ventes propres) : échelle glissante mensuelle via helper centralisé
    const tauxPersonnel = (nieme: number) => getPersonalSaleCommission(nieme);

    let ownerSaleCount = 0; // compteur pour l'échelle glissante des ventes perso

    return rawData.map((row) => {
      const rowName = row['VENDEUR'] || '';
      const period = row['PÉRIODE'] || '';
      const isOwner = ownerNames.some((n: string) => matchScore(n, rowName) >= 85);

      let bestMatch: { member: any; confidence: number } | null = null;
      for (const member of teamMembers) {
        const fullName = `${member.first_name} ${member.last_name}`;
        const names = [fullName, ...(member.matching_names || [])];
        for (const name of names) {
          const score = matchScore(name, rowName);
          if (score > (bestMatch?.confidence || 0)) bestMatch = { member, confidence: score };
        }
      }

      const matchStatus: 'auto' | 'manuel' | 'non_reconnu' = isOwner ? 'auto' :
        (bestMatch?.confidence || 0) >= 85 ? 'auto' :
        (bestMatch?.confidence || 0) >= 60 ? 'manuel' : 'non_reconnu';

      let commission = 0;
      if (isOwner) {
        ownerSaleCount++;
        commission = tauxPersonnel(ownerSaleCount); // 300→500€ selon le rang mensuel
      } else if (matchStatus !== 'non_reconnu') {
        commission = TAUX_RECRUE_DIRECTE; // 120€ par vente d'une recrue directe
      }

      return {
        raw_data: row,
        row_name: rowName,
        amount: commission, // montant commission (pas prix de vente)
        period,
        is_owner_row: isOwner,
        matched_member: bestMatch && bestMatch.confidence >= 60 ? bestMatch.member : null,
        match_confidence: bestMatch?.confidence || 0,
        match_status: matchStatus,
      };
    });
  }, [teamMembers, settings]);

  // ── TRV file upload handler — parse + match + save automatiquement ──
  const handleTRVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrvFileName(file.name);
    setTrvStep('processing');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const rows = parseTRVCsv(text);
        if (rows.length === 0) {
          toast({ title: 'Aucune ligne valide trouvée dans ce fichier', variant: 'destructive' });
          setTrvStep('upload');
          return;
        }
        const results = computeTRVMatching(rows);
        setTrvResults(results);
        saveTRVImport.mutate(results);
      } catch {
        toast({ title: 'Erreur de lecture du fichier TRV', variant: 'destructive' });
        setTrvStep('upload');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, [computeTRVMatching, saveTRVImport, toast]);

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

  // ── Save TRV import ──
  const saveTRVImport = useMutation({
    mutationFn: async (results: MatchRow[]) => {
      if (!user) throw new Error('Non connecté');

      // On ne garde que les lignes qui concernent ce manager ou son équipe
      // Les "non_reconnu" (autres managers du fichier national) sont complètement ignorées
      const relevant = results.filter(r => r.is_owner_row || r.match_status !== 'non_reconnu');
      if (relevant.length === 0) {
        throw new Error('Aucune vente trouvée pour votre équipe dans ce fichier TRV.');
      }

      const byPeriod = relevant.reduce((acc, r) => {
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
            file_name: periods.length > 1 ? `${trvFileName} — ${p}` : trvFileName,
            period: p,
            column_mapping: { source: 'TRV_HYLA' } as any,
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

      // ── Étape 2 : Contacts + Deals ──────────────────────────────────────────
      // Pré-charger la 1ère étape pipeline du manager
      const { data: managerStages } = await supabase
        .from('pipeline_stages').select('id').eq('user_id', user.id)
        .order('position').limit(1);
      const managerStageId = managerStages?.[0]?.id || null;

      // Pré-charger les 1ères étapes des membres liés (avec compte CRM)
      const linkedIds = [...new Set(
        relevant.filter(r => r.matched_member?.linked_user_id).map(r => r.matched_member.linked_user_id as string)
      )];
      const memberStageMap: Record<string, string | null> = {};
      for (const uid of linkedIds) {
        const { data: st } = await supabase
          .from('pipeline_stages').select('id').eq('user_id', uid)
          .order('position').limit(1);
        memberStageMap[uid] = st?.[0]?.id || null;
      }

      let contactsCreated = 0;
      let dealsCreated = 0;

      for (const row of relevant) {
        const r = row.raw_data;

        // ── Détermine le propriétaire du contact/deal ──
        const targetUserId: string = row.is_owner_row
          ? user.id
          : (row.matched_member?.linked_user_id || user.id);
        const soldBy: string | null = (!row.is_owner_row && !row.matched_member?.linked_user_id)
          ? (row.matched_member?.id || null)
          : null;
        const stageId = targetUserId === user.id
          ? managerStageId
          : (memberStageMap[targetUserId] || null);

        // ── Parse client (format NOM PRÉNOM → PRÉNOM NOM) ──
        const clientRaw = (r['CLIENT'] || '').trim();
        if (!clientRaw) continue;
        const cParts = clientRaw.split(/\s+/);
        const clientLastName = cParts[0] || '';
        const clientFirstName = cParts.slice(1).join(' ') || clientLastName;
        const finalFirstName = cParts.length > 1 ? clientFirstName : clientLastName;
        const finalLastName = cParts.length > 1 ? clientLastName : '';

        const clientPhone = r['TÉLÉPHONE'] || null;
        const clientEmail = r['EMAIL'] || null;
        const clientAddress = [r['ADRESSE'], r['CP'], r['VILLE']].filter(Boolean).join(', ') || null;

        // ── Trouve ou crée le contact ──
        let contactId: string | null = null;
        let found = false;

        if (clientEmail) {
          const { data: c } = await supabase.from('contacts').select('id, status')
            .eq('user_id', targetUserId).ilike('email', clientEmail).maybeSingle();
          if (c) { contactId = c.id; found = true;
            if (c.status === 'prospect') await supabase.from('contacts').update({ status: 'cliente' }).eq('id', c.id);
          }
        }
        if (!contactId && clientPhone) {
          const { data: c } = await supabase.from('contacts').select('id, status')
            .eq('user_id', targetUserId).eq('phone', clientPhone).maybeSingle();
          if (c) { contactId = c.id; found = true;
            if (c.status === 'prospect') await supabase.from('contacts').update({ status: 'cliente' }).eq('id', c.id);
          }
        }
        if (!contactId) {
          const { data: c } = await supabase.from('contacts').insert({
            user_id: targetUserId,
            first_name: finalFirstName,
            last_name: finalLastName,
            phone: clientPhone,
            email: clientEmail,
            address: clientAddress,
            status: 'cliente' as any,
            source: 'Import TRV',
            pipeline_stage_id: stageId,
          }).select('id').single();
          if (c) { contactId = c.id; if (!found) contactsCreated++; }
        }

        if (!contactId) continue;

        // ── Parse financement ──
        const fin = r['FINANCEMENT'] || '';
        const isMensualites = /alma|sofinco|floa|cofidis/i.test(fin);
        const paymentType = isMensualites ? 'mensualites' : 'comptant';
        const monthMatch = fin.match(/(\d{2,})\s*[xXmM]/);
        const paymentMonths = isMensualites && monthMatch ? parseInt(monthMatch[1]) : null;

        // ── Parse montant vente ──
        const saleAmount = parseFloat((r['MONTANT'] || '0').replace(',', '.')) || 0;
        const soldAt = r['DATE'] || null;
        const pack = r['PACK'] || 'Hyla';
        const nDossier = r['N_DOSSIER'] || '';

        // ── Anti-doublon : même contact + même montant + même date ──
        const { data: existing } = await supabase.from('deals').select('id')
          .eq('user_id', targetUserId).eq('contact_id', contactId)
          .eq('amount', saleAmount).eq('status', 'signee')
          .maybeSingle();
        if (existing) continue;

        // ── Crée le deal ──
        const { error: dealErr } = await supabase.from('deals').insert({
          user_id: targetUserId,
          contact_id: contactId,
          amount: saleAmount,
          status: 'signee' as any,
          product: pack,
          sold_at: soldAt,
          payment_type: paymentType as any,
          payment_months: paymentMonths,
          sold_by: soldBy,
          notes: [nDossier ? `N° dossier : ${nDossier}` : '', fin ? `Financement : ${fin}` : '']
            .filter(Boolean).join(' | ') || null,
        });
        if (!dealErr) dealsCreated++;
      }

      // ── Étape 3 : Détection transitions Cliente → Vendeuse ───────────────
      // Tous les noms VENDEUR du TRV (y compris hors équipe) comparés aux contacts
      const transitions: string[] = [];

      const uniqueVendeurs: Map<string, string> = new Map();
      for (const r of results) {
        if (!r.row_name) continue;
        const key = normalizeStr(r.row_name);
        if (!uniqueVendeurs.has(key)) uniqueVendeurs.set(key, r.raw_data['VENDEUR_ORIGINAL'] || r.row_name);
      }

      // Charger les contacts prospect/cliente du manager (candidats à la transition)
      const { data: candidateContacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, status')
        .eq('user_id', user.id)
        .in('status', ['prospect', 'cliente']);

      if (candidateContacts && candidateContacts.length > 0) {
        for (const [normV] of uniqueVendeurs) {
          for (const contact of candidateContacts) {
            const cNorm = normalizeStr(`${contact.first_name} ${contact.last_name}`);
            if (matchScore(normV, cNorm) >= 85) {
              await supabase.from('contacts')
                .update({ status: 'recrue' })
                .eq('id', contact.id);
              transitions.push(`${contact.first_name} ${contact.last_name}`);
              break;
            }
          }
        }
      }

      return { contactsCreated, dealsCreated, transitions };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['commission-imports'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['stats-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setTrvImportStats(data || { contactsCreated: 0, dealsCreated: 0, transitions: [] });
      setTrvStep('done');
    },
    onError: (e: Error) => toast({ title: 'Erreur import TRV', description: e.message, variant: 'destructive' }),
  });

  const autoMatched = matchResults.filter(r => r.match_status === 'auto').length;
  const manualNeeded = matchResults.filter(r => r.match_status === 'manuel').length;
  const unmatched = matchResults.filter(r => r.match_status === 'non_reconnu').length;

  // TRV stats
  const trvDirectes = trvResults.filter(r => r.is_owner_row).length;
  const trvReseau = trvResults.filter(r => !r.is_owner_row && r.match_status !== 'non_reconnu').length;
  const trvIgnorees = trvResults.filter(r => r.match_status === 'non_reconnu').length;
  const trvAutoMatched = trvResults.filter(r => r.match_status === 'auto').length;
  const trvManualNeeded = trvResults.filter(r => r.match_status === 'manuel').length;
  const trvUnmatched = trvResults.filter(r => r.match_status === 'non_reconnu').length;
  const trvTotalCom = trvResults.filter(r => r.match_status !== 'non_reconnu').reduce((s, r) => s + r.amount, 0);
  const trvDetectedPeriods = [...new Set(trvResults.map(r => r.period).filter(Boolean))].sort();

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

  const { canAccess, isTrial, trialDaysLeft } = usePlan();

  if (!canAccess.finance) {
    return (
      <AppLayout title="Imports">
        <PaywallScreen feature="finance" isTrial={isTrial} trialDaysLeft={trialDaysLeft} />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Imports"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setTrvStep('upload'); setTrvResults([]); setTrvFileName(''); setShowTRVImport(true); }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            TRV Hyla
          </Button>
          <Button onClick={() => { resetFlow(); setShowImport(true); }} className="bg-[#3b82f6] hover:bg-[#3b82f6]/90">
            <Upload className="h-4 w-4 mr-2" />
            Nouvel import
          </Button>
        </div>
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2.5 text-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
                    <p className="text-base font-bold text-green-700 dark:text-green-400">{autoMatched}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-500">Auto-matchées</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5 text-center">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                    <p className="text-base font-bold text-amber-700 dark:text-amber-400">{manualNeeded}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">À confirmer</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5 text-center">
                    <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
                    <p className="text-base font-bold text-red-600 dark:text-red-400">{unmatched}</p>
                    <p className="text-[10px] text-red-500 dark:text-red-400">Non reconnues</p>
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

        {/* TRV Import dialog */}
        <Dialog open={showTRVImport} onOpenChange={(open) => { if (!open && trvStep !== 'processing') setShowTRVImport(false); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {trvStep === 'upload' && 'Importer un TRV Hyla'}
                {trvStep === 'processing' && 'Import en cours…'}
                {trvStep === 'done' && 'Import TRV terminé'}
              </DialogTitle>
            </DialogHeader>

            {/* Étape 1 : sélection du fichier */}
            {trvStep === 'upload' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
                  Sélectionnez le fichier CSV TRV Hyla. L'import se fait <strong>automatiquement</strong> — noms vendeurs (NOM PRÉNOM) reconnus et associés à vos membres d'équipe.
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Fichier TRV Hyla (.csv)</p>
                  <Input type="file" accept=".csv" onChange={handleTRVUpload} className="max-w-xs mx-auto" />
                </div>
              </div>
            )}

            {/* Étape 2 : traitement automatique */}
            {trvStep === 'processing' && (
              <div className="text-center py-10 space-y-4">
                <div className="h-12 w-12 rounded-full border-4 border-[#3b82f6] border-t-transparent animate-spin mx-auto" />
                <p className="text-sm font-medium text-foreground">Analyse et import de {trvFileName}…</p>
                <p className="text-xs text-muted-foreground">Matching des vendeurs en cours</p>
              </div>
            )}

            {/* Étape 3 : résumé */}
            {trvStep === 'done' && (
              <div className="space-y-5 py-2">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-foreground">Import terminé !</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Commissions générées : <span className="font-bold text-foreground">{trvTotalCom.toLocaleString('fr-FR')} €</span>
                  </p>
                </div>

                {/* Stats commissions */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 text-center">
                    <p className="text-base font-bold text-blue-700 dark:text-blue-400">{trvDirectes}</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-500">Ventes perso</p>
                    <p className="text-[9px] text-blue-400 mt-0.5">300→500 €</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2.5 text-center">
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{trvReseau}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500">Ventes équipe</p>
                    <p className="text-[9px] text-emerald-400 mt-0.5">120 € / vente</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2.5 text-center">
                    <p className="text-base font-bold text-muted-foreground">{trvIgnorees}</p>
                    <p className="text-[10px] text-muted-foreground">Ignorées</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">autres managers</p>
                  </div>
                </div>

                {/* Stats contacts + deals */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-violet-700 dark:text-violet-400">{trvImportStats.contactsCreated}</p>
                    <p className="text-xs text-violet-600 dark:text-violet-500">Contacts créés</p>
                    <p className="text-[10px] text-violet-400 mt-0.5">statut Cliente</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{trvImportStats.dealsCreated}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">Ventes créées</p>
                    <p className="text-[10px] text-amber-400 mt-0.5">signées + financement</p>
                  </div>
                </div>

                {/* Transitions cliente → vendeuse */}
                {trvImportStats.transitions.length > 0 && (
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 p-3">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
                      🎯 {trvImportStats.transitions.length} cliente{trvImportStats.transitions.length > 1 ? 's' : ''} devenue{trvImportStats.transitions.length > 1 ? 's' : ''} vendeuse{trvImportStats.transitions.length > 1 ? 's' : ''} !
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {trvImportStats.transitions.map((name, i) => (
                        <span key={i} className="text-[11px] bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200 px-2 py-0.5 rounded-full font-medium">{name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matching quality */}
                {(trvManualNeeded > 0 || trvUnmatched > 0) && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    {trvManualNeeded > 0 && <p>⚠ {trvManualNeeded} vendeur{trvManualNeeded > 1 ? 's' : ''} reconnu{trvManualNeeded > 1 ? 's' : ''} avec faible confiance — vérifiez les noms dans votre équipe.</p>}
                    {trvAutoMatched > 0 && <p>✓ {trvAutoMatched} vendeur{trvAutoMatched > 1 ? 's' : ''} reconnu{trvAutoMatched > 1 ? 's' : ''} automatiquement.</p>}
                  </div>
                )}

                {/* Périodes détectées */}
                {trvDetectedPeriods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {trvDetectedPeriods.map(p => (
                      <span key={p} className="text-[11px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">
                        {p} — {trvResults.filter(r => r.period === p && r.match_status !== 'non_reconnu').length} ventes
                      </span>
                    ))}
                  </div>
                )}

                <Button onClick={() => setShowTRVImport(false)} className="w-full">Fermer</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Import history */}
        {importsLoading ? (
          <SkeletonTable rows={3} />
        ) : (
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
        )}
      </div>
    </AppLayout>
  );
}
