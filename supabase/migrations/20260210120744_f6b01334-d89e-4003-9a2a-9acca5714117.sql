
-- 1. Create a public view that hides contact info based on show flags
CREATE VIEW public.site_roster_public
WITH (security_invoker = on) AS
SELECT
  id,
  full_name,
  role_or_position,
  category,
  shirt_number,
  photo_url,
  status,
  show_email,
  show_phone,
  CASE WHEN show_email = true THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN show_phone = true THEN contact_phone ELSE NULL END AS contact_phone,
  created_at,
  updated_at
FROM public.site_roster;

-- 2. Remove the public SELECT policy on the base table
DROP POLICY "Public can view active roster" ON public.site_roster;

-- 3. Add a new restrictive public SELECT policy that denies direct access
CREATE POLICY "No direct public access to roster"
ON public.site_roster
FOR SELECT
USING (is_admin(auth.uid()));
