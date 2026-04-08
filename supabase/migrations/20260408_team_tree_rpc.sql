-- Replace N+1 recursive JS loop with a single SQL recursive CTE
-- Called via supabase.rpc('get_team_tree', { p_user_id })

CREATE OR REPLACE FUNCTION get_team_tree(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  internal_id TEXT,
  linked_user_id UUID,
  matching_names TEXT[],
  depth INT,
  owner_user_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE tree AS (
    -- Base: membres directs de la manager
    SELECT
      tm.id,
      tm.user_id,
      tm.first_name,
      tm.last_name,
      tm.internal_id,
      tm.linked_user_id,
      tm.matching_names,
      1 AS depth,
      p_user_id AS owner_user_id
    FROM team_members tm
    WHERE tm.user_id = p_user_id

    UNION ALL

    -- Récursif: sous-membres via linked_user_id
    SELECT
      tm.id,
      tm.user_id,
      tm.first_name,
      tm.last_name,
      tm.internal_id,
      tm.linked_user_id,
      tm.matching_names,
      tree.depth + 1,
      tree.linked_user_id AS owner_user_id
    FROM team_members tm
    INNER JOIN tree ON tm.user_id = tree.linked_user_id
    WHERE tree.linked_user_id IS NOT NULL
      AND tree.depth < 5  -- sécurité anti-boucle infinie
  )
  -- DISTINCT ON garde la profondeur la plus faible pour chaque membre
  SELECT DISTINCT ON (id)
    id, user_id, first_name, last_name, internal_id, linked_user_id, matching_names, depth, owner_user_id
  FROM tree
  ORDER BY id, depth ASC;
$$;
