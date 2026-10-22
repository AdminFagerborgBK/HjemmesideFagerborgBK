DROP VIEW IF EXISTS public.goal_club_public;
CREATE VIEW public.goal_club_public AS
SELECT id, name, is_company, goal_guess, amount_per_goal, created_at
FROM public.goal_club_entries
WHERE deleted_at IS NULL;
GRANT SELECT ON public.goal_club_public TO anon, authenticated;