-- ============================================================
-- Sondages / polls sociaux partageables via lien
-- ============================================================

CREATE TABLE IF NOT EXISTS social_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  -- questions: [{ id: string, text: string, type: 'choice'|'text', choices?: string[] }]
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES social_surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  -- answers: { [questionId]: string }
  respondent_name TEXT,
  respondent_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_surveys_user ON social_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_social_survey_responses_survey ON social_survey_responses(survey_id);

-- RLS
ALTER TABLE social_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_survey_responses ENABLE ROW LEVEL SECURITY;

-- Authentifié : CRUD ses propres sondages
CREATE POLICY "auth_all_surveys" ON social_surveys
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Anonyme : consulter les sondages actifs (pour la page publique)
CREATE POLICY "anon_view_active_surveys" ON social_surveys
  FOR SELECT TO anon
  USING (is_active = true);

-- Anonyme : soumettre une réponse
CREATE POLICY "anon_insert_responses" ON social_survey_responses
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authentifié : voir les réponses à ses sondages
CREATE POLICY "auth_view_own_responses" ON social_survey_responses
  FOR SELECT TO authenticated
  USING (
    survey_id IN (SELECT id FROM social_surveys WHERE user_id = auth.uid())
  );
