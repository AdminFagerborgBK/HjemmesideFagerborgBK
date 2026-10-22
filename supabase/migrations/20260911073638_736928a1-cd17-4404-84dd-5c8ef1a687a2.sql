CREATE OR REPLACE VIEW public.matches_public
WITH (security_invoker = off) AS
SELECT id, team, opponent, match_date, venue, is_home, home_score, away_score,
       competition, status, created_at, updated_at, fiks_id, opponent_logo_url,
       venue_maps_url, time_tbd, venue_tbd, is_cancelled
FROM public.matches;

GRANT SELECT ON public.matches_public TO anon, authenticated;

DROP POLICY IF EXISTS "Matches are publicly viewable" ON public.matches;
CREATE POLICY "Admins can view matches"
ON public.matches FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.livestream_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  match_id uuid NOT NULL,
  email text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.livestream_access TO service_role;
ALTER TABLE public.livestream_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view livestream access"
ON public.livestream_access FOR SELECT
USING (public.is_admin(auth.uid()));