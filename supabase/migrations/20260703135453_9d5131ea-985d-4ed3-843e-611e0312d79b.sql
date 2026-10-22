DROP POLICY IF EXISTS "Anyone can read role definitions" ON public.admin_role_definitions;
CREATE POLICY "Admins can read role definitions"
  ON public.admin_role_definitions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'site_admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
REVOKE SELECT ON public.admin_role_definitions FROM anon;