-- Allow family members to delete notification instances for their linked elders
CREATE POLICY "Family can delete instances"
  ON public.notification_instances
  FOR DELETE
  USING (is_family_linked(auth.uid(), elder_profile_id));