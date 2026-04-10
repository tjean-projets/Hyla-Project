import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase, HYLA_LEVELS } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  Loader2, Users, Network, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type MappingType = { name_col: string; firstname_col: string; amount_col: string; id_col: string };

interface BulkFile {
  file: File;
  period: string;
  periodAuto: boolean;
  status: 'pending' | 'processing' | 'done' | 'skipped' | 'error';
  error?: string;
  matchedCount: number;
  totalCount: number;
}

interface NewMemberCandidate {
  key: string;
  first: string;
  last: string;
  internalId: string;
  firstPeriod: string;
  selected: boolean;
  appearances: number;
}

interface TeamMemberEdit {
  id: string;
  first_name: string;
  last_name: string;
  hyla_level: string;
  sponsor_id: string | null;
  isNew: boolean;
}

interface MatchResult {
  raw_data: Record<string, string>;
  fullName: string;
  firstName: string;
  lastName: string;
  internalId: string;
  amount: number;
  is_owner_row: boolean;
  matched_member: any | null;
  match_confidence: number;
  match_status: 'auto' | 'manuel' | 'non_reconnu';
}

export interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  profileName: string;
  allTreeMembers: any[];
  settings: any;
  onComplete: () => void;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function normalizeStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseAmount(raw: string): number {
  const s = String(raw || '0').trim();
  const cleaned = s.replace(/[^\d.,\-]/g, '');
  if (!cleaned || cleaned === '-') return 0;
  const dotIdx = cleaned.lastIndexOf('.');
  const commaIdx = cleaned.lastIndexOf(',');
  if (commaIdx > dotIdx) return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  if (dotIdx > commaIdx) return parseFloat(cleaned.replace(/,/g, '')) || 0;
  return parseFloat(cleaned.replace(',', '.')) || 0;
}

function matchScore(a: string, b: string): number {
  const na = normalizeStr(a), nb = normalizeStr(b);
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
        matrix[i - 1][j] + 1, matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (na[i - 1] === nb[j - 1] ? 0 : 1)
      );
    }
  }
  return Math.round((1 - matrix[na.length][nb.length] / maxLen) * 100);
}

/** Extrait "YYYY-MM" depuis un nom de fichier TRV. */
function parsePeriodFromFilename(filename: string): string | null {
  const f = filename.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Pattern YYYY-MM / YYYY_MM / YYYY.MM
  const m1 = f.match(/(\d{4})[_\-.\/](\d{2})(?!\d)/);
  if (m1) {
    const year = parseInt(m1[1]), month = parseInt(m1[2]);
    if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12)
      return `${m1[1]}-${m1[2].padStart(2, '0')}`;
  }

  // Pattern MM-YYYY
  const m2 = f.match(/(?<!\d)(\d{2})[_\-.\/](\d{4})(?!\d)/);
  if (m2) {
    const month = parseInt(m2[1]), year = parseInt(m2[2]);
    if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12)
      return `${m2[2]}-${m2[1].padStart(2, '0')}`;
  }

  // Mois FR + année
  const months: [string, string][] = [
    ['janvier', '01'], ['fevrier', '02'], ['mars', '03'], ['avril', '04'],
    ['mai', '05'], ['juin', '06'], ['juillet', '07'], ['aout', '08'],
    ['septembre', '09'], ['octobre', '10'], ['novembre', '11'], ['decembre', '12'],
  ];
  for (const [name, num] of months) {
    let m = f.match(new RegExp(name + '[\\s_\\-]*(\\d{4})'));
    if (m) return `${m[1]}-${num}`;
    m = f.match(new RegExp('(\\d{4})[\\s_\\-]*' + name));
    if (m) return `${m[1]}-${num}`;
  }

  return null;
}

/** Lit un fichier en ArrayBuffer (promesse). */
function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsArrayBuffer(file);
  });
}

