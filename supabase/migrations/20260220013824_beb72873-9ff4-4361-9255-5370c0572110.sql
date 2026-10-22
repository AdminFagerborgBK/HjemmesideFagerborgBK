
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public can view settings" ON public.site_settings;

-- Allow public to read only non-sensitive settings
CREATE POLICY "Public can view non-sensitive settings"
ON public.site_settings FOR SELECT
TO anon, authenticated
USING (
  key NOT IN (
    'facebook_page_access_token',
    'tiktok_access_token',
    'tiktok_refresh_token',
    'tiktok_csrf_state',
    'tiktok_open_id',
    'tiktok_username'
  )
);

-- Admins can view ALL settings (including sensitive ones)
CREATE POLICY "Admins can view all settings"
ON public.site_settings FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));
