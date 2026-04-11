import { supabase } from "@/integrations/supabase/client";

export { supabase };

// ── Super Admin ──
export const SUPER_ADMIN_EMAILS = ['thomas.jean28@outlook.fr', 't.jean@360courtage.fr'];

export function isSuperAdmin(email?: string | null): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

// ── Contact statuses ──
export type ContactStatus = 'prospect' | 'cliente' | 'recrue' | 'inactive' | 'perdue';

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  prospect: 'Prospect',
  cliente: 'Cliente',
  recrue: 'Recrue',
  inactive: 'Inactive',
  perdue: 'Perdue',
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  prospect: 'bg-blue-100 text-blue-800',
  cliente: 'bg-green-100 text-green-800',
  recrue: 'bg-purple-100 text-purple-800',
  inactive: 'bg-gray-100 text-gray-600',
  perdue: 'bg-red-100 text-red-800',
};

// ── Deal statuses ──
export type DealStatus = 'en_cours' | 'signee' | 'annulee' | 'en_attente' | 'livree';

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  en_cours: 'En cours',
  signee: 'Signée',
  annulee: 'Annulée',
  en_attente: 'En attente',
  livree: 'Livrée',
};

export const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  en_cours: 'bg-blue-100 text-blue-800',
  signee: 'bg-green-100 text-green-800',
  annulee: 'bg-red-100 text-red-800',
  en_attente: 'bg-amber-100 text-amber-800',
  livree: 'bg-teal-100 text-teal-800',
};

// ── Task types & statuses ──
export type TaskType = 'relance' | 'rdv' | 'demo' | 'suivi' | 'admin' | 'autre';
export type TaskStatus = 'a_faire' | 'en_cours' | 'terminee' | 'annulee';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  relance: 'Relance',
  rdv: 'Rendez-vous',
  demo: 'Démonstration',
  suivi: 'Suivi',
  admin: 'Administratif',
  autre: 'Autre',
};

export type TaskTypeExtended = TaskType | 'formation' | 'contenu' | 'livraison';

export const TASK_TYPE_LABELS_HYLA: Record<string, string> = {
  relance: 'Relance',
  rdv: 'Rendez-vous',
  demo: 'Démonstration Hyla',
  suivi: 'Suivi client',
  admin: 'Administratif',
  formation: 'Formation',
  contenu: 'Contenu réseaux',
  livraison: 'Livraison',
  autre: 'Autre',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

// ── Appointment types ──
export type AppointmentType = 'rdv' | 'demo' | 'suivi' | 'recrutement';
export type AppointmentStatus = 'planifie' | 'realise' | 'annule' | 'reporte';

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  rdv: 'Rendez-vous',
  demo: 'Démonstration',
  suivi: 'Suivi',
  recrutement: 'Recrutement',
};

// ── Commission types ──
export type CommissionType = 'directe' | 'reseau';
export type CommissionStatus = 'detectee' | 'validee' | 'en_attente' | 'non_reconnue';

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  directe: 'Directe',
  reseau: 'Réseau',
};

// ── Import statuses ──
export type ImportStatus = 'en_cours' | 'traite' | 'partiel' | 'erreur';

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  en_cours: 'En cours',
  traite: 'Traité',
  partiel: 'Partiel',
  erreur: 'Erreur',
};

export const IMPORT_STATUS_COLORS: Record<ImportStatus, string> = {
  en_cours: 'bg-blue-100 text-blue-800',
  traite: 'bg-green-100 text-green-800',
  partiel: 'bg-amber-100 text-amber-800',
  erreur: 'bg-red-100 text-red-800',
};

// ── Barème Hyla ──

// Commissions ventes personnelles — échelle glissante par vente dans le mois
// (les valeurs cumulées sont calculées dynamiquement par getHylaCommission)
export const HYLA_COMMISSION_SCALE = [
  { machines: 1, commission: 300,  label: '1 vente' },
  { machines: 2, commission: 650,  label: '2 ventes' },   // 300+350
  { machines: 3, commission: 1050, label: '3 ventes' },   // 650+400
  { machines: 4, commission: 1500, label: '4 ventes' },   // 1050+450
  { machines: 5, commission: 1950, label: '5 ventes' },   // 1500+450
  { machines: 6, commission: 2400, label: '6 ventes' },   // 1950+450
  { machines: 7, commission: 2850, label: '7 ventes' },   // 2400+450
  { machines: 8, commission: 3350, label: '8 ventes' },   // 2850+500
];

/** Retourne la commission cumulée estimée pour N ventes perso dans le mois */
export function getHylaCommission(machinesSold: number): number {
  if (machinesSold <= 0) return 0;
  // Calcul exact via l'échelle glissante
  let total = 0;
  for (let i = 1; i <= machinesSold; i++) {
    total += i === 1 ? 300 : i === 2 ? 350 : i === 3 ? 400 : i <= 7 ? 450 : 500;
  }
  return total;
}

