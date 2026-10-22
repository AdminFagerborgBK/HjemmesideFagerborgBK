DROP POLICY IF EXISTS "Admins can read all posts" ON public.instagram_posts;
DROP POLICY IF EXISTS "Admins can insert posts" ON public.instagram_posts;
DROP POLICY IF EXISTS "Admins can update posts" ON public.instagram_posts;
DROP POLICY IF EXISTS "Admins can delete posts" ON public.instagram_posts;

CREATE POLICY "Admins can read all posts"
  ON public.instagram_posts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'site_admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can insert posts"
  ON public.instagram_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'site_admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can update posts"
  ON public.instagram_posts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'site_admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'site_admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can delete posts"
  ON public.instagram_posts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'site_admin') OR public.has_role(auth.uid(), 'superadmin'));