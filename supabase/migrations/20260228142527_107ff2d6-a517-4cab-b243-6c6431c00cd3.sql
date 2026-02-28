
-- Drop restrictive SELECT policies that block unauthenticated elder access
DROP POLICY IF EXISTS "Family can view linked elders" ON public.elder_profiles;
DROP POLICY IF EXISTS "Public can view elder profile by id" ON public.elder_profiles;

DROP POLICY IF EXISTS "Family can view templates" ON public.notification_templates;
DROP POLICY IF EXISTS "Public can view notification templates" ON public.notification_templates;

-- Recreate as PERMISSIVE policies (default) so either can grant access
CREATE POLICY "Anyone can view elder profiles"
ON public.elder_profiles FOR SELECT
USING (true);

CREATE POLICY "Anyone can view notification templates"
ON public.notification_templates FOR SELECT
USING (true);
