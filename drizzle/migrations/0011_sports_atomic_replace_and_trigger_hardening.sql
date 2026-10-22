-- Preserve the manually repaired live behavior in a follow-up migration.
CREATE OR REPLACE FUNCTION public.trigger_goal_club_season_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE fn_url text; secret text;
BEGIN
  IF NEW.team <> 'A-laget' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'matches' THEN
    IF NOT (NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'standings' THEN
    NULL; -- Trigger WHEN clauses already restrict club row/changed played count.
  ELSE
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.goal_club_season_closures
    WHERE season = extract(year FROM now() AT TIME ZONE 'Europe/Oslo')::int) THEN
    RETURN NEW;
  END IF;
  SELECT value #>> '{}' INTO secret FROM public.site_settings WHERE key = 'cron_sync_secret';
  SELECT value #>> '{}' INTO fn_url FROM public.site_settings WHERE key = 'functions_base_url';
  IF secret IS NOT NULL AND fn_url IS NOT NULL THEN
    PERFORM net.http_post(url := fn_url || '/goal-club-season-close',
      headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',secret),
      body := '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$function$;

-- Keep the live safety net, and install it on fresh rebuilds as well.
CREATE UNIQUE INDEX IF NOT EXISTS standings_team_name_season_uidx
  ON public.standings(team, team_name, season);
CREATE OR REPLACE FUNCTION public.guard_standings_sync_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'service_role'
    AND coalesce(current_setting('app.standings_replace', true), '') <> '1' THEN
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$function$;
CREATE OR REPLACE FUNCTION public.replace_standings_row_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'service_role' THEN
    PERFORM set_config('app.standings_replace', '1', true);
    DELETE FROM public.standings WHERE team=NEW.team AND team_name=NEW.team_name AND season=NEW.season;
    PERFORM set_config('app.standings_replace', '0', true);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_guard_standings_sync_delete ON public.standings;
CREATE TRIGGER trg_guard_standings_sync_delete BEFORE DELETE ON public.standings
  FOR EACH ROW EXECUTE FUNCTION public.guard_standings_sync_delete();
DROP TRIGGER IF EXISTS trg_replace_standings_row_before_insert ON public.standings;
CREATE TRIGGER trg_replace_standings_row_before_insert BEFORE INSERT ON public.standings
  FOR EACH ROW EXECUTE FUNCTION public.replace_standings_row_before_insert();

CREATE OR REPLACE FUNCTION public.replace_sports_standings(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE inserted_count integer;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) <> 22 THEN
    RAISE EXCEPTION 'Standings payload must contain exactly 22 rows (12 A + 10 B)' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE jsonb_typeof(r) <> 'object') THEN
    RAISE EXCEPTION 'Every standings row must be an object' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings, p_rows) s
    WHERE s.team IS NULL OR s.team NOT IN ('A-laget','B-laget')
      OR s.team_name IS NULL OR btrim(s.team_name)='' OR s.team_name <> btrim(s.team_name)
      OR s.season IS NULL OR s.season !~ '^[0-9]{4}$'
      OR s.league IS NULL OR btrim(s.league)=''
      OR s.position IS NULL OR s.position < 1 OR s.position > CASE WHEN s.team='A-laget' THEN 12 ELSE 10 END
      OR s.played IS NULL OR s.played < 0 OR s.played > CASE WHEN s.team='A-laget' THEN 22 ELSE 18 END
      OR s.won IS NULL OR s.won < 0 OR s.drawn IS NULL OR s.drawn < 0 OR s.lost IS NULL OR s.lost < 0
      OR s.played <> s.won+s.drawn+s.lost
      OR s.goals_for IS NULL OR s.goals_for < 0 OR s.goals_against IS NULL OR s.goals_against < 0
      OR s.goal_difference IS NULL OR s.goal_difference <> s.goals_for-s.goals_against
      OR s.points IS NULL OR s.points < 0) THEN
    RAISE EXCEPTION 'Invalid standings team, season, position or statistics' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(DISTINCT season) FROM jsonb_populate_recordset(NULL::public.standings,p_rows)) <> 1
    OR (SELECT count(*) FROM jsonb_populate_recordset(NULL::public.standings,p_rows) WHERE team='A-laget') <> 12
    OR (SELECT count(*) FROM jsonb_populate_recordset(NULL::public.standings,p_rows) WHERE team='B-laget') <> 10
    OR EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings,p_rows)
      GROUP BY team HAVING count(DISTINCT lower(team_name)) <> count(*) OR count(DISTINCT position) <> count(*))
    OR NOT EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings,p_rows) WHERE team='A-laget' AND team_name='Fagerborg')
    OR NOT EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings,p_rows) WHERE team='B-laget' AND team_name='Fagerborg 2') THEN
    RAISE EXCEPTION 'Expected 12 unique A teams + 10 unique B teams with unique positions and club rows' USING ERRCODE='22023';
  END IF;
  -- Serialize replacements and direct table writers. A raised exception rolls
  -- the deletion, every inserted row, and trigger effects back together.
  LOCK TABLE public.standings IN SHARE ROW EXCLUSIVE MODE;
  DELETE FROM public.standings WHERE team IN ('A-laget','B-laget');
  INSERT INTO public.standings(team,team_name,position,played,won,drawn,lost,
    goals_for,goals_against,goal_difference,points,form,league,season,logo_url,team_url)
  SELECT team,team_name,position,played,won,drawn,lost,goals_for,goals_against,
    goal_difference,points,coalesce(form,ARRAY[]::text[]),league,season,logo_url,team_url
  FROM jsonb_populate_recordset(NULL::public.standings,p_rows);
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 22 THEN RAISE EXCEPTION 'Incomplete standings replacement'; END IF;
  RETURN inserted_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.replace_sports_standings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_sports_standings(jsonb) TO service_role;
COMMENT ON FUNCTION public.replace_sports_standings(jsonb) IS 'Backend-only atomic validated 12+10 replacement; any failure preserves previous standings.';

-- Match identifiers are scoped to the tournament, including conflict handling.
CREATE UNIQUE INDEX IF NOT EXISTS division_matches_division_fiks_uidx
  ON public.division_matches(division_fiks_id,fiks_id);
ALTER TABLE public.division_matches DROP CONSTRAINT IF EXISTS division_matches_fiks_id_key;