
DROP VIEW IF EXISTS public.goal_club_public;
CREATE VIEW public.goal_club_public
WITH (security_invoker = off)
AS SELECT id, name, is_company, goal_guess, created_at
FROM public.goal_club_entries;
