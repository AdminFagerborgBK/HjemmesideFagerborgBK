CREATE TABLE public.goal_club_season_closures (
  season integer PRIMARY KEY,
  goals integer NOT NULL,
  final_position integer,
  league text,
  status text NOT NULL DEFAULT 'sending',
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
REVOKE ALL ON public.goal_club_season_closures FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.goal_club_season_closures TO authenticated;
GRANT ALL ON public.goal_club_season_closures TO service_role;
ALTER TABLE public.goal_club_season_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read closures" ON public.goal_club_season_closures FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.goal_club_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  entry_id uuid NOT NULL REFERENCES public.goal_club_entries(id),
  email text NOT NULL,
  name text NOT NULL,
  amount_per_goal integer NOT NULL,
  goals integer NOT NULL,
  total_nok integer NOT NULL,
  reference text NOT NULL UNIQUE,
  due_date date NOT NULL,
  is_winner boolean NOT NULL DEFAULT false,
  email_state text NOT NULL DEFAULT 'pending',
  email_id text,
  email_error text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, entry_id)
);
REVOKE ALL ON public.goal_club_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.goal_club_invoices TO authenticated;
GRANT ALL ON public.goal_club_invoices TO service_role;
ALTER TABLE public.goal_club_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read invoices" ON public.goal_club_invoices FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.trigger_goal_club_season_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE fn_url text; secret text;
BEGIN
  IF NEW.team <> 'A-laget' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'matches' AND NOT (NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished') THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.goal_club_season_closures WHERE season = extract(year FROM now() AT TIME ZONE 'Europe/Oslo')::int) THEN RETURN NEW; END IF;
  SELECT value #>> '{}' INTO secret FROM public.site_settings WHERE key = 'cron_sync_secret';
  SELECT value #>> '{}' INTO fn_url FROM public.site_settings WHERE key = 'functions_base_url';
  IF secret IS NOT NULL AND fn_url IS NOT NULL THEN
    PERFORM net.http_post(url := fn_url || '/goal-club-season-close',
      headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',secret), body := '{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trigger_goal_club_season_close() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_goal_club_close_matches AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.trigger_goal_club_season_close();
CREATE TRIGGER trg_goal_club_close_standings AFTER UPDATE ON public.standings FOR EACH ROW WHEN (NEW.team_name = 'Fagerborg' AND NEW.played IS DISTINCT FROM OLD.played) EXECUTE FUNCTION public.trigger_goal_club_season_close();