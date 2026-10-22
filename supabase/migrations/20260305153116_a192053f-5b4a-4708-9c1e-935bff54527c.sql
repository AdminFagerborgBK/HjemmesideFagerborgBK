
-- Add match_id column to site_videos
ALTER TABLE public.site_videos ADD COLUMN match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;

-- Drop and recreate the public view to include match_id
DROP VIEW IF EXISTS public.site_videos_public;
CREATE VIEW public.site_videos_public WITH (security_invoker = off) AS
SELECT
  id,
  title,
  description,
  video_url,
  thumbnail_url,
  status,
  published_at,
  created_by,
  created_at,
  updated_at,
  is_protected,
  category,
  match_id
FROM public.site_videos
WHERE status = 'published';
