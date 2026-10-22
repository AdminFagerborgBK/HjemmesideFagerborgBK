-- Allow admins to insert into activity_log
CREATE POLICY "Admins can insert activity logs"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Allow admins to view activity logs
CREATE POLICY "Admins can view activity logs"
ON public.activity_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));