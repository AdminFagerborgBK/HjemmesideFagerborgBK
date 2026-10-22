CREATE OR REPLACE FUNCTION public.replace_sports_standings(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','pg_temp' AS $$
DECLARE c public.sports_seasons; t jsonb; expected integer; actual integer; inserted_count integer;
BEGIN
 SELECT * INTO c FROM public.sports_seasons WHERE is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active sports season missing'; END IF;
 SELECT sum((value->>'expected_teams')::integer) INTO expected FROM jsonb_array_elements(c.teams);
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)<>expected THEN RAISE EXCEPTION 'Incomplete standings payload for season %',c.season USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE jsonb_typeof(r)<>'object') THEN RAISE EXCEPTION 'Invalid standings row'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings,p_rows) s WHERE s.team IS NULL OR s.team NOT IN ('A-laget','B-laget') OR s.team_name IS NULL OR btrim(s.team_name)='' OR s.team_name<>btrim(s.team_name) OR s.season IS DISTINCT FROM c.season::text OR s.league IS NULL OR btrim(s.league)='' OR s.played IS NULL OR s.played<0 OR s.won IS NULL OR s.won<0 OR s.drawn IS NULL OR s.drawn<0 OR s.lost IS NULL OR s.lost<0 OR s.played<>s.won+s.drawn+s.lost OR s.goals_for IS NULL OR s.goals_for<0 OR s.goals_against IS NULL OR s.goals_against<0 OR s.goal_difference IS NULL OR s.goal_difference<>s.goals_for-s.goals_against OR s.points IS NULL OR s.points<0) THEN RAISE EXCEPTION 'Invalid standings season/statistics' USING ERRCODE='22023'; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(c.teams) LOOP
  expected:=(t->>'expected_teams')::int;
  SELECT count(*) INTO actual FROM jsonb_populate_recordset(NULL::public.standings,p_rows) s WHERE s.team=t->>'team';
  IF actual<>expected OR EXISTS(SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings,p_rows) s WHERE s.team=t->>'team' AND (s.position IS NULL OR s.position<1 OR s.position>expected OR s.played>2*(expected-1) OR s.league IS DISTINCT FROM t->>'league')) OR (SELECT count(DISTINCT lower(team_name)) FROM jsonb_populate_recordset(NULL::public.standings,p_rows) s WHERE s.team=t->>'team')<>expected OR (SELECT count(DISTINCT position) FROM jsonb_populate_recordset(NULL::public.standings,p_rows) s WHERE s.team=t->>'team')<>expected OR NOT EXISTS(SELECT 1 FROM jsonb_populate_recordset(NULL::public.standings,p_rows) s WHERE s.team=t->>'team' AND s.team_name=t->>'club_name') THEN RAISE EXCEPTION 'Incomplete/duplicate configured team standings' USING ERRCODE='22023'; END IF;
 END LOOP;
 LOCK TABLE public.standings IN SHARE ROW EXCLUSIVE MODE;
 PERFORM set_config('app.standings_replace','1',true);
 DELETE FROM public.standings WHERE team IN ('A-laget','B-laget') AND season=c.season::text;
 INSERT INTO public.standings(team,team_name,position,played,won,drawn,lost,goals_for,goals_against,goal_difference,points,form,league,season,logo_url,team_url)
 SELECT team,team_name,position,played,won,drawn,lost,goals_for,goals_against,goal_difference,points,coalesce(form,ARRAY[]::text[]),league,season,logo_url,team_url FROM jsonb_populate_recordset(NULL::public.standings,p_rows);
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 IF inserted_count<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Incomplete standings replacement'; END IF;
 PERFORM set_config('app.standings_replace','0',true);
 RETURN inserted_count;
END; $$;
REVOKE ALL ON FUNCTION public.replace_sports_standings(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_sports_standings(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.trigger_goal_club_season_close() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions' AS $$
DECLARE fn_url text; secret text; target_season integer;
BEGIN
 IF NEW.team<>'A-laget' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='matches' THEN
  IF NOT(NEW.status='finished' AND OLD.status IS DISTINCT FROM 'finished') THEN RETURN NEW; END IF;
  target_season:=extract(year FROM NEW.match_date AT TIME ZONE 'Europe/Oslo')::int;
 ELSIF TG_TABLE_NAME='standings' THEN
  target_season:=NEW.season::int;
 ELSE RETURN NEW;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sports_seasons WHERE season=target_season) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.goal_club_season_closures WHERE season=target_season AND status='completed') THEN RETURN NEW; END IF;
 SELECT value #>> '{}' INTO secret FROM public.site_settings WHERE key='cron_sync_secret';
 SELECT value #>> '{}' INTO fn_url FROM public.site_settings WHERE key='functions_base_url';
 IF secret IS NOT NULL AND fn_url IS NOT NULL THEN
  PERFORM net.http_post(url:=fn_url||'/goal-club-season-close',headers:=jsonb_build_object('Content-Type','application/json','x-sync-secret',secret),body:=jsonb_build_object('season',target_season));
 END IF;
 RETURN NEW;
END; $$;
CREATE FUNCTION public.validate_goal_club_invoice_season() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.goal_club_entries WHERE id=NEW.entry_id AND season=NEW.season) THEN RAISE EXCEPTION 'Invoice season must match enrollment season'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_goal_club_invoice_season BEFORE INSERT OR UPDATE OF season,entry_id ON public.goal_club_invoices FOR EACH ROW EXECUTE FUNCTION public.validate_goal_club_invoice_season();