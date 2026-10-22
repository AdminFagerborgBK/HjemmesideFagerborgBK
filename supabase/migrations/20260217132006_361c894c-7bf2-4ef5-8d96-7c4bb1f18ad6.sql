
-- Table for storing background images used in graphic generators
CREATE TABLE public.graphic_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.graphic_backgrounds ENABLE ROW LEVEL SECURITY;

-- Public can view backgrounds
CREATE POLICY "Backgrounds are publicly viewable"
ON public.graphic_backgrounds
FOR SELECT
USING (true);

-- Admins can manage backgrounds
CREATE POLICY "Admins can manage backgrounds"
ON public.graphic_backgrounds
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_graphic_backgrounds_updated_at
BEFORE UPDATE ON public.graphic_backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default at a time via a function
CREATE OR REPLACE FUNCTION public.ensure_single_default_background()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.graphic_backgrounds SET is_default = false WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_bg
BEFORE INSERT OR UPDATE ON public.graphic_backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_background();
