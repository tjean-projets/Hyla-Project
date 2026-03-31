-- Allow users to set their own challenge start date
-- Falls back to created_at if null

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS challenge_start_date DATE;
