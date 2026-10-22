-- Ensure we can safely upsert matches during sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_team_fiks_id_key'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_team_fiks_id_key UNIQUE (team, fiks_id);
  END IF;
END $$;
