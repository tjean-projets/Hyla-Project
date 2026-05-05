-- Étend get_team_tree pour traverser AUSSI les sub-membres via sponsor_id

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
  level INT,
  parent_member_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE tree AS (
    -- Base : directs de la manager (sans sponsor, dans sa propre table)
    SELECT
      tm.id, tm.user_id, tm.first_name, tm.last_name, tm.internal_id,
      tm.linked_user_id, tm.matching_names,
      1 AS depth,
      p_user_id AS owner_user_id,
      tm.status, tm.hyla_level, tm.level,
      NULL::UUID AS parent_member_id
    FROM team_members tm
    WHERE tm.user_id = p_user_id AND tm.sponsor_id IS NULL

    UNION ALL

    -- Récursif : enfants soit via sponsor_id (même table), soit via linked_user_id
    SELECT
      tm.id, tm.user_id, tm.first_name, tm.last_name, tm.internal_id,
      tm.linked_user_id, tm.matching_names,
      tree.depth + 1,
      tree.linked_user_id AS owner_user_id,
      tm.status, tm.hyla_level, tm.level,
      tree.id AS parent_member_id
    FROM team_members tm
    INNER JOIN tree ON
      -- Cas A : sub-member via sponsor_id (même user_id, parent = tree row)
      (tm.user_id = tree.user_id AND tm.sponsor_id = tree.id)
      OR
      -- Cas B : sub-member via linked compte Triibu (user_id = tree.linked_user_id)
      (tree.linked_user_id IS NOT NULL AND tm.user_id = tree.linked_user_id AND tm.sponsor_id IS NULL)
  )
  SELECT DISTINCT ON (id)
    id, user_id, first_name, last_name, internal_id, linked_user_id, matching_names,
    depth, owner_user_id, status, hyla_level, level, parent_member_id
  FROM tree;
$$;

GRANT EXECUTE ON FUNCTION get_team_tree(UUID) TO authenticated;
