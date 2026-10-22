-- Allow admins to read memberships
CREATE POLICY "Admins can read memberships"
ON public.memberships
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to update memberships
CREATE POLICY "Admins can update memberships"
ON public.memberships
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to delete memberships
CREATE POLICY "Admins can delete memberships"
ON public.memberships
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));