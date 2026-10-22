-- Add category column to site_videos for filtering (highlights, podcast, livestream)
ALTER TABLE public.site_videos ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Update the public view to include category
DROP VIEW IF EXISTS public.site_videos_public;
CREATE VIEW public.site_videos_public AS
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
    category
  FROM public.site_videos;