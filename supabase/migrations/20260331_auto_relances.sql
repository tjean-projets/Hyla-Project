-- Function to auto-generate relance tasks for inactive prospects
-- Call this periodically (e.g., on dashboard load) to create tasks
-- for contacts not contacted in the last N days

CREATE OR REPLACE FUNCTION generate_relance_tasks(
  p_user_id UUID,
  p_days_threshold INT DEFAULT 7
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  rec RECORD;
BEGIN
  -- Find prospects/recrues not contacted recently and without an existing pending relance task
  FOR rec IN
    SELECT c.id AS contact_id, c.first_name, c.last_name
    FROM contacts c
    WHERE c.user_id = p_user_id
      AND c.status IN ('prospect', 'recrue')
      AND (
        c.last_contacted_at IS NULL
        OR c.last_contacted_at < NOW() - (p_days_threshold || ' days')::interval
      )
      -- No existing pending relance task for this contact
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.contact_id = c.id
          AND t.user_id = p_user_id
          AND t.type = 'relance'
          AND t.status IN ('a_faire', 'en_cours')
      )
  LOOP
    INSERT INTO tasks (user_id, contact_id, title, type, status, due_date, auto_generated)
    VALUES (
      p_user_id,
      rec.contact_id,
      'Relancer ' || rec.first_name || ' ' || rec.last_name,
      'relance',
      'a_faire',
      NOW() + interval '1 day',
      true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
