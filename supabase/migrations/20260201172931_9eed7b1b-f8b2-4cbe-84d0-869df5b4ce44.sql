-- ============================================
-- CORRECTION DES POLICIES RLS - RESTRICTIVE vs PERMISSIVE
-- ============================================
-- Le problème: toutes les policies sont RESTRICTIVE mais sans policy PERMISSIVE de base
-- Les policies RESTRICTIVE ne limitent QUE les accès déjà accordés par PERMISSIVE
-- Solution: Recréer les policies en mode PERMISSIVE (comportement par défaut)

-- ==========================================
-- TABLE: leads
-- ==========================================

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Partners can insert their own leads" ON public.leads;
DROP POLICY IF EXISTS "Partners can update limited fields on their leads" ON public.leads;
DROP POLICY IF EXISTS "Partners can view their own leads" ON public.leads;

-- Recréer en mode PERMISSIVE (par défaut)
CREATE POLICY "Admins can manage all leads" 
ON public.leads 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view their own leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can insert their own leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can update their own leads" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (partner_id = public.get_partner_id_for_user(auth.uid()))
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

-- ==========================================
-- TABLE: partners
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
DROP POLICY IF EXISTS "Admins can view all partners" ON public.partners;
DROP POLICY IF EXISTS "Partners can view their own profile" ON public.partners;

CREATE POLICY "Admins can manage partners" 
ON public.partners 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view their own profile" 
ON public.partners 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: lead_events
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage all events" ON public.lead_events;
DROP POLICY IF EXISTS "Admins can view all events" ON public.lead_events;
DROP POLICY IF EXISTS "Partners can insert events for their leads" ON public.lead_events;
DROP POLICY IF EXISTS "Partners can view events for their leads" ON public.lead_events;

CREATE POLICY "Admins can manage all events" 
ON public.lead_events 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Partners can view events for their leads" 
ON public.lead_events 
FOR SELECT 
TO authenticated
USING (lead_id IN (
  SELECT id FROM public.leads 
  WHERE partner_id = public.get_partner_id_for_user(auth.uid())
));

CREATE POLICY "Partners can insert events for their leads" 
ON public.lead_events 
FOR INSERT 
TO authenticated
WITH CHECK (lead_id IN (
  SELECT id FROM public.leads 
  WHERE partner_id = public.get_partner_id_for_user(auth.uid())
));

-- ==========================================
-- TABLE: user_roles
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);