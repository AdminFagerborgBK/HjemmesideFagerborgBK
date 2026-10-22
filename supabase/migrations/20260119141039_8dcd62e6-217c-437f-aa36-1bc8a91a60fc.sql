-- Add logo_url column to standings table
ALTER TABLE public.standings 
ADD COLUMN IF NOT EXISTS logo_url text;