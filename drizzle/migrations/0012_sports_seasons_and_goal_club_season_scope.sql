CREATE TABLE public.sports_seasons (
 season integer PRIMARY KEY CHECK (season BETWEEN 2000 AND 2200),
 is_active boolean NOT NULL DEFAULT false,
 timezone text NOT NULL DEFAULT 'Europe/Oslo' CHECK (timezone = 'Europe/Oslo'),
 teams jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sports_seasons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sports_seasons TO anon, authenticated;
GRANT INSERT, UPDATE ON public.sports_seasons TO authenticated;
GRANT ALL ON public.sports_seasons TO service_role;
ALTER TABLE public.sports_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY sports_seasons_public_read ON public.sports_seasons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sports_seasons_admin_insert ON public.sports_seasons FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY sports_seasons_admin_update ON public.sports_seasons FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE UNIQUE INDEX sports_seasons_single_active ON public.sports_seasons(is_active) WHERE is_active;
CREATE FUNCTION public.validate_sports_season() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE t jsonb; label text;
BEGIN
 IF jsonb_typeof(NEW.teams) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.teams)<>2 THEN RAISE EXCEPTION 'Exactly A and B configuration required'; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(NEW.teams) LOOP
  IF t->>'team' NOT IN ('A-laget','B-laget') OR coalesce(t->>'team','')='' OR coalesce(t->>'tournament_id','') !~ '^[0-9]+$' OR coalesce(t->>'team_id','') !~ '^[0-9]+$' OR coalesce(t->>'expected_teams','') !~ '^[0-9]+$' OR (t->>'expected_teams')::int NOT BETWEEN 2 AND 32 OR coalesce(btrim(t->>'league'),'')='' OR coalesce(btrim(t->>'club_name'),'')='' THEN RAISE EXCEPTION 'Invalid sports team configuration'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'team') FROM jsonb_array_elements(NEW.teams))<>2 OR (SELECT count(DISTINCT value->>'tournament_id') FROM jsonb_array_elements(NEW.teams))<>2 THEN RAISE EXCEPTION 'Team and tournament IDs must be unique'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END; $$;
CREATE TRIGGER validate_sports_season BEFORE INSERT OR UPDATE ON public.sports_seasons FOR EACH ROW EXECUTE FUNCTION public.validate_sports_season();
ALTER TABLE public.goal_club_entries ADD COLUMN season integer NOT NULL DEFAULT 2026;
UPDATE public.goal_club_entries SET season=2026 WHERE season IS DISTINCT FROM 2026;
CREATE INDEX goal_club_entries_season_idx ON public.goal_club_entries(season,deleted_at);
CREATE OR REPLACE VIEW public.goal_club_public AS
 SELECT id, CASE WHEN is_anonymous THEN 'Anonym'::text ELSE name END AS name,
 CASE WHEN is_anonymous THEN false ELSE is_company END AS is_company,
 goal_guess, amount_per_goal, created_at, is_anonymous, season
 FROM public.goal_club_entries WHERE deleted_at IS NULL;
REVOKE ALL ON public.goal_club_public FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.goal_club_public TO anon,authenticated;
GRANT ALL ON public.goal_club_public TO service_role;
CREATE FUNCTION public.assign_goal_club_season() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE active_season integer;
BEGIN
 SELECT season INTO active_season FROM public.sports_seasons WHERE is_active;
 IF active_season IS NULL THEN RAISE EXCEPTION 'Active sports season missing'; END IF;
 NEW.season:=active_season; RETURN NEW;
END; $$;
CREATE TRIGGER assign_goal_club_season BEFORE INSERT ON public.goal_club_entries FOR EACH ROW EXECUTE FUNCTION public.assign_goal_club_season();
COMMENT ON COLUMN public.goal_club_entries.season IS 'Explicit enrollment season; existing entries preserved as 2026, new inserts assigned from active sports season.';