
DROP VIEW IF EXISTS public.site_videos_public;

CREATE VIEW public.site_videos_public
WITH (security_invoker = false)
AS
SELECT
  id,
  title,
  description,
  CASE WHEN is_protected THEN NULL ELSE video_url END AS video_url,
  thumbnail_url,
  status,
  published_at,
  created_by,
  created_at,
  updated_at,
  is_protected,
  category,
  match_id,
  sort_order
FROM public.site_videos
WHERE status = 'published'::content_status;

GRANT SELECT ON public.site_videos_public TO anon, authenticated;
