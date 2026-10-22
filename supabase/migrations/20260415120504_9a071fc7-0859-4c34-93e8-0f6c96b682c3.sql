
-- Add deleted_at column for soft-delete
ALTER TABLE public.goal_club_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Update public view to exclude soft-deleted entries
DROP VIEW IF EXISTS public.goal_club_public;
CREATE VIEW public.goal_club_public AS
SELECT id, name, is_company, goal_guess, created_at
FROM public.goal_club_entries
WHERE deleted_at IS NULL;

-- Update public SELECT policy to exclude soft-deleted
DROP POLICY IF EXISTS "Public can view goal club entries" ON public.goal_club_entries;
CREATE POLICY "Public can view goal club entries"
ON public.goal_club_entries
FOR SELECT
USING (deleted_at IS NULL OR is_admin(auth.uid()));