/** Détecte la colonne "montant" correspondant à la période. */
function detectAmountCol(columns: string[], period: string): string {
  const MONTHS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const periodMonth = parseInt(period.split('-')[1]) - 1;
  const periodYear = period.split('-')[0];
  const monthName = MONTHS_FR[periodMonth] || '';
  const amountCols = columns.filter(c => /montant|amount|com\b|comm|commission|total/i.test(c));
  return amountCols.find(c => {
    const lower = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return monthName && lower.includes(monthName) && lower.includes(periodYear);
  }) || amountCols.find(c => {
    const lower = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return monthName && lower.includes(monthName);
  }) || amountCols[0] || '';
}

/** Détecte le mapping colonnes depuis le profil sauvegardé ou l'auto-détection. */
function detectMapping(columns: string[], period: string, settings: any): MappingType | null {
  const columnsKey = [...columns].sort().join(',');
  const savedProfiles = (settings?.column_mappings as any)?.profiles || [];
  const saved = savedProfiles.find((p: any) => p.columns_key === columnsKey);
  const amountCol = detectAmountCol(columns, period);

  if (saved) return { ...saved.mapping, amount_col: amountCol || saved.mapping.amount_col };

  const nameCol = columns.find(c => /^nom$|name|conseiller|vendeur/i.test(c)) || '';
  const firstnameCol = columns.find(c => /prénom|prenom|firstname|first.?name/i.test(c)) || '';
  const idCol = columns.find(c => /id.?hyla|hyla.?id|matricule|code.?hyla|^id$/i.test(c)) || '';

  if (!nameCol || !amountCol) return null;
  return { name_col: nameCol, firstname_col: firstnameCol, amount_col: amountCol, id_col: idCol };
}

/** Parse une ligne CSV → name parts. Gère "NOM Prénom" (format Hyla CAPS). */
function parseTRVName(fullName: string, firstName: string, lastName: string): { first: string; last: string } {
  if (firstName && lastName) return { first: firstName, last: lastName };

  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: fullName };

  // Détecte les mots en MAJUSCULES = nom de famille
  const lastParts: string[] = [];
  const firstParts: string[] = [];
  let doneWithLast = false;
  for (const part of parts) {
    if (!doneWithLast && part.length > 1 && part === part.toUpperCase()) {
      lastParts.push(part);
    } else {
      doneWithLast = true;
      firstParts.push(part);
    }
  }

  const toTitleCase = (s: string) =>
    s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');

  if (lastParts.length > 0 && firstParts.length > 0) {
    return { last: lastParts.map(toTitleCase).join(' '), first: firstParts.join(' ') };
  }
  // Fallback : premier mot = nom, reste = prénom
  return { last: parts[0], first: parts.slice(1).join(' ') };
}

