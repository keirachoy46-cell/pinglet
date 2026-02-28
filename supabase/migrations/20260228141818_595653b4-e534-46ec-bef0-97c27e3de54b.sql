
-- Allow public read of elder_profiles by ID (for elder interface)
CREATE POLICY "Public can view elder profile by id"
ON public.elder_profiles
FOR SELECT
USING (true);

-- Allow public read of notification_templates (elder interface needs template text)
CREATE POLICY "Public can view notification templates"
ON public.notification_templates
FOR SELECT
USING (true);

-- Drop the restrictive-only elder view policies and replace with permissive ones
-- notification_instances already has permissive "Elder can view own instances" with USING (true)
-- mood_settings already has "Anyone can view mood settings" with USING (true)
