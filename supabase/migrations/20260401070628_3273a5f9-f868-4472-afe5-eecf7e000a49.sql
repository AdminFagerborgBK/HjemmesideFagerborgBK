ALTER TABLE public.site_roster ADD COLUMN team text NOT NULL DEFAULT 'A-laget';

-- Update the public view to include team
DROP VIEW IF EXISTS public.site_roster_public;
CREATE VIEW public.site_roster_public
WITH (security_invoker=off) AS
  SELECT
    id, full_name, role_or_position, category, team, shirt_number, photo_url, status,
    CASE WHEN show_email THEN contact_email ELSE NULL END AS contact_email,
    CASE WHEN show_phone THEN contact_phone ELSE NULL END AS contact_phone,
    show_email, show_phone, career_history, fotball_no_url, created_at, updated_at
  FROM public.site_roster;