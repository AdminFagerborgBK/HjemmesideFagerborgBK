-- Create standings table for league tables
CREATE TABLE public.standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT NOT NULL,
  team_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_difference INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  form TEXT[] DEFAULT ARRAY[]::TEXT[],
  league TEXT NOT NULL DEFAULT '5. divisjon',
  season TEXT NOT NULL DEFAULT '2026',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (league tables are public)
CREATE POLICY "Standings are viewable by everyone" 
ON public.standings 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_standings_updated_at
BEFORE UPDATE ON public.standings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();