-- Add soft-delete column
ALTER TABLE public.news ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Update RLS: published news excludes soft-deleted
DROP POLICY IF EXISTS "Published news are publicly viewable" ON public.news;
CREATE POLICY "Published news are publicly viewable"
  ON public.news FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);
