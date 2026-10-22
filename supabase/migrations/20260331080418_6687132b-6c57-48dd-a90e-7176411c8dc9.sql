ALTER TABLE public.news ADD COLUMN match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL DEFAULT NULL;
ALTER TABLE public.news ADD COLUMN show_match_highlights boolean NOT NULL DEFAULT false;