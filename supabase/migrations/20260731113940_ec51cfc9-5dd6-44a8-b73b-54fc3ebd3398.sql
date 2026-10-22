select cron.alter_job(18, command := $$
  SELECT net.http_post(
    url:='https://elvltuhjskdgboshavdx.supabase.co/functions/v1/sync-matches',
    headers:='{"Content-Type": "application/json", "x-sync-secret": "e9a06772ce1cd1ea9b621a05d44f2c88fdeaed7d241e00e3"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
$$);
select cron.alter_job(19, command := $$
  SELECT net.http_post(
    url:='https://elvltuhjskdgboshavdx.supabase.co/functions/v1/standings-scraper',
    headers:='{"Content-Type": "application/json", "x-sync-secret": "e9a06772ce1cd1ea9b621a05d44f2c88fdeaed7d241e00e3"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
$$);
select cron.alter_job(7, command := $$
  SELECT net.http_post(
    url:='https://elvltuhjskdgboshavdx.supabase.co/functions/v1/grasrot-scrape',
    headers:='{"Content-Type": "application/json", "x-sync-secret": "e9a06772ce1cd1ea9b621a05d44f2c88fdeaed7d241e00e3"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
$$);
select cron.alter_job(15, command := $$
  SELECT net.http_post(
    url:='https://elvltuhjskdgboshavdx.supabase.co/functions/v1/division-matches-sync',
    headers:='{"Content-Type": "application/json", "x-sync-secret": "e9a06772ce1cd1ea9b621a05d44f2c88fdeaed7d241e00e3"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
$$);