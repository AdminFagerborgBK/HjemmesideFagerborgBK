-- Fix site_sponsors: Make public SELECT policy PERMISSIVE
DROP POLICY IF EXISTS "Public can view active sponsors" ON public.site_sponsors;

CREATE POLICY "Public can view active sponsors"
ON public.site_sponsors
FOR SELECT
USING (is_active = true);