/** Lance le matching sur un fichier parsé. */
function runMatchingFn(
  json: Record<string, string>[],
  mapping: MappingType,
  ownerName: string,
  allTreeMembers: any[],
  settings: any,
): MatchResult[] {
  const savedAssocs = ((settings?.column_mappings as any)?.name_associations || {}) as Record<string, string>;

  return json.map(row => {
    const firstName = mapping.firstname_col ? String(row[mapping.firstname_col] || '').trim() : '';
    const lastName = String(row[mapping.name_col] || '').trim();
    const fullName = firstName ? `${firstName} ${lastName}` : lastName;
    const internalId = String(row[mapping.id_col] || '').trim();
    const amount = parseAmount(String(row[mapping.amount_col] || '0'));

    // Détection propriétaire (gère inversions NOM/Prénom)
    const isOwner = ownerName ? (() => {
      if (matchScore(ownerName, fullName) >= 75) return true;
      const reversed = ownerName.split(' ').reverse().join(' ');
      if (matchScore(reversed, fullName) >= 75) return true;
      const ownerWords = normalizeStr(ownerName).split(/\s+/).filter(w => w.length > 1);
      const rowWords = normalizeStr(fullName).split(/\s+/);
      if (ownerWords.length >= 2 && ownerWords.every(w => rowWords.some(rw => rw === w || rw.startsWith(w) || w.startsWith(rw)))) return true;
      return false;
    })() : false;

    let bestMatch: { member: any; confidence: number } | null = null;

    // 1. Association sauvegardée
    const norm = normalizeStr(fullName);
    if (savedAssocs[norm]) {
      const m = allTreeMembers.find((tm: any) => tm.id === savedAssocs[norm]);
      if (m) bestMatch = { member: m, confidence: 100 };
    }
    // 2. ID Hyla
    if (!bestMatch && internalId) {
      for (const m of allTreeMembers) {
        if (m.internal_id && normalizeStr(internalId) === normalizeStr(m.internal_id)) {
          bestMatch = { member: m, confidence: 100 };
          break;
        }
      }
    }
    // 3. Fuzzy name
    if (!bestMatch) {
      for (const m of allTreeMembers) {
        const names = [`${m.first_name} ${m.last_name}`, `${m.last_name} ${m.first_name}`, ...(m.matching_names || [])];
        for (const name of names) {
          const score = matchScore(name, fullName);
          if (score > (bestMatch?.confidence || 0)) bestMatch = { member: m, confidence: score };
        }
      }
    }

    const confidence = bestMatch?.confidence || 0;
    return {
      raw_data: row,
      fullName,
      firstName,
      lastName,
      internalId,
      amount,
      is_owner_row: isOwner,
      matched_member: confidence >= 60 ? bestMatch!.member : null,
      match_confidence: confidence,
      match_status: isOwner ? 'auto' : confidence >= 85 ? 'auto' : confidence >= 60 ? 'manuel' : 'non_reconnu',
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BulkImportDialog({
  open, onOpenChange, userId, profileName, allTreeMembers, settings, onComplete,
}: BulkImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  type Step = 'setup' | 'processing' | 'create_members' | 'structure' | 'done';
  const [step, setStep] = useState<Step>('setup');
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [newMembers, setNewMembers] = useState<NewMemberCandidate[]>([]);
  const [teamEdits, setTeamEdits] = useState<TeamMemberEdit[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);
  const [summary, setSummary] = useState({ files: 0, commissions: 0, newCandidates: 0 });

  const resetAndClose = (val: boolean) => {
    if (!val && !processing) {
      setStep('setup');
      setFiles([]);
      setNewMembers([]);
      setTeamEdits([]);
      setSummary({ files: 0, commissions: 0, newCandidates: 0 });
    }
    onOpenChange(val);
  };

  // ── Ajout de fichiers ──
  const addFiles = useCallback((fileList: File[]) => {
    const filtered = fileList.filter(f => /\.(csv|xlsx|xls|xlsm)$/i.test(f.name));
    const bulkFiles: BulkFile[] = filtered.map(file => {
      const detected = parsePeriodFromFilename(file.name);
      const now = new Date();
      return {
        file,
        period: detected || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        periodAuto: !!detected,
        status: 'pending',
        matchedCount: 0,
        totalCount: 0,
      };
    });
    setFiles(prev => {
      // Déduplique par nom de fichier + période
      const existing = new Set(prev.map(f => `${f.file.name}|${f.period}`));
      return [...prev, ...bulkFiles.filter(f => !existing.has(`${f.file.name}|${f.period}`))];
    });
  }, []);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const updateFilePeriod = (idx: number, period: string) =>
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, period, periodAuto: false } : f));

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  // ── Traitement de tous les fichiers ──
  const processAllFiles = async () => {
    if (!userId || files.length === 0) return;
    setProcessing(true);
    setStep('processing');

    const sorted = [...files].sort((a, b) => a.period.localeCompare(b.period));
    const unmatchedMap = new Map<string, NewMemberCandidate>();
    let totalCommissions = 0;
    let doneFiles = 0;

    for (const fileState of sorted) {
      // Marquer en cours
      setFiles(prev => prev.map(f =>
        f.file.name === fileState.file.name && f.period === fileState.period
          ? { ...f, status: 'processing' } : f
      ));

      try {
        // 1. Vérifier doublon période
        const { data: existing } = await supabase
          .from('commission_imports')
          .select('id')
          .eq('user_id', userId)
          .eq('period', fileState.period)
          .maybeSingle();

        if (existing) {
          setFiles(prev => prev.map(f =>
            f.file.name === fileState.file.name && f.period === fileState.period
              ? { ...f, status: 'skipped', error: 'Import déjà existant pour cette période' } : f
          ));
          doneFiles++;
          continue;
        }

        // 2. Parser le fichier
        const buffer = await readFile(fileState.file);
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        if (json.length === 0) {
          setFiles(prev => prev.map(f =>
            f.file.name === fileState.file.name && f.period === fileState.period
              ? { ...f, status: 'skipped', error: 'Fichier vide' } : f
          ));
          doneFiles++;
          continue;
        }

        // 3. Détecter le mapping colonnes
        const columns = Object.keys(json[0]);
        const mapping = detectMapping(columns, fileState.period, settings);
        if (!mapping) {
          setFiles(prev => prev.map(f =>
            f.file.name === fileState.file.name && f.period === fileState.period
              ? { ...f, status: 'error', error: 'Colonnes non reconnues — mapping introuvable' } : f
          ));
          doneFiles++;
          continue;
        }

        // 4. Matching
        const results = runMatchingFn(json, mapping, profileName, allTreeMembers, settings);

        // 5. Collecter les non-reconnus (potentiels nouveaux membres)
        results
          .filter(r => r.match_status === 'non_reconnu' && !r.is_owner_row && r.fullName.trim())
          .forEach(r => {
            const key = normalizeStr(r.fullName);
            const { first, last } = parseTRVName(r.fullName, r.firstName, r.lastName);
            if (!unmatchedMap.has(key)) {
              unmatchedMap.set(key, {
                key, first, last,
                internalId: r.internalId,
                firstPeriod: fileState.period,
                selected: true,
                appearances: 1,
              });
            } else {
              unmatchedMap.get(key)!.appearances++;
            }
          });

        // 6. Sauvegarder l'import
        const { data: importRecord, error: importError } = await supabase
          .from('commission_imports')
          .insert({
            user_id: userId,
            file_name: fileState.file.name,
            period: fileState.period,
            column_mapping: mapping as any,
            status: 'en_cours',
          })
          .select()
          .single();

        if (importError || !importRecord) throw importError || new Error('Échec création import');

        const rows = results.map(r => ({
          import_id: importRecord.id,
          raw_data: r.raw_data as any,
          matched_member_id: r.matched_member?.id || null,
          is_owner_row: r.is_owner_row,
          match_confidence: r.match_confidence,
          match_status: r.match_status as any,
          amount: r.amount,
          details: r.fullName,
        }));
        await supabase.from('commission_import_rows').insert(rows);
        await supabase.rpc('consolidate_import_commissions', { p_import_id: importRecord.id });

        // 7. Cascade MLM (membres avec compte lié)
        const cascades: any[] = [];
        for (const r of results) {
          if (!r.matched_member || r.is_owner_row || r.match_status === 'non_reconnu') continue;
          const linkedUserId = r.matched_member.linked_user_id;
          if (linkedUserId && linkedUserId !== userId) {
            cascades.push({
              user_id: linkedUserId, type: 'directe', amount: r.amount,
              period: fileState.period, status: 'validee', source: 'import',
              team_member_id: null,
              notes: `Import réseau par ${profileName}`,
            });
          }
        }
        if (cascades.length > 0) await supabase.from('commissions').insert(cascades);

        const matched = results.filter(r => r.match_status !== 'non_reconnu');
        totalCommissions += matched.length;
        doneFiles++;

        setFiles(prev => prev.map(f =>
          f.file.name === fileState.file.name && f.period === fileState.period
            ? { ...f, status: 'done', matchedCount: matched.length, totalCount: results.length } : f
        ));

      } catch (e: any) {
        doneFiles++;
        setFiles(prev => prev.map(f =>
          f.file.name === fileState.file.name && f.period === fileState.period
            ? { ...f, status: 'error', error: e.message } : f
        ));
      }
    }

    setProcessing(false);
    onComplete(); // Invalide les queries Finance

    const candidates = Array.from(unmatchedMap.values())
      .sort((a, b) => b.appearances - a.appearances);
    setSummary({ files: doneFiles, commissions: totalCommissions, newCandidates: candidates.length });

    if (candidates.length > 0) {
      setNewMembers(candidates);
      setStep('create_members');
    } else {
      setStep('done');
    }
  };

  // ── Créer les membres sélectionnés ──
  const createSelectedMembers = async () => {
    const selected = newMembers.filter(m => m.selected);
    if (selected.length === 0) return;
    setSavingStructure(true);

    try {
      const inserts = selected.map(m => ({
        user_id: userId,
        first_name: m.first || m.last,
        last_name: m.first ? m.last : '',
        internal_id: m.internalId || null,
        level: 1,
        status: 'actif',
        joined_at: `${m.firstPeriod}-01`,
        matching_names: m.first
          ? [`${m.last.toUpperCase()} ${m.first}`, `${m.first} ${m.last}`]
          : [m.last.toUpperCase()],
      }));

      const { data: created, error } = await supabase
        .from('team_members')
        .insert(inserts)
        .select('id');
      if (error) throw error;

      const newIds = new Set((created || []).map((m: any) => m.id));

      // Recharger tous les membres pour l'écran structure
      const { data: allMembers } = await supabase
        .from('team_members')
        .select('id, first_name, last_name, level, sponsor_id')
        .eq('user_id', userId)
        .eq('status', 'actif')
        .order('first_name');

      setTeamEdits((allMembers || []).map((m: any) => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        hyla_level: (m as any).hyla_level || (m.level >= 2 ? 'manager' : 'vendeur'),
        sponsor_id: m.sponsor_id || null,
        isNew: newIds.has(m.id),
      })));

      onComplete(); // Invalide les queries équipe
      setStep('structure');

    } catch (e: any) {
      toast({ title: 'Erreur création membres', description: e.message, variant: 'destructive' });
    }
    setSavingStructure(false);
  };

  // ── Sauvegarder la structure (niveaux + sponsors) ──
  const saveStructure = async () => {
    setSavingStructure(true);
    try {
      const toUpdate = teamEdits.filter(m => m.isNew);
      for (const m of toUpdate) {
        const isManagerLevel = ['manager', 'chef_groupe', 'chef_agence', 'distributeur',
          'elite_bronze', 'elite_argent', 'elite_or'].includes(m.hyla_level);
        await supabase
          .from('team_members')
          .update({
            sponsor_id: m.sponsor_id,
            hyla_level: m.hyla_level,
            level: isManagerLevel ? 2 : 1,
          } as any)
          .eq('id', m.id);
      }
      onComplete();
      setStep('done');
    } catch (e: any) {
      toast({ title: 'Erreur sauvegarde', description: e.message, variant: 'destructive' });
    }
    setSavingStructure(false);
  };

  // ── Titre du dialog selon l'étape ──
  const stepTitle: Record<Step, string> = {
    setup: 'Import historique · multi-fichiers',
    processing: 'Traitement en cours…',
    create_members: 'Nouveaux membres détectés',
    structure: 'Structurer l\'équipe',
    done: 'Import terminé',
  };

  // Fichiers triés pour affichage
  const sortedFiles = [...files].sort((a, b) => a.period.localeCompare(b.period));

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent
        className="max-w-lg max-h-[88vh] overflow-y-auto mx-4"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-[#3b82f6]" />
            {stepTitle[step]}
          </DialogTitle>
        </DialogHeader>

        {/* ══ STEP: SETUP ══ */}
        {step === 'setup' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <FileSpreadsheet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Glissez vos fichiers TRV ici</p>
              <p className="text-xs font-semibold text-blue-500">ou cliquer pour sélectionner</p>
              <p className="text-[10px] text-muted-foreground mt-1">Sélection multiple · CSV, Excel</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,.xlsm"
                onChange={handleFilesSelect}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {files.length} fichier{files.length > 1 ? 's' : ''} — traitement chronologique
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-blue-500 underline"
                  >
                    + Ajouter
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1">
                  {sortedFiles.map((f, displayIdx) => {
                    const origIdx = files.indexOf(f);
                    return (
                      <div
                        key={`${f.file.name}-${displayIdx}`}
                        className="flex items-center gap-2 p-2.5 bg-muted rounded-xl text-xs"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate text-foreground min-w-0">{f.file.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!f.periodAuto && (
                            <AlertTriangle className="h-3 w-3 text-amber-400" title="Période non détectée automatiquement" />
                          )}
                          <input
                            type="month"
                            value={f.period}
                            onChange={e => updateFilePeriod(origIdx, e.target.value)}
                            className="text-[10px] border border-border rounded-lg px-1.5 py-1 bg-card w-28 focus:ring-1 focus:ring-blue-400"
                          />
                          <button
                            onClick={() => removeFile(origIdx)}
                            className="text-muted-foreground hover:text-red-500 ml-0.5"
                            title="Retirer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {files.some(f => !f.periodAuto) && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Période non détectée pour certains fichiers — vérifiez les dates.
                  </p>
                )}
              </div>
            )}

            {files.length > 0 && (
              <button
                onClick={processAllFiles}
                disabled={files.some(f => !f.period)}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                <Upload className="h-4 w-4" />
                Traiter {files.length} fichier{files.length > 1 ? 's' : ''} chronologiquement
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {files.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-2">
                Importez vos TRV de janvier à aujourd'hui — le système les traite dans l'ordre.
              </p>
            )}
          </div>
        )}

        {/* ══ STEP: PROCESSING ══ */}
        {step === 'processing' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Traitement des fichiers dans l'ordre chronologique…
            </p>
            {sortedFiles.map((f, i) => (
              <div
                key={`${f.file.name}-${i}`}
                className={`flex items-center gap-3 p-3 rounded-xl text-xs transition-colors ${
                  f.status === 'done' ? 'bg-green-50 dark:bg-green-950/30' :
                  f.status === 'processing' ? 'bg-blue-50 dark:bg-blue-950/30' :
                  f.status === 'error' ? 'bg-red-50 dark:bg-red-950/30' :
                  f.status === 'skipped' ? 'bg-amber-50 dark:bg-amber-950/30' :
                  'bg-muted'
                }`}
              >
                <div className="flex-shrink-0">
                  {f.status === 'done' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {f.status === 'processing' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                  {f.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                  {f.status === 'skipped' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  {f.status === 'pending' && (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    {new Date(f.period + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{f.file.name}</p>
                  {f.status === 'done' && (
                    <p className="text-[10px] text-green-600 font-medium">
                      {f.matchedCount}/{f.totalCount} commissions matchées
                    </p>
                  )}
                  {(f.status === 'skipped' || f.status === 'error') && f.error && (
                    <p className="text-[10px] text-amber-600">{f.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ STEP: CREATE_MEMBERS ══ */}
        {step === 'create_members' && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3.5">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                    {newMembers.length} personne{newMembers.length > 1 ? 's' : ''} non reconnue{newMembers.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-300 mt-0.5">
                    Ces noms apparaissent dans vos TRV mais ne sont pas encore dans votre équipe.
                    Sélectionnez ceux à créer.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {newMembers.filter(m => m.selected).length} sélectionné{newMembers.filter(m => m.selected).length > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewMembers(prev => prev.map(m => ({ ...m, selected: true })))}
                  className="text-[10px] text-blue-500 underline"
                >
                  Tout sélectionner
                </button>
                <button
                  onClick={() => setNewMembers(prev => prev.map(m => ({ ...m, selected: false })))}
                  className="text-[10px] text-muted-foreground underline"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {newMembers.map((m, i) => (
                <label
                  key={m.key}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                    m.selected ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={m.selected}
                    onChange={e => setNewMembers(prev =>
                      prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x)
                    )}
                    className="w-3.5 h-3.5 rounded accent-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">
                      {m.first ? `${m.first} ${m.last}` : m.last}
                    </span>
                    {m.internalId && (
                      <span className="text-muted-foreground ml-1.5 text-[10px]">ID: {m.internalId}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-muted-foreground">
                    <span className="text-[10px]">
                      {m.appearances > 1 ? `${m.appearances} fichiers` : '1 fichier'} · depuis {
                        new Date(m.firstPeriod + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                      }
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('done'); onComplete(); }}
                className="flex-1 py-3 bg-muted text-foreground font-semibold rounded-xl text-sm"
              >
                Ignorer
              </button>
              <button
                onClick={createSelectedMembers}
                disabled={newMembers.filter(m => m.selected).length === 0 || savingStructure}
                className="flex-[2] py-3 bg-[#3b82f6] text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingStructure ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Création…</>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Créer {newMembers.filter(m => m.selected).length} membre{newMembers.filter(m => m.selected).length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: STRUCTURE ══ */}
        {step === 'structure' && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3.5">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-800 dark:text-green-200">
                  <strong>{teamEdits.filter(m => m.isNew).length} membres créés.</strong>{' '}
                  Définissez leur niveau Hyla et leur responsable direct.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
              {teamEdits.filter(m => m.isNew).map((m) => {
                const editIdx = teamEdits.findIndex(x => x.id === m.id);
                const existingMembers = teamEdits.filter(x => !x.isNew);
                return (
                  <div key={m.id} className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-3 space-y-2.5">
                    <p className="text-xs font-semibold text-foreground">
                      {m.first_name} {m.last_name}
                      <span className="ml-2 text-[10px] font-normal text-blue-500 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded-full">Nouveau</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Niveau Hyla</p>
                        <select
                          value={m.hyla_level}
                          onChange={e => setTeamEdits(prev =>
                            prev.map((x, j) => j === editIdx ? { ...x, hyla_level: e.target.value } : x)
                          )}
                          className="w-full text-[11px] border border-border rounded-lg px-2 py-1.5 bg-card focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        >
                          {HYLA_LEVELS.map(l => (
                            <option key={l.value} value={l.value}>{l.shortLabel}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Responsable direct</p>
                        <select
                          value={m.sponsor_id || ''}
                          onChange={e => setTeamEdits(prev =>
                            prev.map((x, j) => j === editIdx ? { ...x, sponsor_id: e.target.value || null } : x)
                          )}
                          className="w-full text-[11px] border border-border rounded-lg px-2 py-1.5 bg-card focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        >
                          <option value="">Vous directement</option>
                          {/* D'abord les managers existants, puis les autres */}
                          {existingMembers
                            .sort((a, b) => {
                              const isManagerA = a.hyla_level !== 'vendeur';
                              const isManagerB = b.hyla_level !== 'vendeur';
                              if (isManagerA && !isManagerB) return -1;
                              if (!isManagerA && isManagerB) return 1;
                              return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
                            })
                            .map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.first_name} {tm.last_name}
                                {tm.hyla_level !== 'vendeur' ? ` (${HYLA_LEVELS.find(l => l.value === tm.hyla_level)?.shortLabel || 'Manager'})` : ''}
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {teamEdits.filter(m => m.isNew).length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">Aucun nouveau membre à structurer.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('done'); onComplete(); }}
                className="flex-1 py-3 bg-muted text-foreground font-semibold rounded-xl text-sm"
              >
                Ignorer
              </button>
              <button
                onClick={saveStructure}
                disabled={savingStructure}
                className="flex-[2] py-3.5 bg-[#3b82f6] text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingStructure ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
                ) : (
                  <><Network className="h-4 w-4" /> Enregistrer la structure</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: DONE ══ */}
        {step === 'done' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-base text-foreground">Import terminé !</p>
              <p className="text-sm text-muted-foreground mt-1">
                {sortedFiles.filter(f => f.status === 'done').length} mois importés
                {summary.commissions > 0 && ` · ${summary.commissions} commissions`}
              </p>
              {sortedFiles.filter(f => f.status === 'skipped').length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {sortedFiles.filter(f => f.status === 'skipped').length} fichier(s) ignoré(s) — import déjà existant
                </p>
              )}
              {sortedFiles.filter(f => f.status === 'error').length > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {sortedFiles.filter(f => f.status === 'error').length} fichier(s) en erreur
                </p>
              )}
            </div>
            <button
              onClick={() => resetAndClose(false)}
              className="w-full py-3.5 bg-[#3b82f6] text-white font-semibold rounded-xl text-sm"
            >
              Fermer
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
