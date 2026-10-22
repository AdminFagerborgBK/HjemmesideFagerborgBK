
-- Drop the existing restrictive view and recreate with security_definer
-- so public users can read published videos through the view
DROP VIEW IF EXISTS public.site_videos_public;

CREATE VIEW public.site_videos_public
WITH (security_invoker=off) AS
  SELECT id, title, description, video_url, thumbnail_url, status, published_at,
         created_by, created_at, updated_at, is_protected, category
  FROM public.site_videos
  WHERE status = 'published';

-- Grant select on the view to anon and authenticated
GRANT SELECT ON public.site_videos_public TO anon, authenticated;
