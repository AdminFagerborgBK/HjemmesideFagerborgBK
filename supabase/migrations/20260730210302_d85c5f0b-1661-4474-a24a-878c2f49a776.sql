ALTER TABLE public.news ADD COLUMN IF NOT EXISTS carousel_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY published_at DESC) AS rn
  FROM public.news
  WHERE is_featured = true AND deleted_at IS NULL
)
UPDATE public.news n SET carousel_order = ranked.rn
FROM ranked WHERE n.id = ranked.id;