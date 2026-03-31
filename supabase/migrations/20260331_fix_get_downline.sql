-- Fix get_downline: rewrite as plpgsql with explicit SET to bypass RLS
-- The sql STABLE SECURITY DEFINER version was failing because
-- the CTE on profiles triggered RLS policy evaluation recursively.

CREATE OR REPLACE FUNCTION get_downline(root_user_id uuid)
RETURNS TABLE(user_id uuid, depth int) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT p.id AS user_id, 1 AS depth
    FROM profiles p
    WHERE p.sponsor_user_id = root_user_id

    UNION ALL

    SELECT p.id AS user_id, t.depth + 1
    FROM profiles p
    INNER JOIN tree t ON p.sponsor_user_id = t.user_id
    WHERE t.depth < 10
  )
  SELECT tree.user_id, tree.depth FROM tree;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
   SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_downline(uuid) TO authenticated;
