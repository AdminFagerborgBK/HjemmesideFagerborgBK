ALTER TABLE public.site_roster 
  ADD COLUMN career_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN fotball_no_url text;