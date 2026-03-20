import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type LeadStatus = 'NOUVEAU' | 'EN_COURS' | 'CONTACT' | 'DEVIS_ENVOYE' | 'SIGNATURE' | 'SIGNE' | 'REFUSE' | 'PERDU';
export type ContractType = 'emprunteur' | 'prevoyance' | 'rc_pro' | 'sante' | 'decennale';
export type PartnerType = 'professional' | 'private';

export interface Lead {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  notes_partner: string | null;
  consent_confirmed: boolean;
  consent_timestamp: string | null;
  consent_text_version: string | null;
  consent_document_url: string | null;
  contract_type: ContractType | null;
  status: LeadStatus;
  annual_premium_estimated: number | null;
  annual_premium_final: number | null;
  commission_estimated: number | null;
  commission_final: number | null;
  admin_notes: string | null;
  lost_reason: string | null;
  montant: number | null;
  banque: string | null;
  type_projet: string | null;
  is_paid: boolean;
  paid_at: string | null;
  paiement_compagnie_recu: boolean;
  payment_reference: string | null;
  frais_courtage: number | null;
  frais_courtage_mode: 'fixe' | 'etale' | null;
  frais_courtage_mois: number | null;
  savings_achieved: number | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  is_active: boolean;
  partner_type: PartnerType;
  invite_code: string;
  invite_expires_at: string;
  invite_used_at: string | null;
  created_at: string;
}

export interface CommissionRate {
  id: string;
  partner_id: string;
  contract_type: ContractType;
  rate_percent: number;
  created_at: string;
  updated_at: string;
}

export interface TierRule {
  id: string;
  tier_name: string;
  min_signed: number;
  max_signed: number | null;
  rate_percent: number;
  created_at: string;
}

export interface PartnerTier {
  tier_name: string;
  rate_percent: number;
  signed_count: number;
  min_signed: number;
  max_signed: number | null;
}

export interface PartnerDocument {
  id: string;
  partner_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  lead_id: string | null;
  created_at: string;
}

export interface LeadEvent {
  id: string;
  lead_id: string;
  event_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export type UserRole = 'admin' | 'partner';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  CONTACT: 'Contact',
  DEVIS_ENVOYE: 'Devis envoyé',
  SIGNATURE: 'Signature',
  SIGNE: 'Signé',
  REFUSE: 'Refusé',
  PERDU: 'Perdu',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  NOUVEAU: 'status-nouveau',
  EN_COURS: 'status-en-cours',
  CONTACT: 'status-contact',
  DEVIS_ENVOYE: 'status-devis-envoye',
  SIGNATURE: 'status-signature',
  SIGNE: 'status-signe',
  REFUSE: 'status-refuse',
  PERDU: 'status-perdu',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  emprunteur: 'Emprunteur',
  prevoyance: 'Prévoyance',
  rc_pro: 'RC Pro',
  sante: 'Santé',
  decennale: 'Décennale',
};

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  professional: 'Professionnel',
  private: 'Particulier',
};

export const STATUS_ORDER: LeadStatus[] = ['NOUVEAU', 'EN_COURS', 'DEVIS_ENVOYE', 'SIGNATURE', 'SIGNE', 'REFUSE', 'PERDU'];
