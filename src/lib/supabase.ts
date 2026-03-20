import { supabase } from "@/integrations/supabase/client";

export { supabase };

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
