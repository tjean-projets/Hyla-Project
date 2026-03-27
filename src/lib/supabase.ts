import { supabase } from "@/integrations/supabase/client";

export { supabase };

// ── Super Admin ──
export const SUPER_ADMIN_EMAILS = ['thomas.jean28@outlook.fr', 't.jean@360courtage.fr'];

export function isSuperAdmin(email?: string | null): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

// ── Contact statuses ──
export type ContactStatus = 'prospect' | 'cliente' | 'recrue' | 'inactive' | 'perdue' | 'partenaire';

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  prospect: 'Prospect',
  cliente: 'Cliente',
  recrue: 'Recrue',
  inactive: 'Inactive',
  perdue: 'Perdue',
  partenaire: 'Partenaire',
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  prospect: 'bg-blue-100 text-blue-800',
  cliente: 'bg-green-100 text-green-800',
  recrue: 'bg-purple-100 text-purple-800',
  inactive: 'bg-gray-100 text-gray-600',
  perdue: 'bg-red-100 text-red-800',
  partenaire: 'bg-amber-100 text-amber-800',
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
// Commissions ventes personnelles (paliers par mois)
export const HYLA_COMMISSION_SCALE = [
  { machines: 1, commission: 300, label: '1 Hyla' },
  { machines: 2, commission: 700, label: '2 Hyla' },
  { machines: 3, commission: 1200, label: '3 Hyla' },
  { machines: 4, commission: 1800, label: '4 Hyla' },
  { machines: 6, commission: 2700, label: '6 Hyla' },
  { machines: 8, commission: 4000, label: '8 Hyla' },
];

// Commission réseau
export const HYLA_NETWORK_COMMISSION = {
  recrue_directe: 120, // € par vente d'une recrue directe (Manager)
  reseau: 30,          // € par toutes les ventes du réseau
};

// Challenges
export const HYLA_CHALLENGES = {
  countdown: { name: 'Compte à Rebours Online', duration: '2 mois', target: 5, bonus: 800 },
  rookie: { name: 'Rookie Online', duration: '6 mois', target: 15, bonus: 1000 },
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

// Niveaux réseau Hyla
export const HYLA_NETWORK_TIERS = [
  { min: 0, label: 'Conseillère', description: 'Recommande le Hyla autour de soi • 100€/vente recrue directe' },
  { min: 4, label: 'Manager', description: '4+ partenaires • 120€/vente recrue directe • 30€/vente réseau' },
];

export function getHylaCommission(machinesSold: number): number {
  const scale = [...HYLA_COMMISSION_SCALE].reverse();
  for (const s of scale) {
    if (machinesSold >= s.machines) return s.commission;
  }
  return 0;
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
