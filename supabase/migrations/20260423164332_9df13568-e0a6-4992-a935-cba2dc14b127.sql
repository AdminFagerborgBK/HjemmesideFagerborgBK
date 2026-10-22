CREATE TABLE public.division_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiks_id text NOT NULL UNIQUE,
  division_fiks_id text NOT NULL DEFAULT '205403',
  round_number integer,
  match_date timestamp with time zone NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score integer,
  away_score integer,
  status text NOT NULL DEFAULT 'upcoming',
  venue text,
  match_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_division_matches_round ON public.division_matches(division_fiks_id, round_number);
CREATE INDEX idx_division_matches_date ON public.division_matches(division_fiks_id, match_date);

ALTER TABLE public.division_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Division matches are publicly viewable"
  ON public.division_matches FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert division matches"
  ON public.division_matches FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update division matches"
  ON public.division_matches FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete division matches"
  ON public.division_matches FOR DELETE
  USING (is_admin(auth.uid()));

CREATE TRIGGER update_division_matches_updated_at
  BEFORE UPDATE ON public.division_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();