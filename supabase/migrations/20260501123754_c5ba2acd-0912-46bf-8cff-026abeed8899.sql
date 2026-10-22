ALTER TABLE public.goal_club_entries ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

DROP VIEW IF EXISTS public.goal_club_public;
CREATE VIEW public.goal_club_public
WITH (security_invoker = off)
AS
SELECT
  id,
  CASE WHEN is_anonymous THEN 'Anonym' ELSE name END AS name,
  CASE WHEN is_anonymous THEN false ELSE is_company END AS is_company,
  goal_guess,
  amount_per_goal,
  created_at,
  is_anonymous
FROM public.goal_club_entries
WHERE deleted_at IS NULL;

GRANT SELECT ON public.goal_club_public TO anon, authenticated;