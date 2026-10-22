-- Replace the recurring scheduled-publish poller with true one-shot scheduling.
-- A scheduled-publish job now exists ONLY while a future social post is queued.

CREATE OR REPLACE FUNCTION public.reschedule_scheduled_publish()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $fn$
DECLARE
  next_at timestamptz;
  fn_url TEXT;
  secret TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-publish-oneshot') THEN
    PERFORM cron.unschedule('scheduled-publish-oneshot');
  END IF;

  SELECT min(t) INTO next_at FROM (
    SELECT min(published_at) AS t
      FROM public.news
     WHERE is_published AND scheduled_facebook AND facebook_post_id IS NULL
       AND deleted_at IS NULL AND published_at > now()
    UNION ALL
    SELECT min(published_at)
      FROM public.site_videos
     WHERE status = 'published' AND (scheduled_facebook OR scheduled_tiktok)
       AND published_at > now()
  ) s;

  -- Nothing queued for the future -> no scheduled job at all
  IF next_at IS NULL THEN
    RETURN;
  END IF;

  SELECT value #>> '{}' INTO secret FROM public.site_settings WHERE key = 'cron_sync_secret';
  SELECT value #>> '{}' INTO fn_url FROM public.site_settings WHERE key = 'functions_base_url';
  IF secret IS NULL OR fn_url IS NULL THEN
    RETURN;
  END IF;

  next_at := next_at + interval '1 minute';

  PERFORM cron.schedule(
    'scheduled-publish-oneshot',
    trim(to_char(next_at AT TIME ZONE 'UTC', 'FMMI FMHH24 FMDD FMMM')) || ' *',
    format(
      $cmd$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb); SELECT public.reschedule_scheduled_publish();$cmd$,
      fn_url || '/scheduled-publish',
      json_build_object('Content-Type', 'application/json', 'x-sync-secret', secret)::text
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.reschedule_scheduled_publish() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_scheduled_publish() TO authenticated;

-- Publish-now stays instant; future posts arm exactly one execution.
CREATE OR REPLACE FUNCTION public.trigger_scheduled_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
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

  IF is_due THEN
    SELECT value #>> '{}' INTO secret FROM public.site_settings WHERE key = 'cron_sync_secret';
    SELECT value #>> '{}' INTO fn_url FROM public.site_settings WHERE key = 'functions_base_url';

    IF secret IS NOT NULL AND fn_url IS NOT NULL THEN
      PERFORM net.http_post(
        url := fn_url || '/scheduled-publish',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', secret),
        body := '{}'::jsonb
      );
    END IF;
  END IF;

  PERFORM public.reschedule_scheduled_publish();

  RETURN NEW;
END;
$fn$;

-- Retire the recurring poller and arm the current queue state
SELECT cron.unschedule('scheduled-publish-due-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-publish-due-check');

SELECT public.reschedule_scheduled_publish();