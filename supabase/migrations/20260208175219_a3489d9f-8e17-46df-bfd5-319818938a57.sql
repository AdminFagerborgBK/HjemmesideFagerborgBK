-- Add view_count column to track article views
ALTER TABLE public.news ADD COLUMN view_count integer NOT NULL DEFAULT 0;