-- Create predefined admin roles with permissions
CREATE TYPE public.admin_permission AS ENUM (
  'posts_read', 'posts_write',
  'videos_read', 'videos_write', 
  'roster_read', 'roster_write',
  'sponsors_read', 'sponsors_write',
  'pages_read', 'pages_write',
  'board_read', 'board_write',
  'settings_read', 'settings_write',
  'members_read', 'members_write'
);

-- Predefined role definitions table
CREATE TABLE public.admin_role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions admin_permission[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_role_definitions ENABLE ROW LEVEL SECURITY;

-- Only superadmins can manage role definitions
CREATE POLICY "Anyone can read role definitions"
ON public.admin_role_definitions FOR SELECT
USING (true);

CREATE POLICY "Only superadmins can manage role definitions"
ON public.admin_role_definitions FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'));

-- Link board members to users (optional - can still be manual)
ALTER TABLE public.site_roster 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Insert default role definitions
INSERT INTO public.admin_role_definitions (name, display_name, description, permissions) VALUES
('redaktor', 'Redaktør', 'Kan lese og skrive nyheter, videoer og sider', 
 ARRAY['posts_read', 'posts_write', 'videos_read', 'videos_write', 'pages_read', 'pages_write']::admin_permission[]),
('innholdsansvarlig', 'Innholdsansvarlig', 'Full tilgang til alt innhold', 
 ARRAY['posts_read', 'posts_write', 'videos_read', 'videos_write', 'roster_read', 'roster_write', 'sponsors_read', 'sponsors_write', 'pages_read', 'pages_write', 'board_read', 'board_write']::admin_permission[]),
('medlemsansvarlig', 'Medlemsansvarlig', 'Administrerer medlemskap', 
 ARRAY['members_read', 'members_write']::admin_permission[]),
('lesebruker', 'Lesebruker', 'Kun lesetilgang til alt', 
 ARRAY['posts_read', 'videos_read', 'roster_read', 'sponsors_read', 'pages_read', 'board_read', 'settings_read', 'members_read']::admin_permission[]);

-- Add admin_role_id to user_roles for predefined role assignment (for site_admin only)
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS admin_role_id UUID REFERENCES public.admin_role_definitions(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_admin_role_definitions_updated_at
BEFORE UPDATE ON public.admin_role_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();