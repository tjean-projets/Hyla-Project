-- Étend get_team_tree avec status, hyla_level, level pour la recherche multi-lignées + œil downline
-- Drop puis recreate (changement de signature)

DROP FUNCTION IF EXISTS get_team_tree(UUID);

CREATE FUNCTION get_team_tree(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  internal_id TEXT,
  linked_user_id UUID,
  matching_names TEXT[],
  depth INT,
  owner_user_id UUID,
  status TEXT,
  hyla_level TEXT,
  level INT
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
      p_user_id AS owner_user_id,
      tm.status,
      tm.hyla_level,
      tm.level
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
      tree.linked_user_id AS owner_user_id,
      tm.status,
      tm.hyla_level,
      tm.level
    FROM team_members tm
    INNER JOIN tree ON tm.user_id = tree.linked_user_id
    WHERE tree.linked_user_id IS NOT NULL
  )
  SELECT * FROM tree;
$$;

GRANT EXECUTE ON FUNCTION get_team_tree(UUID) TO authenticated;
