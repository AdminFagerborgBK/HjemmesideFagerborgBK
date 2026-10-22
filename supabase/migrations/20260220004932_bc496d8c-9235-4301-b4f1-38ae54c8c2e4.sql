
-- Add livestream_url to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS livestream_url text;

-- Create livestream click stats table
CREATE TABLE IF NOT EXISTS public.livestream_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('donated', 'skipped')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.livestream_stats ENABLE ROW LEVEL SECURITY;

-- Public can insert (anonymous tracking)
CREATE POLICY "Anyone can insert livestream stats"
  ON public.livestream_stats
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read stats
CREATE POLICY "Admins can read livestream stats"
  ON public.livestream_stats
  FOR SELECT
  USING (is_admin(auth.uid()));
