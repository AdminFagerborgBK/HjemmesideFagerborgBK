
CREATE TABLE public.goal_club_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_company BOOLEAN NOT NULL DEFAULT false,
  phone TEXT,
  email TEXT NOT NULL,
  amount_per_goal INTEGER NOT NULL DEFAULT 10,
  goal_guess INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_club_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can sign up
CREATE POLICY "Anyone can submit goal club entry"
ON public.goal_club_entries
FOR INSERT
WITH CHECK (true);

-- Public can see names and guesses only (via a view below)
CREATE POLICY "Public can view goal club entries"
ON public.goal_club_entries
FOR SELECT
USING (true);

-- Admins can manage all
CREATE POLICY "Admins can manage goal club entries"
ON public.goal_club_entries
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Public view that hides sensitive data
CREATE VIEW public.goal_club_public AS
SELECT id, name, is_company, goal_guess, created_at
FROM public.goal_club_entries;
