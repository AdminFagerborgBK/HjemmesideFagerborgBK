
-- Add contact fields to site_roster for trainers/staff
ALTER TABLE public.site_roster
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false;
