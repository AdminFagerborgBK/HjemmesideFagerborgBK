-- Add password protection fields to site_videos table
ALTER TABLE public.site_videos 
ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS protected_password text;

-- Add comment for clarity
COMMENT ON COLUMN public.site_videos.is_protected IS 'If true, video requires password to view (for training videos etc)';
COMMENT ON COLUMN public.site_videos.protected_password IS 'Shared password for protected videos (plain text, set by admin)';