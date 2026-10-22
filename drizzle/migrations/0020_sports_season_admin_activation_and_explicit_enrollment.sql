ALTER TABLE public.sports_seasons ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.activate_sports_season(p_season integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' AND NOT coalesce(public.is_admin(auth.uid()),false) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 LOCK TABLE public.sports_seasons IN SHARE ROW EXCLUSIVE MODE;
 IF NOT EXISTS(SELECT 1 FROM public.sports_seasons WHERE season=p_season) THEN RAISE EXCEPTION 'Sports season missing'; END IF;
 UPDATE public.sports_seasons SET is_active=false WHERE is_active AND season<>p_season;
 UPDATE public.sports_seasons SET is_active=true WHERE season=p_season;
END; $$;
REVOKE ALL ON FUNCTION public.activate_sports_season(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_sports_season(integer) TO service_role;
COMMENT ON FUNCTION public.activate_sports_season(integer) IS 'Server-only atomic activation after the versioned GitHub sports manifest is confirmed. Does not sync sports data or send email.';

ALTER TABLE public.goal_club_entries ALTER COLUMN season DROP DEFAULT;
CREATE OR REPLACE FUNCTION public.assign_goal_club_season()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE active_season integer;
BEGIN
 SELECT season INTO active_season FROM public.sports_seasons WHERE is_active FOR SHARE;
 IF active_season IS NULL THEN RAISE EXCEPTION 'Active sports season missing'; END IF;
 IF NEW.season IS NOT NULL AND NEW.season<>active_season THEN RAISE EXCEPTION 'Enrollment season must match active sports season'; END IF;
 NEW.season:=active_season;
 RETURN NEW;
END; $$;
COMMENT ON COLUMN public.goal_club_entries.season IS 'Explicit enrollment season. Historical enrollments remain in their original season; omitted season resolves from active configuration, and stale explicit enrollment is rejected.';