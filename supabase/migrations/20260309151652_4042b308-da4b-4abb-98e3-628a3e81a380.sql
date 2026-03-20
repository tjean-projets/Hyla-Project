
-- Fix overly permissive insert policy - restrict to triggers/system only via security definer functions
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Allow admins to insert notifications (for manual notifications)
-- Regular inserts come from SECURITY DEFINER triggers which bypass RLS
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
