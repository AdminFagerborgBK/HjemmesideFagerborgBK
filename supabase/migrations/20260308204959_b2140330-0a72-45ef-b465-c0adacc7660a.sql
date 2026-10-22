
-- Enable pgcrypto for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to auto-create full match video when a match with livestream finishes
CREATE OR REPLACE FUNCTION public.auto_create_full_match_video()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  home_team TEXT;
  away_team TEXT;
  video_title TEXT;
  video_desc TEXT;
  date_formatted TEXT;
  dd TEXT;
  mm TEXT;
  raw_password TEXT;
  hashed_password TEXT;
BEGIN
  -- Only trigger when status changes to 'finished' and livestream_url exists
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished') AND NEW.livestream_url IS NOT NULL THEN
    -- Check if a full_match video already exists for this match
    IF EXISTS (SELECT 1 FROM public.site_videos WHERE match_id = NEW.id AND category = 'full_match') THEN
      RETURN NEW;
    END IF;

    -- Build team names
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
    date_formatted := TO_CHAR(NEW.match_date AT TIME ZONE 'Europe/Oslo', 'TMDay DD. TMMonth YYYY');

    video_desc := 'Full kamp fra kampen mellom ' || home_team || ' og ' || away_team || '.' || E'\n'
      || '📅 ' || date_formatted || E'\n'
      || '📍 ' || NEW.venue || E'\n'
      || '🏆 ' || NEW.competition || E'\n'
      || '⚽ Resultat: ' || COALESCE(NEW.home_score::TEXT, '?') || ' - ' || COALESCE(NEW.away_score::TEXT, '?') || E'\n'
      || E'\n' || '#fagerborgbk #fotball #oslo';

    -- Generate password and hash it
    raw_password := 'madronoball' || dd || mm;
    hashed_password := crypt(raw_password, gen_salt('bf'));

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
$$;

-- Create the trigger
CREATE TRIGGER trg_auto_create_full_match_video
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_full_match_video();
