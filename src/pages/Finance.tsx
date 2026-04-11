import { useState, useCallback, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId, useEffectiveProfile } from '@/hooks/useEffectiveUser';
import { supabase, IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS, getPersonalSaleCommission, getRecrueCommission } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Trash2,
  FileText, Receipt, ChevronRight, RefreshCw, Network,
} from 'lucide-react';
import { BulkImportDialog } from '@/components/BulkImportDialog';
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

// Parse amounts correctly for both French (1.234,56) and English (1,234.56) formats
function parseAmount(raw: string): number {
  const s = String(raw || '0').trim();
  // Keep only digits, dots, commas, minus
  const cleaned = s.replace(/[^\d.,\-]/g, '');
  if (!cleaned || cleaned === '-') return 0;

  const dotIdx = cleaned.lastIndexOf('.');
  const commaIdx = cleaned.lastIndexOf(',');

  if (commaIdx > dotIdx) {
    // Comma is the decimal separator → French format: 1.234,56 or 1234,56
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  } else if (dotIdx > commaIdx) {
    // Dot is the decimal separator → English format: 1,234.56 or 1234.56
    return parseFloat(cleaned.replace(/,/g, '')) || 0;
  } else {
    // No thousands separator, just convert comma → dot
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
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
  mapping: { name_col: string; firstname_col: string; amount_col: string; id_col: string };
  period: string;
  fileName: string;
}

const TABS = [
  { id: 'imports', label: 'Imports', icon: Upload },
  { id: 'factures', label: 'Factures', icon: Receipt },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Finance() {
  const { user, profile: authProfile } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { profile } = useEffectiveProfile(); // profil du compte visualisé (impersonation-aware)
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('imports');
  const [showImport, setShowImport] = useState(false);
  const [showOutOfTeam, setShowOutOfTeam] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [invoicePeriod, setInvoicePeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [flow, setFlow] = useState<ImportFlowState>({
    step: 'upload', rawData: [], columns: [],
    mapping: { name_col: '', firstname_col: '', amount_col: '', id_col: '' },
    period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    fileName: '',
  });
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [correctionOpen, setCorrectionOpen] = useState<Set<number>>(new Set());
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // ── User settings (saved column mappings) ──
  const { data: settings } = useQuery({
    queryKey: ['user-settings', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', effectiveId).maybeSingle();
      return data;
    },
    enabled: !!effectiveId,
  });

  // ── Imports data ──
  const { data: imports = [] } = useQuery({
    queryKey: ['commission-imports', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('commission_imports')
        .select('*')
        .eq('user_id', effectiveId)
        .order('uploaded_at', { ascending: false });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-import', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.from('team_members').select('*').eq('user_id', effectiveId);
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // Fetch full team tree via single recursive SQL query (replaces N+1 loop)
  const { data: allTreeMembers = [], isSuccess: treeMembersLoaded } = useQuery({
    queryKey: ['team-tree-members', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase.rpc('get_team_tree', { p_user_id: effectiveId });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // ── Commissions for invoice ──
  const { data: invoiceCommissions = [] } = useQuery({
    queryKey: ['invoice-commissions', effectiveId, invoicePeriod],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('commissions')
        .select('*, team_members(first_name, last_name)')
        .eq('user_id', effectiveId)
        .eq('period', invoicePeriod)
        .eq('status', 'validee')
        .order('type');
      return data || [];
    },
    enabled: !!effectiveId && activeTab === 'factures',
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
        const rawBytes = new Uint8Array(evt.target?.result as ArrayBuffer);
        // UTF-8 via TextDecoder (plus fiable que codepage XLSX pour les CSV français)
        const csvText = new TextDecoder('utf-8').decode(rawBytes);
        const workbook = XLSX.read(csvText, { type: 'string' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // ── Trouver la vraie ligne d'en-tête (contient VENDEUR ou NOM DU CLIENT) ──
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const rowStr = (rawRows[i] as string[]).join('|').toUpperCase();
          if (rowStr.includes('VENDEUR') || rowStr.includes('NOM DU CLIENT') || rowStr.includes('PRIX DE VENTE')) {
            headerRowIdx = i;
            break;
          }
        }

        // Parse depuis la vraie ligne d'en-tête
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: '',
          range: headerRowIdx,
        });

        // Filtrer les lignes vides (sans vendeur ni montant)
        const filteredJson = json.filter(row => {
          const vals = Object.values(row);
          return vals.some(v => String(v).trim().length > 2);
        });

        if (filteredJson.length === 0) {
          toast({ title: 'Fichier vide ou format non reconnu', variant: 'destructive' });
          return;
        }

        const columns = Object.keys(filteredJson[0]);

        // ── Auto-détection format TRV Hyla ──
        const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isTRV = columns.some(c => /vendeur/i.test(c)) && columns.some(c => /client|nom.du/i.test(c));

        let nameCol = '';
        let firstnameCol = '';
        let amountCol = '';
        let idCol = '';

        if (isTRV) {
          nameCol    = columns.find(c => /vendeur/i.test(c.trim())) || '';
          idCol      = columns.find(c => /n°.dossier|n.*dossier|hyla/i.test(c.trim())) || '';
          // Détection du montant par contenu (pas par nom de colonne) car TRV a un décalage
          // entre la position du header "PRIX DE VENTE" et la position réelle des données.
          // On cherche la colonne dont les valeurs tombent dans la plage prix Hyla (500–8000€).
          const sampleRows = filteredJson.slice(0, 20);
          amountCol = columns.find(col => {
            const nonEmpty = sampleRows.map(r => r[col]).filter(v => String(v).trim().length > 0);
            if (nonEmpty.length < 2) return false;
            const priceCount = nonEmpty.filter(v => {
              const p = parseAmount(String(v));
              return p >= 500 && p <= 9000;
            }).length;
            return priceCount / nonEmpty.length > 0.3;
          }) || columns.find(c => /prix.de.vente|montant/i.test(c.trim())) || '';
        } else {
          nameCol      = columns.find(c => /^nom$|name|conseiller|vendeur/i.test(c)) || '';
          firstnameCol = columns.find(c => /prénom|prenom|firstname|first.?name/i.test(c)) || '';
          idCol        = columns.find(c => /id.?hyla|hyla.?id|matricule|code.?hyla|^id$/i.test(c)) || '';
          const MONTHS_FR = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
          const periodMonth = parseInt(flow.period.split('-')[1]) - 1;
          const periodYear = flow.period.split('-')[0];
          const monthName = MONTHS_FR[periodMonth] || '';
          const amountCols = columns.filter(c => /montant|amount|com\b|comm|commission|total/i.test(c));
          amountCol = amountCols.find(c => {
            const lower = norm(c);
            return monthName && lower.includes(monthName) && lower.includes(periodYear);
          }) || amountCols.find(c => { const lower = norm(c); return monthName && lower.includes(monthName); }) || amountCols[0] || '';
        }

        const mapping = { name_col: nameCol, firstname_col: firstnameCol, amount_col: amountCol, id_col: idCol };

        // Check saved mapping profiles
        const columnsKey = [...columns].sort().join(',');
        const savedProfiles = settings?.column_mappings as any;
        const savedProfile = savedProfiles?.profiles?.find((p: any) => p.columns_key === columnsKey);
        const finalMapping = savedProfile
          ? { ...savedProfile.mapping, amount_col: amountCol || savedProfile.mapping.amount_col }
          : mapping;

        // TRV reconnu ou mapping sauvegardé → skip mapping, aller direct au matching
        if (isTRV || savedProfile) {
          setFlow({ step: 'matching', rawData: filteredJson, columns, mapping: finalMapping, period: flow.period, fileName: file.name });
        } else {
          setFlow({ step: 'mapping', rawData: filteredJson, columns, mapping: finalMapping, period: flow.period, fileName: file.name });
        }
      } catch {
        toast({ title: 'Erreur de lecture du fichier', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [flow.period, toast]);

  // ── Run matching ──
  const runMatching = useCallback(() => {
    const { rawData, mapping } = flow;
    // Utilise le nom du profil pour identifier les lignes perso
    const ownerName = profile?.full_name || '';
    const myLevel = (settings as any)?.hyla_level || 'manager';
    // Compteur de rang pour les ventes perso (barème glissant)
    let ownerRank = 0;

    const results = rawData.map((row) => {
      const firstName = mapping.firstname_col ? String(row[mapping.firstname_col] || '').trim() : '';
      const lastName = String(row[mapping.name_col] || '').trim();
      const rowName = firstName ? `${firstName} ${lastName}` : lastName;
      const rowId = String(row[mapping.id_col] || '').trim();

      // Détection owner robuste : gère "NOM Prénom" vs "Prénom NOM" (format CSV Hyla)
      const isOwner = ownerName ? (() => {
        if (matchScore(ownerName, rowName) >= 75) return true;
        // Essai nom inversé
        const reversed = ownerName.split(' ').reverse().join(' ');
        if (matchScore(reversed, rowName) >= 75) return true;
        // Essai par intersection de mots : tous les mots du profil présents dans la ligne
        const ownerWords = normalizeStr(ownerName).split(/\s+/).filter(w => w.length > 1);
        const rowWords = normalizeStr(rowName).split(/\s+/);
        if (ownerWords.length >= 2 && ownerWords.every(w => rowWords.some(rw => rw === w || rw.startsWith(w) || w.startsWith(rw)))) return true;
        return false;
      })() : false;

      let bestMatch: { member: any; confidence: number } | null = null;

      // 1. Check saved name associations first
      const savedAssocs = ((settings?.column_mappings as any)?.name_associations || {}) as Record<string, string>;
      const normalizedRowName = normalizeStr(rowName);
      if (savedAssocs[normalizedRowName]) {
        const assocMember = allTreeMembers.find((m: any) => m.id === savedAssocs[normalizedRowName]);
        if (assocMember) bestMatch = { member: assocMember, confidence: 100 };
      }

      // 2. Match by ID Hyla (highest priority)
      if (!bestMatch) {
        for (const member of allTreeMembers) {
          if (rowId && member.internal_id && normalizeStr(rowId) === normalizeStr(member.internal_id)) {
            bestMatch = { member, confidence: 100 };
            break;
          }
        }
      }

      // 3. Fuzzy name matching
      if (!bestMatch) {
        for (const member of allTreeMembers) {
          const fullName = `${member.first_name} ${member.last_name}`;
          // Also try reversed order (NOM Prénom) — TRV often has last name first
          const reversedName = `${member.last_name} ${member.first_name}`;
          const names = [fullName, reversedName, ...(member.matching_names || [])];
          for (const name of names) {
            const score = matchScore(name, rowName);
            if (score > (bestMatch?.confidence || 0)) {
              bestMatch = { member, confidence: score };
            }
          }
        }
      }

      const matchedMember = bestMatch?.confidence && bestMatch.confidence >= 60 ? bestMatch.member : null;
      const matchStatus = isOwner ? 'auto' as const :
        (bestMatch?.confidence || 0) >= 85 ? 'auto' as const :
        (bestMatch?.confidence || 0) >= 60 ? 'manuel' as const :
        'non_reconnu' as const;

      // Commission calculée sur le barème Hyla (pas le prix machine du CSV)
      let commissionAmount: number;
      if (isOwner) {
        ownerRank++;
        commissionAmount = getPersonalSaleCommission(ownerRank);
      } else if (matchedMember) {
        commissionAmount = getRecrueCommission(myLevel);
      } else {
        commissionAmount = 0; // non_reconnu : pas de commission tant que non associé
      }

      return {
        raw_data: row,
        row_name: rowName,
        amount: commissionAmount,
        is_owner_row: isOwner,
        matched_member: matchedMember,
        match_confidence: bestMatch?.confidence || 0,
        match_status: matchStatus,
      };
    });

    setMatchResults(results);
    setCorrectionOpen(new Set());
    setFlow({ ...flow, step: 'matching' });
  }, [flow, allTreeMembers, profile, settings]);

  // Auto-déclenche le matching quand on saute l'étape mapping (TRV reconnu / mapping sauvegardé)
  // Attend que allTreeMembers soit chargé (isSuccess) pour éviter un matching avec équipe vide
  useEffect(() => {
    if (flow.step === 'matching' && flow.rawData.length > 0 && matchResults.length === 0 && treeMembersLoaded) {
      runMatching();
    }
  }, [flow.step, flow.rawData.length, treeMembersLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save import ──
  const handleValidate = async (forceReplace = false) => {
    if (!user) return;
    if (!forceReplace) {
      setCheckingDuplicate(true);
      const { data: existing } = await supabase
        .from('commission_imports')
        .select('id')
        .eq('user_id', effectiveId)
        .eq('period', flow.period);
      setCheckingDuplicate(false);
      if (existing && existing.length > 0) {
        setDuplicateWarning(true);
        return;
      }
    }
    setDuplicateWarning(false);
    saveImport.mutate(forceReplace);
  };

  const saveImport = useMutation({
    mutationFn: async (forceReplace: boolean) => {
      if (!user) throw new Error('Non connecté');

      // Si remplacement : supprimer l'import précédent + toutes ses commissions
      if (forceReplace) {
        const { data: oldImports } = await supabase
          .from('commission_imports')
          .select('id')
          .eq('user_id', effectiveId)
          .eq('period', flow.period);

        if (oldImports?.length) {
          const oldIds = oldImports.map(i => i.id);
          // Supprimer commissions manager
          await supabase.from('commissions')
            .delete()
            .eq('user_id', effectiveId)
            .eq('period', flow.period)
            .eq('source', 'import');
          // Supprimer commissions cascadées aux membres liés
          const linkedIds = allTreeMembers
            .filter((m: any) => m.linked_user_id)
            .map((m: any) => m.linked_user_id as string);
          for (const linkedId of linkedIds) {
            await supabase.from('commissions')
              .delete()
              .eq('user_id', linkedId)
              .eq('period', flow.period)
              .eq('source', 'import');
          }
          // Supprimer lignes et imports
          await supabase.from('commission_import_rows').delete().in('import_id', oldIds);
          await supabase.from('commission_imports').delete().in('id', oldIds);
        }
      }

      const { data: importRecord, error: importError } = await supabase
        .from('commission_imports')
        .insert({
          user_id: effectiveId,   // ← impersonation-aware
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

      const { error: rpcError } = await supabase.rpc('consolidate_import_commissions', { p_import_id: importRecord.id });
      if (rpcError) throw rpcError;

      // ── Cascade MLM: create commissions in linked members' own spaces ──
      // For each matched member WITH a linked_user_id (= they have their own Hyla account),
      // create a "directe" commission in their personal space so they can see their own earnings.
      const cascadeCommissions: any[] = [];

      for (const r of matchResults) {
        if (!r.matched_member || r.is_owner_row || r.match_status === 'non_reconnu') continue;

        const member = r.matched_member;
        const linkedUserId = member.linked_user_id;

        // Only cascade if this member has a real Hyla account
        if (linkedUserId && linkedUserId !== user.id) {
          cascadeCommissions.push({
            user_id: linkedUserId,
            type: 'directe',
            amount: r.amount,
            period: flow.period,
            status: 'validee',
            source: 'import',
            team_member_id: null, // It's THEIR OWN commission, not from a sub-member
            notes: `Import réseau par ${profile?.full_name || 'manager'}`,
          });
        }

        // Si ce membre est lui-même manager avec une sous-équipe (à n'importe quelle profondeur),
        // on lui cascade les commissions réseau de ses sous-membres
        if (linkedUserId && linkedUserId !== user.id) {
          const subMemberResults = matchResults.filter(
            sr => sr.matched_member?.owner_user_id === linkedUserId
              && sr.matched_member?.id !== member.id
              && !sr.is_owner_row
              && sr.match_status !== 'non_reconnu'
          );
          for (const sr of subMemberResults) {
            cascadeCommissions.push({
              user_id: linkedUserId,
              type: 'reseau',
              amount: sr.amount,
              period: flow.period,
              status: 'validee',
              source: 'import',
              team_member_id: sr.matched_member.id,
              notes: `Commission réseau via ${sr.row_name}`,
            });
          }
        }
      }

      if (cascadeCommissions.length > 0) {
        await supabase.from('commissions').insert(cascadeCommissions);
      }

      // ── Création automatique des contacts clients ──
      try {
        const normCol = (s: unknown) => normalizeStr(String(s ?? '')).replace(/[^a-z0-9]/g, '');
        const findCol = (keywords: string[]) =>
          flow.columns.find(c => keywords.some(k => normCol(c).includes(k))) ?? null;

        const clientNameCol = findCol(['nomduclient', 'nomclient', 'client', 'acheteur']);
        const addressCol    = findCol(['adresse', 'address']);
        const postalCol     = findCol(['cp', 'codepostal', 'postal']);
        const cityCol       = findCol(['ville', 'city']);
        const phoneCol      = findCol(['tph', 'tel', 'telephone', 'portable', 'mobile']);
        const emailCol      = findCol(['mail', 'email', 'courriel']);

        // Parse "NOM PRENOM" → last word = prénom, reste = nom (utilisé contacts + deals)
        const parseClientName = (raw: string) => {
          const parts = raw.trim().split(/\s+/);
          if (parts.length === 1) return { first: '', last: raw.trim() };
          const first = parts[parts.length - 1];
          const last = parts.slice(0, -1).join(' ');
          const toTitle = (s: string) =>
            s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
          return { first: toTitle(first), last: toTitle(last) };
        };

        if (clientNameCol && effectiveId) {

          // ── Collect candidates (déduplique dans le fichier lui-même d'abord) ──
          type ClientCandidate = {
            first: string; last: string; fullNameNorm: string;
            email: string | null; phone: string | null;
            cp: string | null; city: string | null; address: string | null;
          };
          const seenInFile = new Set<string>();
          const candidates: ClientCandidate[] = [];

          for (const r of matchResults) {
            if (r.match_status === 'non_reconnu') continue;
            const rawNameRaw = r.raw_data[clientNameCol];
            if (rawNameRaw == null) continue;
            const rawName = String(rawNameRaw).trim();
            if (!rawName) continue;

            const emailRaw = emailCol ? r.raw_data[emailCol] : null;
            const phoneRaw = phoneCol ? r.raw_data[phoneCol] : null;
            const addrRaw  = addressCol ? r.raw_data[addressCol] : null;
            const cpRaw    = postalCol  ? r.raw_data[postalCol]  : null;
            const cityRaw  = cityCol    ? r.raw_data[cityCol]    : null;

            const email = emailRaw != null ? (String(emailRaw).trim().toLowerCase() || null) : null;
            const phone = phoneRaw != null ? (String(phoneRaw).trim().replace(/\s/g, '') || null) : null;
            const addr  = addrRaw  != null ? (String(addrRaw).trim()  || null) : null;
            const cp    = cpRaw    != null ? (String(cpRaw).trim()    || null) : null;
            const city  = cityRaw  != null ? (String(cityRaw).trim()  || null) : null;

            // Dédup interne au fichier : email > téléphone > nom+cp
            const fileKey = email || phone || `${normalizeStr(rawName)}|${cp || ''}`;
            if (seenInFile.has(fileKey)) continue;
            seenInFile.add(fileKey);

            const { first, last } = parseClientName(rawName);
            candidates.push({ first, last, fullNameNorm: normalizeStr(rawName), email, phone, cp, city, address: addr });
          }

          if (candidates.length > 0) {
            // Charge les contacts existants (nom normalisé + email + téléphone + cp)
            const { data: existingContacts } = await supabase
              .from('contacts')
              .select('first_name, last_name, email, phone, address')
              .eq('user_id', effectiveId);

            // Système de points : score ≥ 4 → doublon incontestable
            // Email exact      : 5 pts  (seul = déjà suffisant)
            // Téléphone exact  : 4 pts  (seul = déjà suffisant)
            // Nom normalisé    : 2 pts
            // CP               : 1 pt
            // Ville            : 1 pt
            const isDuplicate = (c: ClientCandidate): boolean => {
              for (const ex of (existingContacts || [])) {
                let score = 0;
                const exEmail = ex.email ? String(ex.email).toLowerCase() : null;
                const exPhone = ex.phone ? String(ex.phone).replace(/\s/g, '') : null;
                // Compare nom dans les deux ordres (CSV = "NOM PRENOM", DB = "PRENOM NOM")
                const exNameNorm1 = normalizeStr(`${ex.first_name ?? ''} ${ex.last_name ?? ''}`);
                const exNameNorm2 = normalizeStr(`${ex.last_name ?? ''} ${ex.first_name ?? ''}`);
                const exCp = ex.address ? (String(ex.address).match(/\b\d{5}\b/)?.[0] || null) : null;

                if (c.email && exEmail && c.email === exEmail) score += 5;
                if (c.phone && exPhone && c.phone === exPhone) score += 4;
                if (matchScore(c.fullNameNorm, exNameNorm1) >= 85 || matchScore(c.fullNameNorm, exNameNorm2) >= 85) score += 2;
                if (c.cp && exCp && c.cp === exCp) score += 1;
                if (c.city && ex.address && normalizeStr(String(ex.address)).includes(normalizeStr(c.city))) score += 1;

                if (score >= 4) return true;
              }
              return false;
            };

            const toInsert = candidates
              .filter(c => !isDuplicate(c))
              .map(c => ({
                user_id: effectiveId,
                first_name: c.first || 'Inconnu',
                last_name: c.last,
                email: c.email,
                phone: c.phone,
                address: [c.address, c.cp, c.city].filter(Boolean).join(', ') || null,
                status: 'cliente' as const,
                source: 'import_trv',
              }));

            if (toInsert.length > 0) {
              await supabase.from('contacts').insert(toInsert);
            }
          }
        }

        // ── Validation des deals existants par le TRV ──
        // Le workflow normal : les deals sont créés manuellement au fil du mois,
        // l'import TRV vient les confirmer (statut → 'livree', commission confirmée).
        // Si aucun deal existant trouvé → création automatique en fallback.
        const trvNoteMarker = `TRV ${flow.period}`;
        const periodStart = `${flow.period}-01`;
        const periodEnd = `${flow.period}-31`;

        const { data: allContacts } = await supabase
          .from('contacts').select('id, first_name, last_name').eq('user_id', effectiveId);

        const { data: existingDeals } = await supabase
          .from('deals')
          .select('id, contact_id, status, signed_at, notes')
          .eq('user_id', effectiveId)
          .in('status', ['signee', 'livree', 'en_cours', 'en_attente'])
          .gte('signed_at', periodStart)
          .lte('signed_at', periodEnd);

        const priceCol = flow.mapping.amount_col;
        const seenDealClients = new Set<string>();
        let validated = 0;
        const dealsToCreate: any[] = [];

        for (const r of matchResults) {
          if (r.match_status === 'non_reconnu') continue;

          const rawClientName = clientNameCol ? String(r.raw_data[clientNameCol] ?? '').trim() : '';
          const clientKey = normalizeStr(rawClientName || `row-${Math.random()}`);
          if (seenDealClients.has(clientKey)) continue;
          seenDealClients.add(clientKey);

          // Chercher le contact correspondant
          let contactId: string | null = null;
          if (rawClientName && allContacts) {
            const { first: cFirst, last: cLast } = parseClientName(rawClientName);
            const normName = normalizeStr(`${cFirst} ${cLast}`);
            const matched = allContacts.find(c =>
              matchScore(normalizeStr(`${c.first_name ?? ''} ${c.last_name ?? ''}`), normName) >= 75
            );
            contactId = matched?.id || null;
          }

          // Chercher un deal existant pour ce client dans la période
          const existingDeal = (existingDeals || []).find(d => d.contact_id && d.contact_id === contactId);

          if (existingDeal) {
            // Valider le deal existant
            await supabase.from('deals').update({
              status: 'livree',
              notes: existingDeal.notes ? `${existingDeal.notes} • ${trvNoteMarker}` : trvNoteMarker,
              commission_actual: r.is_owner_row ? r.amount : 0,
            }).eq('id', existingDeal.id);
            validated++;
          } else {
            // Fallback : créer le deal si pas trouvé (nouveau compte ou deal non encore créé)
            const rawPriceStr = priceCol && r.raw_data[priceCol] != null ? String(r.raw_data[priceCol]) : '';
            const saleAmount = parseAmount(rawPriceStr) || 0;
            dealsToCreate.push({
              user_id: effectiveId,
              contact_id: contactId,
              amount: saleAmount,
              status: 'livree' as const,
              signed_at: new Date(`${flow.period}-15T12:00:00.000Z`).toISOString(),
              sold_by: r.is_owner_row ? null : (r.matched_member?.id || null),
              notes: trvNoteMarker,
              commission_direct: r.is_owner_row ? r.amount : 0,
              commission_actual: 0,
            });
          }
        }

        if (dealsToCreate.length > 0) {
          const { error: dealInsertErr } = await supabase.from('deals').insert(dealsToCreate);
          if (dealInsertErr) throw new Error(`Deals: ${dealInsertErr.message}`);
        }
        return validated + dealsToCreate.length;
      } catch (contactErr) {
        // Contacts non-bloquants, deals remontés
        console.warn('Contacts/deals :', contactErr);
        toast({ title: 'Avertissement deals', description: String((contactErr as Error)?.message || contactErr), variant: 'destructive' });
      }
      return 0;
    },
    onSuccess: async (createdCount) => {
      queryClient.invalidateQueries({ queryKey: ['commission-imports'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });

      // Save mapping profile + name associations for future auto-mapping
      if (user) {
        const columnsKey = [...flow.columns].sort().join(',');
        const existingProfiles = ((settings?.column_mappings as any)?.profiles || []) as any[];
        const existingAssocs = ((settings?.column_mappings as any)?.name_associations || {}) as Record<string, string>;
        const newProfile = { columns_key: columnsKey, mapping: flow.mapping, last_used: new Date().toISOString().split('T')[0] };
        const updatedProfiles = existingProfiles.filter((p: any) => p.columns_key !== columnsKey);
        updatedProfiles.push(newProfile);

        // Save manual name→member associations for future matching
        const updatedAssocs = { ...existingAssocs };
        for (const r of matchResults) {
          if (r.matched_member && !r.is_owner_row && r.match_status === 'manuel') {
            updatedAssocs[normalizeStr(r.row_name)] = r.matched_member.id;
          }
        }

        await supabase.from('user_settings').upsert({
          user_id: user.id,
          column_mappings: { profiles: updatedProfiles, name_associations: updatedAssocs } as any,
        }, { onConflict: 'user_id' });
        queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      }

      setFlow({ ...flow, step: 'done' });
      toast({
        title: 'Import traité avec succès',
        description: createdCount > 0 ? `${createdCount} contact${createdCount > 1 ? 's' : ''} client${createdCount > 1 ? 's' : ''} ajouté${createdCount > 1 ? 's' : ''}` : undefined,
      });
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
  <div class="logo">HYLA <span>Assistant</span></div>
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
  <p>Document généré automatiquement par Hyla Assistant le ${today}</p>
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
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-gray-700'
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
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Auto-avancer la période au mois suivant le dernier import
                  const lastPeriod = (imports as any[])[0]?.period;
                  let defaultPeriod = flow.period;
                  if (lastPeriod) {
                    const [y, m] = lastPeriod.split('-').map(Number);
                    defaultPeriod = m === 12
                      ? `${y + 1}-01`
                      : `${y}-${String(m + 1).padStart(2, '0')}`;
                  }
                  setShowImport(true);
                  setFlow({ ...flow, step: 'upload', rawData: [], columns: [], period: defaultPeriod, fileName: '' });
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#3b82f6] text-white font-semibold rounded-xl active:scale-[0.98] transition-transform"
              >
                <Upload className="h-4 w-4" />
                Importer
              </button>
              <button
                onClick={() => setShowBulkImport(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-3.5 bg-muted text-foreground font-semibold rounded-xl active:scale-[0.98] transition-transform border border-border hover:bg-muted/80"
                title="Importer plusieurs fichiers TRV d'un coup (onboarding historique)"
              >
                <Network className="h-4 w-4 text-[#3b82f6]" />
                <span className="text-sm">Multi</span>
              </button>
            </div>

            {/* Import dialog */}
            <Dialog open={showImport} onOpenChange={(open) => {
              setShowImport(open);
              if (!open) {
                setFlow({ step: 'upload', rawData: [], columns: [], mapping: { name_col: '', firstname_col: '', amount_col: '', id_col: '' }, period: flow.period, fileName: '' });
                setMatchResults([]);
                setDuplicateWarning(false);
                setShowOutOfTeam(false);
              }
            }}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                    <div
                      className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileSpreadsheet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground mb-2">CSV, Excel ou template Excel</p>
                      <p className="text-xs font-semibold text-blue-500">Cliquer pour choisir un fichier</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.xltx,.xlsm"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}

                {flow.step === 'mapping' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">{flow.rawData.length} lignes dans "{flow.fileName}"</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Colonne Nom *</Label>
                        <Select value={flow.mapping.name_col || undefined} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, name_col: v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Colonne Prénom (optionnel)</Label>
                        <Select value={flow.mapping.firstname_col || '__none__'} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, firstname_col: v === '__none__' ? '' : v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Aucune" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Aucune</SelectItem>
                            {flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Colonne Montant *</Label>
                        <Select value={flow.mapping.amount_col || undefined} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, amount_col: v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>{flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Colonne ID (optionnel)</Label>
                        <Select value={flow.mapping.id_col || '__none__'} onValueChange={(v) => setFlow({ ...flow, mapping: { ...flow.mapping, id_col: v === '__none__' ? '' : v } })}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Aucune" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Aucune</SelectItem>
                            {flow.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="bg-muted rounded-lg p-2.5 max-h-28 overflow-y-auto">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Aperçu</p>
                      {flow.rawData.slice(0, 3).map((row, i) => (
                        <div key={i} className="text-xs text-muted-foreground mb-0.5">
                          <span className="font-medium">{[row[flow.mapping.firstname_col], row[flow.mapping.name_col]].filter(Boolean).join(' ') || '—'}</span>
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
                    {/* ── Récap financier ── */}
                    {(() => {
                      const recognizedRows = matchResults.filter(r => r.match_status !== 'non_reconnu');
                      const totalImporte = recognizedRows.reduce((s, r) => s + r.amount, 0);
                      const totalDirecte = matchResults.filter(r => r.is_owner_row).reduce((s, r) => s + r.amount, 0);
                      const totalReseau = recognizedRows.filter(r => !r.is_owner_row).reduce((s, r) => s + r.amount, 0);
                      const totalPerdu = matchResults.filter(r => r.match_status === 'non_reconnu').reduce((s, r) => s + r.amount, 0);
                      return (
                        <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-xl p-4 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-semibold uppercase opacity-80">Total importé</p>
                            <p className="text-xl font-bold">{totalImporte.toLocaleString('fr-FR')} €</p>
                          </div>
                          <div className="flex gap-3 text-xs opacity-90">
                            <div>
                              <p className="opacity-60 text-[10px]">Directe (moi)</p>
                              <p className="font-semibold">{totalDirecte.toLocaleString('fr-FR')} €</p>
                            </div>
                            <div>
                              <p className="opacity-60 text-[10px]">Réseau (équipe)</p>
                              <p className="font-semibold">{totalReseau.toLocaleString('fr-FR')} €</p>
                            </div>
                            {totalPerdu > 0 && (
                              <div className="ml-auto text-right">
                                <p className="text-blue-200 text-[10px]">Hors équipe (ignoré)</p>
                                <p className="font-semibold text-blue-200">{totalPerdu.toLocaleString('fr-FR')} €</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

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
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <XCircle className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-gray-500">{unmatched}</p>
                        <p className="text-[10px] text-gray-400">Hors équipe</p>
                      </div>
                    </div>

                    {unmatched > 0 && (
                      <div className="flex items-start justify-between gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-start gap-2 min-w-0">
                          <AlertTriangle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-500">
                            <span className="font-semibold">{unmatched} ligne{unmatched > 1 ? 's' : ''} hors équipe</span> — autres conseillers France, ignorées automatiquement.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowOutOfTeam(v => !v)}
                          className="text-[10px] text-blue-500 underline whitespace-nowrap flex-shrink-0"
                        >
                          {showOutOfTeam ? 'Masquer' : 'Voir'}
                        </button>
                      </div>
                    )}

                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {matchResults.filter(r => showOutOfTeam || r.match_status !== 'non_reconnu').map((r) => {
                        const originalIndex = matchResults.indexOf(r);
                        return (
                          <div key={originalIndex} className={`p-2.5 rounded-lg text-xs ${
                            r.match_status === 'auto' ? 'bg-green-50' :
                            r.match_status === 'manuel' ? 'bg-amber-50' : 'bg-gray-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-foreground truncate block">{r.row_name}</span>
                                {r.is_owner_row && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Moi</span>}
                                {r.matched_member && !r.is_owner_row && (
                                  <span className="text-[10px] text-muted-foreground">→ {r.matched_member.first_name} {r.matched_member.last_name} {r.matched_member.internal_id ? `(${r.matched_member.internal_id})` : ''}</span>
                                )}
                                {r.match_status === 'non_reconnu' && !r.is_owner_row && (
                                  <span className="text-[10px] text-gray-400">hors équipe</span>
                                )}
                              </div>
                              <span className={`font-semibold ml-2 whitespace-nowrap ${r.match_status === 'non_reconnu' ? 'text-gray-400' : 'text-foreground'}`}>{r.amount.toLocaleString('fr-FR')} €</span>
                            </div>
                            {/* Bouton "Corriger" pour les lignes auto bien matchées */}
                            {!r.is_owner_row && r.match_status === 'auto' && r.matched_member && (
                              <button
                                className="text-[10px] text-blue-400 underline mt-1"
                                onClick={() => setCorrectionOpen(prev => {
                                  const next = new Set(prev);
                                  next.has(originalIndex) ? next.delete(originalIndex) : next.add(originalIndex);
                                  return next;
                                })}
                              >
                                {correctionOpen.has(originalIndex) ? 'Annuler' : 'Corriger'}
                              </button>
                            )}

                            {/* Dropdown de correction : non_reconnu (visible si showOutOfTeam) | manuel (toujours) | auto (si bouton cliqué) */}
                            {!r.is_owner_row && (
                              r.match_status === 'non_reconnu' ? showOutOfTeam :
                              r.match_status === 'manuel' ? true :
                              correctionOpen.has(originalIndex)
                            ) && (
                              <div className="mt-1.5">
                                <select
                                  className={`w-full text-[11px] border rounded-lg px-2 py-1.5 bg-card focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${
                                    r.match_status === 'non_reconnu' ? 'border-gray-200' : 'border-amber-300'
                                  }`}
                                  value={r.matched_member?.id || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    const updated = [...matchResults];
                                    if (val === '__owner__') {
                                      updated[originalIndex] = { ...r, is_owner_row: true, matched_member: null, match_status: 'auto' as const, match_confidence: 100 };
                                    } else {
                                      const member = allTreeMembers.find((m: any) => m.id === val);
                                      if (member) {
                                        updated[originalIndex] = { ...r, matched_member: member, match_confidence: 100, match_status: 'manuel' as const };
                                      }
                                    }
                                    setMatchResults(updated);
                                    setCorrectionOpen(prev => { const next = new Set(prev); next.delete(originalIndex); return next; });
                                  }}
                                >
                                  <option value="">{r.match_status === 'manuel' ? 'Corriger le match...' : r.match_status === 'auto' ? 'Choisir un autre membre...' : 'Assigner à un membre...'}</option>
                                  <option value="__owner__">C'est moi</option>
                                  {allTreeMembers.map((m: any) => (
                                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name} {m.internal_id ? `(${m.internal_id})` : ''}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {duplicateWarning ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">Un import existe déjà pour {flow.period}.</span><br />
                            Le remplacer effacera les commissions précédemment importées pour cette période, y compris celles cascadées à ton équipe.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDuplicateWarning(false)}
                            className="flex-1 py-2 bg-muted text-foreground text-xs font-semibold rounded-lg"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleValidate(true)}
                            disabled={saveImport.isPending}
                            className="flex-[2] py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {saveImport.isPending ? 'Remplacement...' : 'Remplacer l\'import existant'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFlow({ ...flow, step: 'mapping' })}
                          disabled={saveImport.isPending || checkingDuplicate}
                          className="flex-1 py-3 bg-muted text-foreground font-semibold rounded-xl disabled:opacity-50"
                        >
                          Retour
                        </button>
                        <button
                          onClick={() => handleValidate(false)}
                          disabled={saveImport.isPending || checkingDuplicate}
                          className="flex-[2] py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50"
                        >
                          {checkingDuplicate ? 'Vérification...' : saveImport.isPending ? 'Traitement...' : 'Valider et consolider'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {flow.step === 'done' && (
                  <div className="text-center py-6">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p className="text-base font-semibold text-foreground">Import terminé</p>
                    <p className="text-xs text-muted-foreground mt-1">Les commissions ont été consolidées.</p>
                    <button onClick={() => setShowImport(false)} className="mt-4 px-6 py-2 bg-muted rounded-xl text-sm font-medium">Fermer</button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Import history */}
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Historique des imports</h3>
              </div>
              <div className="divide-y divide-border">
                {imports.map((imp: any) => (
                  <div
                    key={imp.id}
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                    onClick={async () => {
                      setSelectedImport(imp);
                      const { data: rows } = await supabase
                        .from('commission_import_rows')
                        .select('*')
                        .eq('import_id', imp.id)
                        .order('created_at');
                      setImportRows(rows || []);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">{imp.file_name}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground ml-5.5">
                        {imp.period} • {new Date(imp.uploaded_at).toLocaleDateString('fr-FR')}
                        {imp.stats && ` • ${(imp.stats as any).matched_rows || 0} matchés / ${(imp.stats as any).total_rows || 0}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${IMPORT_STATUS_COLORS[imp.status as keyof typeof IMPORT_STATUS_COLORS]}`}>
                        {IMPORT_STATUS_LABELS[imp.status as keyof typeof IMPORT_STATUS_LABELS]}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                ))}
                {imports.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun import</div>
                )}
              </div>
            </div>

            {/* ── Import Detail Dialog ── */}
            <Dialog open={!!selectedImport} onOpenChange={(v) => { if (!v) { setSelectedImport(null); setImportRows([]); } }}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <FileSpreadsheet className="h-5 w-5 text-[#3b82f6]" />
                    {selectedImport?.file_name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-muted rounded-lg">Période : {selectedImport?.period}</span>
                    <span className={`px-2 py-1 rounded-lg ${IMPORT_STATUS_COLORS[selectedImport?.status as keyof typeof IMPORT_STATUS_COLORS]}`}>
                      {IMPORT_STATUS_LABELS[selectedImport?.status as keyof typeof IMPORT_STATUS_LABELS]}
                    </span>
                  </div>

                  {selectedImport?.stats && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 rounded-xl p-2.5 text-center">
                        <p className="text-sm font-bold text-green-700">{(selectedImport.stats as any).matched_rows || 0}</p>
                        <p className="text-[10px] text-green-600">Matchés</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-2.5 text-center">
                        <p className="text-sm font-bold text-red-600">{(selectedImport.stats as any).unmatched_rows || 0}</p>
                        <p className="text-[10px] text-red-500">Non matchés</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                        <p className="text-sm font-bold text-blue-700">{((selectedImport.stats as any).total_amount || 0).toLocaleString('fr-FR')}€</p>
                        <p className="text-[10px] text-blue-600">Total</p>
                      </div>
                    </div>
                  )}

                  {/* Rows — matchés individuels + non-matchés groupés par nom */}
                  {(() => {
                    const matchedRows = importRows.filter((r: any) => r.match_status !== 'non_reconnu');
                    const unmatchedRows = importRows.filter((r: any) => r.match_status === 'non_reconnu' && !r.is_owner_row);

                    // Grouper les non-matchés par nom (details)
                    const unmatchedGroups = unmatchedRows.reduce((acc: Record<string, any>, row: any) => {
                      const key = (row.details || 'Sans nom').trim();
                      if (!acc[key]) acc[key] = { name: key, rows: [], total: 0 };
                      acc[key].rows.push(row);
                      acc[key].total += row.amount || 0;
                      return acc;
                    }, {});

                    const refreshRows = async () => {
                      const { data: rows } = await supabase
                        .from('commission_import_rows').select('*').eq('import_id', selectedImport.id).order('created_at');
                      setImportRows(rows || []);
                    };

                    return (
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {/* Matchés */}
                        {matchedRows.map((row: any) => (
                          <div key={row.id} className={`p-2.5 rounded-lg text-xs ${
                            row.match_status === 'auto' ? 'bg-green-50' : 'bg-amber-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-foreground block">{row.details || 'Sans nom'}</span>
                                {row.is_owner_row && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Moi</span>}
                              </div>
                              <span className="font-semibold text-foreground ml-2">{(row.amount || 0).toLocaleString('fr-FR')} €</span>
                            </div>
                          </div>
                        ))}

                        {/* Non-matchés groupés par nom */}
                        {Object.values(unmatchedGroups).map((group: any) => (
                          <div key={group.name} className="p-2.5 rounded-lg text-xs bg-red-50 border border-red-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-foreground">{group.name}</span>
                              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                {group.rows.length > 1 && (
                                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                    {group.rows.length} ventes
                                  </span>
                                )}
                                <span className="font-semibold text-foreground">{group.total.toLocaleString('fr-FR')} €</span>
                              </div>
                            </div>
                            <select
                              className="w-full text-[11px] border border-red-200 rounded-lg px-2 py-1.5 bg-card"
                              value=""
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const ids = group.rows.map((r: any) => r.id);
                                const myLevel = (settings as any)?.hyla_level || 'manager';

                                if (val === '__owner__') {
                                  // Barème glissant : compter les lignes déjà propriétaire dans cet import
                                  const existingOwnerCount = importRows.filter((r: any) => r.is_owner_row).length;
                                  // Mettre à jour chaque ligne avec son rang exact
                                  for (let i = 0; i < ids.length; i++) {
                                    const rank = existingOwnerCount + i + 1;
                                    await supabase.from('commission_import_rows').update({
                                      is_owner_row: true, match_status: 'auto', match_confidence: 100,
                                      amount: getPersonalSaleCommission(rank),
                                    }).eq('id', ids[i]);
                                  }
                                } else {
                                  // Commission recrue fixe par niveau
                                  const recrueAmount = getRecrueCommission(myLevel);
                                  await supabase.from('commission_import_rows').update({
                                    matched_member_id: val, match_status: 'manuel', match_confidence: 100,
                                    amount: recrueAmount,
                                  }).in('id', ids);
                                }
                                await refreshRows();
                              }}
                            >
                              <option value="">Associer à un membre...</option>
                              <option value="__owner__">C'est moi</option>
                              {allTreeMembers.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.first_name} {m.last_name} {m.internal_id ? `(${m.internal_id})` : ''}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Re-consolidate button */}
                  {importRows.some((r: any) => r.match_status === 'non_reconnu') && (
                    <p className="text-[10px] text-muted-foreground text-center">Corrigez les lignes non matchées puis re-consolidez</p>
                  )}
                  <button
                    onClick={async () => {
                      if (!user) { toast({ title: 'Non connecté', variant: 'destructive' }); return; }
                      if (!effectiveId) { toast({ title: 'effectiveId manquant', variant: 'destructive' }); return; }
                      if (!selectedImport?.id) { toast({ title: 'Import non sélectionné', variant: 'destructive' }); return; }
                      const myLevel = (settings as any)?.hyla_level || 'manager';

                      // 0. Recalculer les montants Hyla pour toutes les lignes matchées
                      const { data: allRows, error: allRowsErr } = await supabase
                        .from('commission_import_rows')
                        .select('id, is_owner_row, match_status, matched_member_id, amount')
                        .eq('import_id', selectedImport.id)
                        .in('match_status', ['auto', 'manuel']);
                      if (allRowsErr) { return; }

                      if (allRows && allRows.length > 0) {
                        const ownerRows = allRows.filter((r: any) => r.is_owner_row);
                        const recrueRows = allRows.filter((r: any) => !r.is_owner_row);

                        // Mettre à jour les ventes perso avec le barème glissant
                        for (let i = 0; i < ownerRows.length; i++) {
                          const correctAmount = getPersonalSaleCommission(i + 1);
                          if (ownerRows[i].amount !== correctAmount) {
                            await supabase.from('commission_import_rows')
                              .update({ amount: correctAmount })
                              .eq('id', ownerRows[i].id);
                          }
                        }

                        // Mettre à jour les ventes recrues avec le taux du niveau
                        const recrueAmount = getRecrueCommission(myLevel);
                        const recrueToUpdate = recrueRows.filter((r: any) => r.amount !== recrueAmount).map((r: any) => r.id);
                        if (recrueToUpdate.length > 0) {
                          await supabase.from('commission_import_rows')
                            .update({ amount: recrueAmount })
                            .in('id', recrueToUpdate);
                        }
                      }

                      // 1. Supprimer TOUTES les anciennes commissions (source='import') pour cette période
                      await supabase.from('commissions')
                        .delete()
                        .eq('user_id', effectiveId)
                        .eq('period', selectedImport.period)
                        .eq('source', 'import');

                      const linkedIds = allTreeMembers
                        .filter((m: any) => m.linked_user_id && m.linked_user_id !== effectiveId)
                        .map((m: any) => m.linked_user_id as string);
                      for (const linkedId of linkedIds) {
                        await supabase.from('commissions')
                          .delete()
                          .eq('user_id', linkedId)
                          .eq('period', selectedImport.period)
                          .eq('source', 'import');
                      }

                      // 2. Récupérer les lignes matchées avec leur montant recalculé
                      const { data: updatedRows } = await supabase
                        .from('commission_import_rows')
                        .select('*, team_members:matched_member_id(id, linked_user_id, first_name, last_name)')
                        .eq('import_id', selectedImport.id);

                      // 3. Créer les commissions directement (bypass RPC — contrôle total sur user_id/status/source)
                      const toInsert: any[] = [];
                      let ownerRankCounter = 0;

                      for (const row of (updatedRows || [])) {
                        if (row.match_status === 'non_reconnu') continue;

                        if (row.is_owner_row) {
                          ownerRankCounter++;
                          const amount = getPersonalSaleCommission(ownerRankCounter);
                          toInsert.push({
                            user_id: effectiveId,
                            type: 'directe',
                            amount,
                            period: selectedImport.period,
                            status: 'validee',
                            source: 'import',
                            team_member_id: null,
                            notes: `Vente perso rank ${ownerRankCounter} — re-consolidation`,
                          });
                        } else if (row.matched_member_id) {
                          const amount = getRecrueCommission(myLevel);
                          toInsert.push({
                            user_id: effectiveId,
                            type: 'reseau',
                            amount,
                            period: selectedImport.period,
                            status: 'validee',
                            source: 'import',
                            team_member_id: row.matched_member_id,
                            notes: `Commission recrue re-consolidation`,
                          });

                          // Cascade vers le compte lié du recrue
                          const member = allTreeMembers.find((m: any) => m.id === row.matched_member_id);
                          if (member?.linked_user_id && member.linked_user_id !== effectiveId) {
                            toInsert.push({
                              user_id: member.linked_user_id,
                              type: 'directe',
                              amount,
                              period: selectedImport.period,
                              status: 'validee',
                              source: 'import',
                              team_member_id: null,
                              notes: `Re-import réseau par ${profile?.full_name || 'manager'}`,
                            });
                          }
                        }
                      }

                      if (toInsert.length > 0) {
                        const { error: insertErr } = await supabase.from('commissions').insert(toInsert);
                        if (insertErr) { toast({ title: 'Erreur insertion commissions', description: insertErr.message, variant: 'destructive' }); return; }
                      }

                      // 4. Contacts + Deals depuis les lignes TRV
                      try {
                        const rawKeys = Object.keys((updatedRows || [])[0]?.raw_data || {});
                        // Diagnostic temporaire : afficher les colonnes disponibles
                        toast({ title: '🔍 Colonnes CSV', description: rawKeys.slice(0, 8).join(' | ') || 'aucune', duration: 20000 });
                        const nk = (s: string) => normalizeStr(s).replace(/[^a-z0-9]/g, '');
                        const clientNameCol = rawKeys.find(k => ['nomduclient','nomclient','client','acheteur'].some(kw => nk(k).includes(kw))) || null;
                        const emailCol     = rawKeys.find(k => /mail|email|courriel/i.test(k)) || null;
                        const phoneCol     = rawKeys.find(k => /tph|tel|telephone|portable|mobile/i.test(k)) || null;
                        const addrCol      = rawKeys.find(k => /adresse|address/i.test(k)) || null;
                        const cpCol        = rawKeys.find(k => /^cp$|codepostal|postal/i.test(k)) || null;
                        const cityCol      = rawKeys.find(k => /ville|city/i.test(k)) || null;
                        // Colonne prix : 1) mapping sauvegardé, 2) nom de colonne, 3) valeurs sur lignes matchées
                        const savedAmountCol = (selectedImport.column_mapping as any)?.amount_col || null;
                        const nkCol = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
                        const priceCol = (savedAmountCol && rawKeys.includes(savedAmountCol) ? savedAmountCol : null)
                          || rawKeys.find(k => /prix.*vente|prixvente|prix|montant|price|amount/i.test(nkCol(k)))
                          || rawKeys.find(col => {
                            const matched = (updatedRows || []).filter((r: any) => r.match_status !== 'non_reconnu');
                            const samples = matched.slice(0, 30).map((r: any) => r.raw_data?.[col]).filter(Boolean);
                            if (samples.length < 2) return false;
                            const hits = samples.filter((v: any) => { const p = parseAmount(String(v)); return p >= 500 && p <= 9000; }).length;
                            return hits / samples.length > 0.3;
                          }) || null;

                        const parseClientName = (raw: string) => {
                          const parts = raw.trim().split(/\s+/);
                          if (parts.length === 1) return { first: '', last: raw.trim() };
                          const toTitle = (s: string) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
                          return { first: toTitle(parts[parts.length - 1]), last: toTitle(parts.slice(0, -1).join(' ')) };
                        };

                        // ── A. Créer les contacts manquants ──
                        const { data: existingContacts } = await supabase
                          .from('contacts').select('id, first_name, last_name, email, phone')
                          .eq('user_id', effectiveId);

                        const seenContactKeys = new Set<string>();
                        const contactsToInsert: any[] = [];

                        if (clientNameCol) {
                          for (const row of (updatedRows || [])) {
                            if (row.match_status === 'non_reconnu') continue;
                            const rawName = String(row.raw_data?.[clientNameCol] ?? '').trim();
                            if (!rawName) continue;
                            const normName = normalizeStr(rawName);
                            if (seenContactKeys.has(normName)) continue;
                            seenContactKeys.add(normName);

                            const rawEmail = emailCol ? String(row.raw_data?.[emailCol] ?? '').trim().toLowerCase() : '';
                            const rawPhone = phoneCol ? String(row.raw_data?.[phoneCol] ?? '').replace(/\s/g, '') : '';
                            const alreadyExists = (existingContacts || []).some((c: any) => {
                              if (rawEmail && c.email && rawEmail === String(c.email).toLowerCase()) return true;
                              if (rawPhone && c.phone && rawPhone === String(c.phone).replace(/\s/g, '')) return true;
                              const stored1 = normalizeStr(`${c.first_name ?? ''} ${c.last_name ?? ''}`);
                              const stored2 = normalizeStr(`${c.last_name ?? ''} ${c.first_name ?? ''}`);
                              return matchScore(stored1, normName) >= 85 || matchScore(stored2, normName) >= 85;
                            });
                            if (alreadyExists) continue;

                            const { first, last } = parseClientName(rawName);
                            const email = emailCol ? (String(row.raw_data?.[emailCol] ?? '').trim().toLowerCase() || null) : null;
                            const phone = phoneCol ? (String(row.raw_data?.[phoneCol] ?? '').replace(/\s/g, '') || null) : null;
                            const addr  = addrCol  ? (String(row.raw_data?.[addrCol]  ?? '').trim() || null) : null;
                            const cp    = cpCol    ? (String(row.raw_data?.[cpCol]    ?? '').trim() || null) : null;
                            const city  = cityCol  ? (String(row.raw_data?.[cityCol]  ?? '').trim() || null) : null;
                            contactsToInsert.push({
                              user_id: effectiveId,
                              first_name: first || 'Inconnu',
                              last_name: last,
                              email,
                              phone,
                              address: [addr, cp, city].filter(Boolean).join(', ') || null,
                              status: 'cliente' as const,
                              source: 'import_trv',
                            });
                          }
                          if (contactsToInsert.length > 0) {
                            const { error: contactErr } = await supabase.from('contacts').insert(contactsToInsert);
                            if (contactErr) {
                              toast({ title: '❌ Erreur INSERT contacts', description: contactErr.message, variant: 'destructive' });
                              // On continue quand même pour créer les deals avec les contacts existants
                            }
                          }
                        }

                        // Recharger les contacts après création
                        const { data: allContacts } = await supabase
                          .from('contacts').select('id, first_name, last_name').eq('user_id', effectiveId);

                        // ── B. Créer/valider les deals ──
                        const trvMarker = `TRV ${selectedImport.period}`;
                        const { data: existingDeals } = await supabase
                          .from('deals').select('id, contact_id, status, notes, amount')
                          .eq('user_id', effectiveId)
                          .ilike('notes', `%${trvMarker}%`);

                        const seenClients = new Set<string>();
                        const dealsToCreate: any[] = [];
                        let dealsValidated = 0;
                        let ownerRank = 0;

                        for (const row of (updatedRows || [])) {
                          if (row.match_status === 'non_reconnu') continue;
                          const rawClient = clientNameCol ? String(row.raw_data?.[clientNameCol] ?? '').trim() : '';
                          const clientKey = normalizeStr(rawClient || String(row.id));
                          if (seenClients.has(clientKey)) continue;
                          seenClients.add(clientKey);

                          if (row.is_owner_row) ownerRank++;

                          let contactId: string | null = null;
                          if (rawClient && allContacts) {
                            // Compare les deux ordres (CSV = "NOM PRENOM", DB = first_name + last_name)
                            const { first: cf, last: cl } = parseClientName(rawClient);
                            const normParsed  = normalizeStr(`${cf} ${cl}`);
                            const normRaw     = normalizeStr(rawClient);
                            const found = (allContacts as any[]).find(c => {
                              const s1 = normalizeStr(`${c.first_name ?? ''} ${c.last_name ?? ''}`);
                              const s2 = normalizeStr(`${c.last_name ?? ''} ${c.first_name ?? ''}`);
                              return matchScore(s1, normParsed) >= 75
                                  || matchScore(s2, normParsed) >= 75
                                  || matchScore(s1, normRaw)    >= 75
                                  || matchScore(s2, normRaw)    >= 75;
                            });
                            contactId = found?.id || null;
                          }

                          const existingDeal = (existingDeals || []).find((d: any) => d.contact_id && d.contact_id === contactId);
                          const saleAmount = priceCol ? parseAmount(String(row.raw_data?.[priceCol] ?? '')) : 0;
                          const comDirect  = row.is_owner_row ? getPersonalSaleCommission(ownerRank) : 0;

                          if (existingDeal) {
                            await supabase.from('deals').update({
                              status: 'livree',
                              amount: saleAmount > 0 ? saleAmount : existingDeal.amount,
                              commission_actual: comDirect,
                            }).eq('id', existingDeal.id);
                            dealsValidated++;
                          } else {
                            dealsToCreate.push({
                              user_id: effectiveId,
                              contact_id: contactId,
                              amount: saleAmount ?? 0,
                              status: 'livree' as const,
                              signed_at: new Date(`${selectedImport.period}-15T12:00:00.000Z`).toISOString(),
                              sold_by: row.is_owner_row ? null : (row.matched_member_id || null),
                              notes: trvMarker,
                              commission_direct: comDirect,
                              commission_actual: comDirect,
                            });
                          }
                        }

                        let dealsCreated = 0;
                        if (dealsToCreate.length > 0) {
                          const { error: dealErr } = await supabase.from('deals').insert(dealsToCreate);
                          if (dealErr) {
                            // On throw pour que le catch extérieur affiche l'erreur clairement
                            throw new Error(`INSERT deals échoué: ${dealErr.message} (code: ${dealErr.code})`);
                          }
                          dealsCreated = dealsToCreate.length;
                        }
                        queryClient.invalidateQueries({ queryKey: ['deals'] });
                        queryClient.invalidateQueries({ queryKey: ['contacts'] });

                        const summary = [
                          contactsToInsert.length > 0 ? `${contactsToInsert.length} contact(s) créé(s)` : null,
                          dealsCreated > 0            ? `${dealsCreated} vente(s) créée(s)` : null,
                          dealsValidated > 0          ? `${dealsValidated} vente(s) validée(s)` : null,
                        ].filter(Boolean).join(' · ');
                        toast({ title: '✅ Re-consolidation terminée', description: summary || 'Commissions mises à jour' });
                      } catch (dealErr) {
                        toast({ title: 'Erreur contacts/deals', description: String((dealErr as Error)?.message || dealErr), variant: 'destructive' });
                      }

                      queryClient.invalidateQueries({ queryKey: ['commission-imports'] });
                      queryClient.invalidateQueries({ queryKey: ['commissions'] });
                      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
                      setSelectedImport(null);
                      setImportRows([]);
                    }}
                    className="w-full py-2.5 bg-[#3b82f6] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Re-consolider les commissions
                  </button>

                  {/* ── Supprimer l'import ── */}
                  <button
                    onClick={async () => {
                      if (!selectedImport) return;
                      if (!window.confirm(`Supprimer l'import "${selectedImport.file_name}" (${selectedImport.period}) ? Toutes les commissions associées seront supprimées.`)) return;

                      // 1. Supprimer commissions du manager pour cette période/import
                      await supabase.from('commissions')
                        .delete()
                        .eq('user_id', effectiveId)
                        .eq('period', selectedImport.period)
                        .eq('source', 'import');

                      // 2. Supprimer commissions cascadées vers l'équipe liée
                      const linkedIds = allTreeMembers
                        .filter((m: any) => m.linked_user_id && m.linked_user_id !== effectiveId)
                        .map((m: any) => m.linked_user_id as string);
                      for (const linkedId of linkedIds) {
                        await supabase.from('commissions')
                          .delete()
                          .eq('user_id', linkedId)
                          .eq('period', selectedImport.period)
                          .eq('source', 'import');
                      }

                      // 3. Supprimer les lignes de l'import puis l'import lui-même
                      await supabase.from('commission_import_rows').delete().eq('import_id', selectedImport.id);
                      await supabase.from('commission_imports').delete().eq('id', selectedImport.id);

                      queryClient.invalidateQueries({ queryKey: ['commission-imports', effectiveId] });
                      queryClient.invalidateQueries({ queryKey: ['commissions', effectiveId] });
                      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
                      toast({ title: 'Import supprimé', description: `L'import ${selectedImport.period} a été supprimé.` });
                      setSelectedImport(null);
                      setImportRows([]);
                    }}
                    className="w-full py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer cet import
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* ══════════════ TAB: FACTURES ══════════════ */}
        {activeTab === 'factures' && (
          <>
            {/* Period selector */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Période de facturation</Label>
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
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Détail des commissions</h3>
                <span className="text-xs text-muted-foreground">{invoiceCommissions.length} lignes</span>
              </div>
              <div className="divide-y divide-border">
                {invoiceCommissions.map((c: any) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.type === 'directe' ? 'Vente directe' : `Réseau${c.team_members ? ` - ${c.team_members.first_name} ${c.team_members.last_name}` : ''}`}
                      </p>
                      <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        c.type === 'directe' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {c.type === 'directe' ? 'Directe' : 'Réseau'}
                      </span>
                    </div>
                    <span className="font-bold text-foreground ml-2">{c.amount.toLocaleString('fr-FR')} €</span>
                  </div>
                ))}
                {invoiceCommissions.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune commission validée pour cette période</p>
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

      {/* ── Bulk import dialog ── */}
      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        userId={effectiveId || ''}
        profileName={profile?.full_name || ''}
        allTreeMembers={allTreeMembers}
        settings={settings}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['commission-imports'] });
          queryClient.invalidateQueries({ queryKey: ['commissions'] });
          queryClient.invalidateQueries({ queryKey: ['team-members-import'] });
          queryClient.invalidateQueries({ queryKey: ['team-tree-members'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
        }}
      />
    </AppLayout>
  );
}
