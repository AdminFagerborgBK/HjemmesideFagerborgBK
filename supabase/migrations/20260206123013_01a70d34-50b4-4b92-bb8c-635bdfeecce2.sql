-- Allow admins to manage historical standings
CREATE POLICY "Admins can insert historical standings"
ON public.historical_standings
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update historical standings"
ON public.historical_standings
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete historical standings"
ON public.historical_standings
FOR DELETE
USING (is_admin(auth.uid()));