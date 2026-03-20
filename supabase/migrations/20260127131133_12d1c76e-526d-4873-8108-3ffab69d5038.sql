-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'partner');

-- Create user_roles table (required for proper role management)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create partners table
CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    invite_code TEXT UNIQUE NOT NULL,
    invite_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    invite_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Create lead_status enum
CREATE TYPE public.lead_status AS ENUM ('RECU', 'CONTACTE', 'DEVIS', 'SIGNE', 'PERDU');

-- Create leads table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    
    -- Prospect info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes_partner TEXT,
    
    -- Consent
    consent_confirmed BOOLEAN NOT NULL DEFAULT false,
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    consent_text_version TEXT DEFAULT 'checkbox_v1',
    
    -- Status & pricing
    status lead_status NOT NULL DEFAULT 'RECU',
    annual_premium_estimated NUMERIC,
    annual_premium_final NUMERIC,
    commission_estimated NUMERIC,
    commission_final NUMERIC,
    
    -- Admin fields
    admin_notes TEXT,
    lost_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create lead_events table (audit trail)
CREATE TABLE public.lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on lead_events
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- Function to get partner_id for current user
CREATE OR REPLACE FUNCTION public.get_partner_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.partners WHERE user_id = _user_id LIMIT 1
$$;

-- Partners RLS policies
CREATE POLICY "Partners can view their own profile"
ON public.partners FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all partners"
ON public.partners FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage partners"
ON public.partners FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view partners by invite code"
ON public.partners FOR SELECT
USING (invite_code IS NOT NULL);

-- Leads RLS policies
CREATE POLICY "Partners can view their own leads"
ON public.leads FOR SELECT
USING (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can insert their own leads"
ON public.leads FOR INSERT
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Partners can update limited fields on their leads"
ON public.leads FOR UPDATE
USING (partner_id = public.get_partner_id_for_user(auth.uid()))
WITH CHECK (partner_id = public.get_partner_id_for_user(auth.uid()));

CREATE POLICY "Admins can view all leads"
ON public.leads FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all leads"
ON public.leads FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Lead events RLS policies
CREATE POLICY "Partners can view events for their leads"
ON public.lead_events FOR SELECT
USING (
  lead_id IN (
    SELECT id FROM public.leads WHERE partner_id = public.get_partner_id_for_user(auth.uid())
  )
);

CREATE POLICY "Partners can insert events for their leads"
ON public.lead_events FOR INSERT
WITH CHECK (
  lead_id IN (
    SELECT id FROM public.leads WHERE partner_id = public.get_partner_id_for_user(auth.uid())
  )
);

CREATE POLICY "Admins can view all events"
ON public.lead_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all events"
ON public.lead_events FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at on leads
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-calculate commission when premium is set
CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate estimated commission (40% of estimated premium)
    IF NEW.annual_premium_estimated IS NOT NULL THEN
        NEW.commission_estimated = NEW.annual_premium_estimated * 0.40;
    END IF;
    
    -- Calculate final commission (40% of final premium)
    IF NEW.annual_premium_final IS NOT NULL THEN
        NEW.commission_final = NEW.annual_premium_final * 0.40;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculate_lead_commission
    BEFORE INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_commission();

-- Trigger to create audit events on lead changes
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.lead_events (lead_id, event_type, new_value, created_by)
        VALUES (NEW.id, 'CREATED', to_jsonb(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log status change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'STATUS_CHANGE', jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status), auth.uid());
        END IF;
        
        -- Log premium changes
        IF OLD.annual_premium_estimated IS DISTINCT FROM NEW.annual_premium_estimated THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'PREMIUM_ESTIMATED_CHANGE', jsonb_build_object('annual_premium_estimated', OLD.annual_premium_estimated), jsonb_build_object('annual_premium_estimated', NEW.annual_premium_estimated), auth.uid());
        END IF;
        
        IF OLD.annual_premium_final IS DISTINCT FROM NEW.annual_premium_final THEN
            INSERT INTO public.lead_events (lead_id, event_type, old_value, new_value, created_by)
            VALUES (NEW.id, 'PREMIUM_FINAL_CHANGE', jsonb_build_object('annual_premium_final', OLD.annual_premium_final), jsonb_build_object('annual_premium_final', NEW.annual_premium_final), auth.uid());
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_lead_changes_trigger
    AFTER INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.log_lead_changes();