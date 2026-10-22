-- Event-driven social publishing: fire immediately when content becomes due,
-- so no recurring 5-minute polling job is required.

CREATE OR REPLACE FUNCTION public.trigger_scheduled_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url TEXT;
  secret TEXT;
  is_due BOOLEAN := false;
BEGIN
  IF TG_TABLE_NAME = 'news' THEN
    is_due := NEW.is_published
      AND NEW.scheduled_facebook
      AND NEW.facebook_post_id IS NULL
      AND NEW.deleted_at IS NULL
      AND NEW.published_at IS NOT NULL
      AND NEW.published_at <= now();
  ELSE
    is_due := NEW.status = 'published'
      AND (NEW.scheduled_facebook OR NEW.scheduled_tiktok)
      AND NEW.published_at IS NOT NULL
      AND NEW.published_at <= now();
  END IF;

  IF NOT is_due THEN
    RETURN NEW;
  END IF;

  SELECT value #>> '{}' INTO secret FROM public.site_settings WHERE key = 'cron_sync_secret';
  SELECT value #>> '{}' INTO fn_url FROM public.site_settings WHERE key = 'functions_base_url';

  IF secret IS NULL OR fn_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url || '/scheduled-publish',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', secret),
    body := '{}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_news_scheduled_publish
AFTER INSERT OR UPDATE OF is_published, scheduled_facebook, published_at ON public.news
FOR EACH ROW EXECUTE FUNCTION public.trigger_scheduled_publish();

CREATE TRIGGER trg_videos_scheduled_publish
AFTER INSERT OR UPDATE OF status, scheduled_facebook, scheduled_tiktok, published_at ON public.site_videos
FOR EACH ROW EXECUTE FUNCTION public.trigger_scheduled_publish();

-- Narrow partial indexes so the due-work check is a cheap index probe
CREATE INDEX IF NOT EXISTS idx_news_pending_fb
  ON public.news (published_at)
  WHERE is_published AND scheduled_facebook AND facebook_post_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_videos_pending_social
  ON public.site_videos (published_at)
  WHERE scheduled_facebook OR scheduled_tiktok;