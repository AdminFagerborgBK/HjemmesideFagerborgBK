-- Allow admins to manage all news articles
CREATE POLICY "Admins can manage all news"
ON public.news
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));