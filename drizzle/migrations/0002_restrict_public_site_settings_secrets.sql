DROP POLICY IF EXISTS "Public can view non-sensitive settings" ON public.site_settings;

CREATE POLICY "Public can view non-sensitive settings"
ON public.site_settings
FOR SELECT
USING (
  key <> ALL (ARRAY[
    'facebook_page_access_token',
    'tiktok_access_token',
    'tiktok_refresh_token',
    'tiktok_csrf_state',
    'tiktok_open_id',
    'tiktok_username'
  ])
  AND key NOT LIKE '%secret%'
  AND key NOT LIKE '%token%'
  AND key NOT LIKE '%password%'
  AND key NOT LIKE '%api_key%'
  AND key NOT LIKE '%private%'
);