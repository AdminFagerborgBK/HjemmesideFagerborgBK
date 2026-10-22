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
  should_create BOOLEAN;
BEGIN
  should_create := NEW.livestream_url IS NOT NULL AND (
    (NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished')
    OR NEW.match_date < now() - interval '2 hours 30 minutes'
  );

  IF should_create THEN
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

    video_title := home_team || ' vs ' || away_team || ' | Full kamp';

    dd := LPAD(EXTRACT(DAY FROM NEW.match_date)::TEXT, 2, '0');
    mm := LPAD(EXTRACT(MONTH FROM NEW.match_date)::TEXT, 2, '0');

    video_desc := 'Full kamp mellom ' || home_team || ' og ' || away_team || '.' || E'\n'
      || '📅 ' || dd || '.' || mm || '.' || EXTRACT(YEAR FROM NEW.match_date)::TEXT || E'\n'
      || '📍 ' || NEW.venue || E'\n'
      || '🏆 ' || NEW.competition || E'\n'
      || CASE WHEN NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
              THEN '⚽ Resultat: ' || NEW.home_score::TEXT || ' - ' || NEW.away_score::TEXT || E'\n'
              ELSE '' END
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

UPDATE public.matches SET updated_at = now()
WHERE livestream_url IS NOT NULL
  AND match_date < now() - interval '2 hours 30 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM public.site_videos v WHERE v.match_id = matches.id AND v.category = 'full_match'
  );