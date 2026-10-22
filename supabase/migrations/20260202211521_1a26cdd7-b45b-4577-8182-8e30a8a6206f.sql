-- Create app_role enum for RBAC
CREATE TYPE public.app_role AS ENUM ('user', 'site_admin', 'superadmin');

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin (site_admin or superadmin)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('site_admin', 'superadmin')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Superadmins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Create content_status enum
CREATE TYPE public.content_status AS ENUM ('draft', 'published');

-- Create roster_status enum
CREATE TYPE public.roster_status AS ENUM ('active', 'inactive');

-- Create site_posts table
CREATE TABLE public.site_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    excerpt text,
    body text NOT NULL,
    cover_image_url text,
    status content_status NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_posts ENABLE ROW LEVEL SECURITY;

-- Create site_videos table
CREATE TABLE public.site_videos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    video_url text NOT NULL,
    thumbnail_url text,
    status content_status NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_videos ENABLE ROW LEVEL SECURITY;

-- Create site_roster table
CREATE TABLE public.site_roster (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    role_or_position text,
    category text NOT NULL DEFAULT 'A-lag',
    shirt_number integer,
    photo_url text,
    status roster_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_roster ENABLE ROW LEVEL SECURITY;

-- Create site_pages table
CREATE TABLE public.site_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    title text NOT NULL,
    body text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- Create site_settings table for feature flags
CREATE TABLE public.site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL DEFAULT 'false'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES ('sponsors_enabled', 'false'::jsonb);

-- RLS policies for site_posts
CREATE POLICY "Public can view published posts"
ON public.site_posts
FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE POLICY "Admins can manage all posts"
ON public.site_posts
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS policies for site_videos
CREATE POLICY "Public can view published videos"
ON public.site_videos
FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE POLICY "Admins can manage all videos"
ON public.site_videos
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS policies for site_roster
CREATE POLICY "Public can view active roster"
ON public.site_roster
FOR SELECT
TO anon, authenticated
USING (status = 'active');

CREATE POLICY "Admins can manage roster"
ON public.site_roster
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS policies for site_pages
CREATE POLICY "Public can view pages"
ON public.site_pages
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage pages"
ON public.site_pages
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS policies for site_settings
CREATE POLICY "Public can view settings"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.site_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_site_posts_updated_at
BEFORE UPDATE ON public.site_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_videos_updated_at
BEFORE UPDATE ON public.site_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_roster_updated_at
BEFORE UPDATE ON public.site_roster
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_pages_updated_at
BEFORE UPDATE ON public.site_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default pages
INSERT INTO public.site_pages (key, title, body) VALUES 
('about', 'Om klubben', 'Fagerborg Ballklubb er en fotballklubb med lang og stolt historie.'),
('contact', 'Kontakt', 'Kontakt oss på post@fagerborgbk.no'),
('history', 'Historie', 'Klubbens historie strekker seg tilbake til...');

-- Create storage bucket for site media
INSERT INTO storage.buckets (id, name, public) VALUES ('site-media', 'site-media', true);

-- Storage policies for site-media bucket
CREATE POLICY "Public can view site media"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'site-media');

CREATE POLICY "Admins can upload site media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-media' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update site media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'site-media' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete site media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'site-media' AND public.is_admin(auth.uid()));