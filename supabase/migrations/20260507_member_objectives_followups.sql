-- Ajoute les dates de suivi sur les objectifs membres.
--
-- Le manager fixe une date de départ (start_date). Le système calcule
-- automatiquement follow_up_1mo_at (= start_date + 1 mois) et
-- follow_up_3mo_at (= start_date + 3 mois) — utilisés côté UI pour
-- rappeler au manager de faire le point, et côté membre pour situer
-- l'échéance.

ALTER TABLE member_objectives
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_1mo_at DATE,
  ADD COLUMN IF NOT EXISTS follow_up_3mo_at DATE,
  ADD COLUMN IF NOT EXISTS follow_up_1mo_done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_3mo_done_at TIMESTAMPTZ;

-- Trigger : auto-calcul des dates de rappel à partir de start_date
CREATE OR REPLACE FUNCTION member_objectives_compute_followups()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.start_date IS NOT NULL THEN
    NEW.follow_up_1mo_at := NEW.start_date + INTERVAL '1 month';
    NEW.follow_up_3mo_at := NEW.start_date + INTERVAL '3 months';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_objectives_followups ON member_objectives;
CREATE TRIGGER member_objectives_followups
  BEFORE INSERT OR UPDATE OF start_date ON member_objectives
  FOR EACH ROW EXECUTE FUNCTION member_objectives_compute_followups();
