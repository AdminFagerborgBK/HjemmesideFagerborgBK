-- Fix: Make the public settings policy PERMISSIVE so anonymous users can read non-sensitive settings
-- First drop the restrictive one, then recreate as permissive

DROP POLICY IF EXISTS "Public can view non-sensitive settings" ON public.site_settings;

CREATE POLICY "Public can view non-sensitive settings"
ON public.site_settings
FOR SELECT
USING (
  key <> ALL (ARRAY[
    'facebook_page_access_token'::text,
    'tiktok_access_token'::text,
    'tiktok_refresh_token'::text,
    'tiktok_csrf_state'::text,
    'tiktok_open_id'::text,
    'tiktok_username'::text
  ])
);

-- Also make the admin view policy permissive
DROP POLICY IF EXISTS "Admins can view all settings" ON public.site_settings;

CREATE POLICY "Admins can view all settings"
ON public.site_settings
FOR SELECT
USING (is_admin(auth.uid()));