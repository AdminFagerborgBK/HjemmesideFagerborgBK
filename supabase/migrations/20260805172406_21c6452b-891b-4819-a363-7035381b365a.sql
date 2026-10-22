ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS team_group text,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';