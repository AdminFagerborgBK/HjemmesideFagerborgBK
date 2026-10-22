-- Run once AFTER both migration histories when rebuilding a new empty backend.
-- Never reactivate or overwrite an existing season configuration.
INSERT INTO public.sports_seasons(season,is_active,timezone,teams)
SELECT 2026, NOT EXISTS(SELECT 1 FROM public.sports_seasons WHERE is_active), 'Europe/Oslo',
'[{"team":"A-laget","tournament_id":"205403","team_id":"311","expected_teams":12,"league":"5. divisjon avd. 01","club_name":"Fagerborg"},{"team":"B-laget","tournament_id":"205410","team_id":"6458","expected_teams":10,"league":"7. divisjon avd. 02","club_name":"Fagerborg 2"}]'::jsonb
WHERE NOT EXISTS(SELECT 1 FROM public.sports_seasons WHERE season=2026)
ON CONFLICT(season) DO NOTHING;