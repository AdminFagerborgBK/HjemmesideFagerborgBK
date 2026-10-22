CREATE TABLE public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  alt_text TEXT,
  image_url TEXT NOT NULL,
  instagram_url TEXT NOT NULL,
  is_video BOOLEAN NOT NULL DEFAULT FALSE,
  focus_x NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (focus_x >= 0 AND focus_x <= 100),
  focus_y NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (focus_y >= 0 AND focus_y <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT ON public.instagram_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_posts TO authenticated;
GRANT ALL ON public.instagram_posts TO service_role;

ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published posts"
  ON public.instagram_posts FOR SELECT
  TO anon, authenticated
  USING (published = TRUE AND deleted_at IS NULL);

CREATE POLICY "Admins can read all posts"
  ON public.instagram_posts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'site_admin'));

CREATE POLICY "Admins can insert posts"
  ON public.instagram_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'site_admin'));

CREATE POLICY "Admins can update posts"
  ON public.instagram_posts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'site_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'site_admin'));

CREATE POLICY "Admins can delete posts"
  ON public.instagram_posts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'site_admin'));

CREATE OR REPLACE FUNCTION public.set_instagram_posts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER instagram_posts_updated_at
  BEFORE UPDATE ON public.instagram_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_instagram_posts_updated_at();