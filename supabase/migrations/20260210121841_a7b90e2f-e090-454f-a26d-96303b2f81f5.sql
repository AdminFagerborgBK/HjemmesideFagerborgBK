
-- 1. Create public view for videos WITHOUT protected_password
CREATE VIEW public.site_videos_public AS
SELECT id, title, description, video_url, thumbnail_url,
       status, is_protected, published_at, created_by,
       created_at, updated_at
FROM public.site_videos
WHERE status = 'published';

-- 2. Remove the public SELECT policy from the base table
DROP POLICY "Public can view published videos" ON public.site_videos;

-- 3. Add admin-only SELECT policy (admins already have ALL via existing policy)
-- No additional policy needed — the ALL policy covers SELECT for admins

-- 4. Fix site_roster_public view: recreate WITHOUT security_invoker
-- so public users can actually read it (the view itself filters sensitive data)
DROP VIEW IF EXISTS public.site_roster_public;

CREATE VIEW public.site_roster_public AS
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
FROM public.site_roster
WHERE status = 'active';
