-- Ajoute equipe_ventes_mois dans get_dashboard_kpis
-- Ce champ compte le nombre de membres de l'équipe ayant vendu ce mois
-- (= commissions réseau avec team_member_id distincts pour ce mois)

CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_user_id UUID,
  p_period_start DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_period_end DATE DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  v_period TEXT;
BEGIN
  v_period := to_char(p_period_start, 'YYYY-MM');

  SELECT json_build_object(
    'ca_mois',                COALESCE((SELECT SUM(amount) FROM deals WHERE user_id = p_user_id AND status = 'signee' AND signed_at >= p_period_start AND signed_at <= p_period_end), 0),
    'ca_annee',               COALESCE((SELECT SUM(amount) FROM deals WHERE user_id = p_user_id AND status = 'signee' AND signed_at >= date_trunc('year', CURRENT_DATE)), 0),
    'ventes_signees',         (SELECT COUNT(*) FROM deals WHERE user_id = p_user_id AND status = 'signee' AND signed_at >= p_period_start AND signed_at <= p_period_end),
    'rdv_pris',               (SELECT COUNT(*) FROM appointments WHERE user_id = p_user_id AND date >= p_period_start AND date <= p_period_end),
    'demos_realisees',        (SELECT COUNT(*) FROM appointments WHERE user_id = p_user_id AND type = 'demo' AND status = 'realise' AND date >= p_period_start AND date <= p_period_end),
    'commissions_mois_directe', COALESCE((SELECT SUM(amount) FROM commissions WHERE user_id = p_user_id AND period = v_period AND type = 'directe' AND status = 'validee'), 0),
    'commissions_mois_reseau',  COALESCE((SELECT SUM(amount) FROM commissions WHERE user_id = p_user_id AND period = v_period AND type = 'reseau'  AND status = 'validee'), 0),
    'commissions_annee',      COALESCE((SELECT SUM(amount) FROM commissions WHERE user_id = p_user_id AND period >= to_char(date_trunc('year', CURRENT_DATE), 'YYYY-MM') AND status = 'validee'), 0),
    'nouvelles_recrues',      (SELECT COUNT(*) FROM team_members WHERE user_id = p_user_id AND joined_at >= p_period_start AND joined_at <= p_period_end),
    'equipe_active',          (SELECT COUNT(*) FROM team_members WHERE user_id = p_user_id AND status = 'actif'),
    -- Nombre de membres de l'équipe ayant eu une commission réseau ce mois (depuis import TRV)
    'equipe_ventes_mois',     COALESCE(
                                (SELECT COUNT(DISTINCT team_member_id)
                                 FROM commissions
                                 WHERE user_id = p_user_id
                                   AND period = v_period
                                   AND type = 'reseau'
                                   AND status = 'validee'
                                   AND team_member_id IS NOT NULL),
                                0),
    'contacts_total',         (SELECT COUNT(*) FROM contacts WHERE user_id = p_user_id),
    'prospects_actifs',       (SELECT COUNT(*) FROM contacts WHERE user_id = p_user_id AND status = 'prospect')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
