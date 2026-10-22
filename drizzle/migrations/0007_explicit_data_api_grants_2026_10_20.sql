-- Explicit Data API grants for every public table/view (Supabase 2026-10-30 change).
-- Least privilege per role, derived from existing RLS policies. RLS is unchanged.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['activity_log','admin_role_definitions','division_matches','goal_club_entries','graphic_backgrounds','grasrot_fetch_status','grasrot_yearly','historical_standings','instagram_feed_cache','instagram_feed_oauth_states','instagram_posts','livestream_access','livestream_otp','livestream_stats','matches','memberships','news','newsletter_recipients','newsletters','player_agreements','player_applications','player_enrollment_settings','player_invitations','player_onboarding_events','players','site_pages','site_posts','site_roster','site_settings','site_sponsors','site_videos','sponsor_clicks','standings','sync_status','user_roles','venues','video_clicks','matches_public','site_videos_public','goal_club_public','site_roster_public']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- anon: public reads
GRANT SELECT ON public.division_matches, public.graphic_backgrounds, public.grasrot_fetch_status, public.grasrot_yearly, public.historical_standings, public.instagram_posts, public.news, public.players, public.site_pages, public.site_posts, public.site_settings, public.site_sponsors, public.standings, public.venues, public.matches_public, public.site_videos_public, public.goal_club_public, public.site_roster_public TO anon;
-- anon: public insert flows
GRANT INSERT ON public.memberships, public.goal_club_entries, public.sponsor_clicks, public.video_clicks, public.livestream_stats TO anon;

-- authenticated: operations covered by RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_role_definitions, public.division_matches, public.goal_club_entries, public.graphic_backgrounds, public.historical_standings, public.instagram_posts, public.matches, public.memberships, public.news, public.newsletters, public.site_pages, public.site_posts, public.site_roster, public.site_settings, public.site_sponsors, public.site_videos, public.user_roles, public.venues TO authenticated;
GRANT SELECT, INSERT ON public.activity_log, public.livestream_stats, public.sponsor_clicks, public.video_clicks TO authenticated;
GRANT SELECT ON public.grasrot_fetch_status, public.grasrot_yearly, public.livestream_access, public.newsletter_recipients, public.player_agreements, public.player_applications, public.player_enrollment_settings, public.player_onboarding_events, public.players, public.standings, public.sync_status, public.matches_public, public.site_videos_public, public.goal_club_public, public.site_roster_public TO authenticated;
-- Not granted to anon/authenticated (service_role only): instagram_feed_cache, instagram_feed_oauth_states, livestream_otp, player_invitations.