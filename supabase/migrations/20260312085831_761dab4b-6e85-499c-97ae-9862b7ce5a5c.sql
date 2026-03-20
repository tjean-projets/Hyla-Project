
-- Step 1: Add new enum values
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'NOUVEAU';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'EN_COURS';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'DEVIS_ENVOYE';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'PERDU';
