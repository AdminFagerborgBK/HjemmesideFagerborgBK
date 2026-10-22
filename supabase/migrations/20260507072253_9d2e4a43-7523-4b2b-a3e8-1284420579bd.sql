
-- Sync status tracking for scrapers
CREATE TABLE IF NOT EXISTS public.sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_updated_count integer DEFAULT 0,
  last_details jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync status"
  ON public.sync_status FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Update auto_create_full_match_video to drop "fra kampen"
CREATE OR REPLACE FUNCTION public.auto_create_full_match_video()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  home_team TEXT;
  away_team TEXT;
  video_title TEXT;
  video_desc TEXT;
  dd TEXT;
  mm TEXT;
  raw_password TEXT;
  hashed_password TEXT;
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') AND NEW.livestream_url IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.site_videos WHERE match_id = NEW.id AND category = 'full_match') THEN
      RETURN NEW;
    END IF;

    IF NEW.is_home THEN
      home_team := 'Fagerborg';
      away_team := NEW.opponent;
    ELSE
      home_team := NEW.opponent;
      away_team := 'Fagerborg';
    END IF;

    video_title := 'Full kamp: ' || home_team || ' vs ' || away_team;

    dd := LPAD(EXTRACT(DAY FROM NEW.match_date)::TEXT, 2, '0');
    mm := LPAD(EXTRACT(MONTH FROM NEW.match_date)::TEXT, 2, '0');

    video_desc := 'Full kamp mellom ' || home_team || ' og ' || away_team || '.' || E'\n'
      || '📅 ' || dd || '.' || mm || '.' || EXTRACT(YEAR FROM NEW.match_date)::TEXT || E'\n'
      || '📍 ' || NEW.venue || E'\n'
      || '🏆 ' || NEW.competition || E'\n'
      || '⚽ Resultat: ' || COALESCE(NEW.home_score::TEXT, '?') || ' - ' || COALESCE(NEW.away_score::TEXT, '?') || E'\n'
      || E'\n' || '#fagerborgbk #fotball #oslo';

    raw_password := 'madronoball' || dd || mm;
    hashed_password := extensions.crypt(raw_password, extensions.gen_salt('bf'));

    INSERT INTO public.site_videos (
      title, description, video_url, category, match_id,
      status, published_at, is_protected, protected_password
    ) VALUES (
      video_title, video_desc, NEW.livestream_url, 'full_match', NEW.id,
      'published', NOW(), true, hashed_password
    );
  END IF;

  RETURN NEW;
END;
$function$;
