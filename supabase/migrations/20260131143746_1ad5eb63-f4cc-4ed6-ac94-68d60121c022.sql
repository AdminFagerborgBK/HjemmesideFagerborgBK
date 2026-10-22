-- Create grasrot_fetch_status table for tracking scraper status
CREATE TABLE public.grasrot_fetch_status (
  id integer PRIMARY KEY DEFAULT 1,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  last_source_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO public.grasrot_fetch_status (id) VALUES (1);

-- Enable RLS
ALTER TABLE public.grasrot_fetch_status ENABLE ROW LEVEL SECURITY;

-- Public read access for fetch status
CREATE POLICY "Fetch status is publicly viewable"
ON public.grasrot_fetch_status
FOR SELECT
USING (true);

-- Add num_supporters column to grasrot_yearly if not exists
ALTER TABLE public.grasrot_yearly 
ADD COLUMN IF NOT EXISTS num_supporters integer DEFAULT 0;

-- Create activity_log table for tracking updates
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on activity_log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Only allow server-side insert to activity_log (no public access)
CREATE POLICY "Activity log is not publicly accessible"
ON public.activity_log
FOR SELECT
USING (false);