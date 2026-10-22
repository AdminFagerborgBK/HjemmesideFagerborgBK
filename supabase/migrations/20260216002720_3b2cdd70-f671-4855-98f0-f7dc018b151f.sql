-- Fix Security Definer Views by setting security_invoker = true
-- This ensures RLS policies of the querying user are enforced, not the view creator

CREATE OR REPLACE VIEW public.site_roster_public
WITH (security_invoker = true)
AS
SELECT id,
    full_name,
    role_or_position,
    category,
    shirt_number,
    photo_url,
    status,
    show_email,
    show_phone,
    CASE WHEN show_email = true THEN contact_email ELSE NULL::text END AS contact_email,
    CASE WHEN show_phone = true THEN contact_phone ELSE NULL::text END AS contact_phone,
    created_at,
    updated_at
FROM site_roster
WHERE status = 'active'::roster_status;

CREATE OR REPLACE VIEW public.site_videos_public
WITH (security_invoker = true)
AS
SELECT id,
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
FROM site_videos;