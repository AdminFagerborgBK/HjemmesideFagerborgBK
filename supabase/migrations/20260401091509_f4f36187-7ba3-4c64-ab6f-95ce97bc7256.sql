DROP VIEW IF EXISTS public.site_roster_public;
CREATE VIEW public.site_roster_public WITH (security_invoker = off) AS
SELECT id, full_name, role_or_position, category, team, shirt_number, photo_url, status,
  CASE WHEN show_email THEN contact_email ELSE NULL::text END AS contact_email,
  CASE WHEN show_phone THEN contact_phone ELSE NULL::text END AS contact_phone,
  show_email, show_phone, career_history, fotball_no_url, birth_date, created_at, updated_at
FROM site_roster
WHERE deleted_at IS NULL;