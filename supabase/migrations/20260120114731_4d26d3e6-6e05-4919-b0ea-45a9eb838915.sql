-- Add fiks_id column to matches table for linking to fotball.no
ALTER TABLE public.matches ADD COLUMN fiks_id TEXT;

-- Add comments
COMMENT ON COLUMN public.matches.fiks_id IS 'The match ID from fotball.no for linking to match details';