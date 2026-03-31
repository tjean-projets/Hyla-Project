-- Recreate notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'success', 'warning', 'error', 'info'
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_link);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: notify when a commission is created for a user
CREATE OR REPLACE FUNCTION notify_commission_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'Commission reçue',
    'Nouvelle commission de ' || NEW.amount || '€ (' || NEW.type || ') pour ' || NEW.period,
    'success',
    '/commissions'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_commission ON commissions;
CREATE TRIGGER tr_notify_commission
  AFTER INSERT ON commissions
  FOR EACH ROW
  WHEN (NEW.status = 'validee')
  EXECUTE FUNCTION notify_commission_created();

-- Trigger: notify manager when a team member signs up (linked_user_id set)
CREATE OR REPLACE FUNCTION notify_member_signed_up()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.linked_user_id IS NOT NULL AND (OLD.linked_user_id IS NULL OR OLD.linked_user_id != NEW.linked_user_id) THEN
    PERFORM create_notification(
      NEW.user_id,
      'Nouveau membre inscrit !',
      NEW.first_name || ' ' || NEW.last_name || ' a créé son compte Hyla Assistant',
      'success',
      '/network'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_member_signup ON team_members;
CREATE TRIGGER tr_notify_member_signup
  AFTER UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_member_signed_up();

-- Trigger: notify when import is completed
CREATE OR REPLACE FUNCTION notify_import_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'traite' AND (OLD.status IS NULL OR OLD.status != 'traite') THEN
    PERFORM create_notification(
      NEW.user_id,
      'Import terminé',
      'L''import "' || NEW.file_name || '" a été traité avec succès',
      'info',
      '/finance'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_import ON commission_imports;
CREATE TRIGGER tr_notify_import
  AFTER UPDATE ON commission_imports
  FOR EACH ROW
  EXECUTE FUNCTION notify_import_completed();