/** Commission pour la Nième vente perso du mois (échelle glissante) */
export function getPersonalSaleCommission(rank: number): number {
  if (rank <= 1) return 300;
  if (rank === 2) return 350;
  if (rank === 3) return 400;
  if (rank <= 7) return 450;
  return 500;
}

// ── 6 niveaux Hyla + Elite en 3 sous-niveaux ──
export type HylaLevel =
  | 'vendeur'
  | 'manager'
  | 'chef_groupe'
  | 'chef_agence'
  | 'distributeur'
  | 'elite_bronze'
  | 'elite_argent'
  | 'elite_or';

export const HYLA_LEVELS: {
  value: HylaLevel;
  label: string;
  shortLabel: string;
  recruteCommission: number;   // €/vente de recrue directe
  quotaMois: number;           // ventes perso requises/mois pour la prime groupe
  conditions: string;
  color: string;
}[] = [
  {
    value: 'vendeur',
    label: 'Vendeur commerçant',
    shortLabel: 'Vendeur',
    recruteCommission: 100,
    quotaMois: 0,
    conditions: 'Aucune condition — niveau de départ',
    color: 'from-slate-400 to-slate-500',
  },
  {
    value: 'manager',
    label: 'Manager',
    shortLabel: 'Manager',
    recruteCommission: 120,
    quotaMois: 15,
    conditions: '3 vendeurs directs actifs minimum',
    color: 'from-pink-500 to-rose-400',
  },
  {
    value: 'chef_groupe',
    label: 'Chef de groupe',
    shortLabel: 'Chef groupe',
    recruteCommission: 140,
    quotaMois: 30,
    conditions: '4 vendeurs directs + 1 indirect actifs min.',
    color: 'from-orange-500 to-amber-400',
  },
  {
    value: 'chef_agence',
    label: "Chef d'agence",
    shortLabel: "Chef d'agence",
    recruteCommission: 160,
    quotaMois: 60,
    conditions: "4 vendeurs directs + 1 lignée (manager) min.",
    color: 'from-yellow-500 to-amber-400',
  },
  {
    value: 'distributeur',
    label: 'Distributeur',
    shortLabel: 'Distributeur',
    recruteCommission: 180,
    quotaMois: 90,
    conditions: '2 lignées (managers) minimum',
    color: 'from-emerald-500 to-green-400',
  },
  {
    value: 'elite_bronze',
    label: 'Elite Manager Bronze',
    shortLabel: 'Elite Bronze',
    recruteCommission: 200,
    quotaMois: 120,
    conditions: '3 lignées (managers) minimum',
    color: 'from-amber-700 to-amber-600',
  },
  {
    value: 'elite_argent',
    label: 'Elite Manager Argent',
    shortLabel: 'Elite Argent',
    recruteCommission: 225,
    quotaMois: 120,
    conditions: '3 lignées min. • qualification Elite Bronze/Argent',
    color: 'from-slate-400 to-slate-300',
  },
  {
    value: 'elite_or',
    label: 'Elite Manager Or',
    shortLabel: 'Elite Or',
    recruteCommission: 250,
    quotaMois: 120,
    conditions: '3 lignées min. • qualification Elite Or',
    color: 'from-yellow-400 to-yellow-300',
  },
];

/** Retourne la commission recrue directe pour un niveau donné */
export function getRecrueCommission(level: HylaLevel | string): number {
  return HYLA_LEVELS.find(l => l.value === level)?.recruteCommission ?? 120;
}

/** Retourne la prime de gestion de groupe (€/machine/mois) selon niveau + volume équipe */
export function getGroupPrime(level: HylaLevel | string, teamSalesCount: number): number {
  if (teamSalesCount < 15) return 0;
  type Range = { min: number; max: number | null; prime: number };
  const ranges: Record<string, Range[]> = {
    manager:     [{ min: 15, max: 29, prime: 30 }, { min: 30, max: null, prime: 50 }],
    chef_groupe: [{ min: 15, max: 29, prime: 30 }, { min: 30, max: null, prime: 50 }],
    chef_agence: [{ min: 15, max: 29, prime: 30 }, { min: 30, max: 59, prime: 50 }, { min: 60, max: null, prime: 70 }],
    distributeur:[{ min: 15, max: 29, prime: 30 }, { min: 30, max: 59, prime: 50 }, { min: 60, max: 89, prime: 70 }, { min: 90, max: null, prime: 85 }],
    elite:       [{ min: 15, max: 29, prime: 30 }, { min: 30, max: 59, prime: 50 }, { min: 60, max: 89, prime: 70 }, { min: 90, max: 119, prime: 85 }, { min: 120, max: null, prime: 100 }],
  };
  const key = level.startsWith('elite_') ? 'elite' : (level as string);
  const levelRanges = ranges[key];
  if (!levelRanges) return 0;
  for (let i = levelRanges.length - 1; i >= 0; i--) {
    if (teamSalesCount >= levelRanges[i].min) return levelRanges[i].prime;
  }
  return 0;
}

