
-- Add opponent logo URL for manual matches (treningskamper etc.)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS opponent_logo_url TEXT;

-- Add Google Maps URL for venue location
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS venue_maps_url TEXT;
