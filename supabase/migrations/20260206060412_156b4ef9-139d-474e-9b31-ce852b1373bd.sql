-- Add RLS policies for admins to manage matches
CREATE POLICY "Admins can insert matches" 
ON public.matches 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update matches" 
ON public.matches 
FOR UPDATE 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete matches" 
ON public.matches 
FOR DELETE 
USING (is_admin(auth.uid()));