/** Commission réseau (legacy — garde la rétrocompatibilité) */
export const HYLA_NETWORK_COMMISSION = {
  conseillere: { recrue_directe: 100, reseau: 0 },
  manager:     { recrue_directe: 120, reseau: 30 },
};

// Challenges
export const HYLA_CHALLENGES = {
  countdown: { name: 'Compte à Rebours Online', months: 2, target: 5, bonus: 800 },
  rookie:    { name: 'Rookie Online',            months: 6, target: 15, bonus: 1000 },
};

// Produits Hyla
export const HYLA_PRODUCTS = [
  { label: 'Hyla GST (Machine)', price: null },
  { label: 'Pack Nimbus (Shampouineuse)', price: null },
  { label: 'Pack Hygiène', price: null },
  { label: 'Electrobrosse Ventus', price: null },
  { label: 'Kit Vitres', price: null },
  { label: 'Pack Animaux', price: null },
  { label: 'Autre', price: null },
];

// Niveaux réseau Hyla (legacy — garde la rétrocompatibilité avec NetworkPage)
export const HYLA_NETWORK_TIERS = [
  { min: 0, label: 'Vendeur commerçant', description: '100€/vente recrue directe' },
  { min: 3, label: 'Manager', description: '3 vendeurs directs • 120€/vente recrue • prime groupe dès 15 ventes équipe' },
  { min: 4, label: 'Chef de groupe', description: '4 vendeurs directs • 140€/vente recrue' },
  { min: 5, label: "Chef d'agence", description: "4 vendeurs + 1 lignée • 160€/vente recrue" },
  { min: 6, label: 'Distributeur', description: '2 lignées • 180€/vente recrue' },
  { min: 7, label: 'Elite Manager', description: '3 lignées • 200-250€/vente recrue' },
];

// ── Partner / Lead types (360courtage) ──

export type LeadStatus = 'NOUVEAU' | 'CONTACT' | 'DEVIS_ENVOYE' | 'EN_COURS' | 'SIGNATURE' | 'SIGNE' | 'REFUSE' | 'PERDU';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NOUVEAU: 'Nouveau',
  CONTACT: 'Contacté',
  DEVIS_ENVOYE: 'Devis envoyé',
  EN_COURS: 'En cours',
  SIGNATURE: 'Signature',
  SIGNE: 'Signé',
  REFUSE: 'Refusé',
  PERDU: 'Perdu',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  NOUVEAU: 'bg-blue-100 text-blue-700',
  CONTACT: 'bg-cyan-100 text-cyan-700',
  DEVIS_ENVOYE: 'bg-amber-100 text-amber-700',
  EN_COURS: 'bg-yellow-100 text-yellow-700',
  SIGNATURE: 'bg-indigo-100 text-indigo-700',
  SIGNE: 'bg-green-100 text-green-700',
  REFUSE: 'bg-red-100 text-red-700',
  PERDU: 'bg-gray-100 text-gray-600',
};

export type ContractType = 'assurance_emprunteur' | 'prevoyance' | 'mutuelle' | 'auto' | 'habitation' | 'pret_immobilier' | 'autre';

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  assurance_emprunteur: 'Assurance Emprunteur',
  prevoyance: 'Prévoyance',
  mutuelle: 'Mutuelle',
  auto: 'Auto',
  habitation: 'Habitation',
  pret_immobilier: 'Prêt Immobilier',
  autre: 'Autre',
};

export interface Lead {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  status: LeadStatus;
  contract_type: ContractType;
  commission_estimated: number | null;
  commission_final: number | null;
  savings_achieved: number | null;
  paiement_compagnie_recu: boolean;
  is_paid: boolean;
  montant: number | null;
  banque: string | null;
  type_projet: string | null;
  notes_partner: string | null;
  created_at: string;
  updated_at: string;
}

export type PartnerType = 'professional' | 'individual';

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  professional: 'Professionnel',
  individual: 'Particulier',
};

export interface Partner {
  id: string;
  display_name: string;
  created_at: string;
}

export interface TierRule {
  id: string;
  min_signed: number;
  max_signed: number | null;
  rate_percent: number;
  tier_name?: string;
}

export interface PartnerTier {
  rate_percent: number;
  signed_count: number;
  tier_name: string;
}

export interface PartnerDocument {
  id: string;
  partner_id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  validation_status: 'pending' | 'validated' | 'rejected';
  created_at: string;
}

export interface LeadEvent {
  id: string;
  event_type: 'CREATED' | 'STATUS_CHANGE' | 'PREMIUM_ESTIMATED_CHANGE' | 'PREMIUM_FINAL_CHANGE';
  new_value: Record<string, string>;
  created_at: string;
}

// ── Priority ──
export type ContactPriority = 'basse' | 'normale' | 'haute' | 'urgente';

export const PRIORITY_LABELS: Record<ContactPriority, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
};

export const PRIORITY_COLORS: Record<ContactPriority, string> = {
  basse: 'bg-gray-100 text-gray-600',
  normale: 'bg-blue-100 text-blue-700',
  haute: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};
