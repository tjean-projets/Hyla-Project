-- Add input validation constraints to leads table
-- These constraints provide server-side validation for all lead inputs

-- First name: must be non-empty and max 100 chars
ALTER TABLE public.leads
  ADD CONSTRAINT leads_first_name_length 
  CHECK (length(first_name) > 0 AND length(first_name) <= 100);

-- Last name: must be non-empty and max 100 chars  
ALTER TABLE public.leads
  ADD CONSTRAINT leads_last_name_length 
  CHECK (length(last_name) > 0 AND length(last_name) <= 100);

-- Phone: must be between 10-20 chars (handles international formats)
ALTER TABLE public.leads
  ADD CONSTRAINT leads_phone_length 
  CHECK (length(phone) >= 10 AND length(phone) <= 20);

-- Email: optional but must be valid format if provided
ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_format 
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Partner notes: optional but max 2000 chars
ALTER TABLE public.leads
  ADD CONSTRAINT leads_notes_partner_length 
  CHECK (notes_partner IS NULL OR length(notes_partner) <= 2000);

-- Admin notes: optional but max 2000 chars
ALTER TABLE public.leads
  ADD CONSTRAINT leads_admin_notes_length 
  CHECK (admin_notes IS NULL OR length(admin_notes) <= 2000);