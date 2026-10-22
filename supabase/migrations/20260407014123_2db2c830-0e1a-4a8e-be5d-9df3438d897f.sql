
ALTER TABLE public.news
ADD COLUMN scheduled_facebook boolean NOT NULL DEFAULT false;

ALTER TABLE public.site_videos
ADD COLUMN scheduled_facebook boolean NOT NULL DEFAULT false;

ALTER TABLE public.site_videos
ADD COLUMN scheduled_tiktok boolean NOT NULL DEFAULT false;
