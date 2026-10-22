CREATE OR REPLACE VIEW public.site_videos_public WITH (security_invoker = off) AS
SELECT id, title, description, video_url, thumbnail_url, status, published_at, created_by, created_at, updated_at, is_protected, category, match_id, sort_order
FROM public.site_videos
WHERE status = 'published'::content_status;