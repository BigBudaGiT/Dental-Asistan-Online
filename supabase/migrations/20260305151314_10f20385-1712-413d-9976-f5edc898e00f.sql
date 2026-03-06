
-- Drop all restrictive policies and recreate as permissive

-- appointments
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Service role full access appointments" ON public.appointments;

CREATE POLICY "Authenticated users can read appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full access appointments" ON public.appointments FOR ALL TO service_role USING (true);

-- messages
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.messages;
DROP POLICY IF EXISTS "Service role full access messages" ON public.messages;

CREATE POLICY "Authenticated users can read messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role full access messages" ON public.messages FOR ALL TO service_role USING (true);

-- clinic_settings
DROP POLICY IF EXISTS "Authenticated users can read clinic_settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Authenticated users can update clinic_settings" ON public.clinic_settings;
DROP POLICY IF EXISTS "Service role full access clinic_settings" ON public.clinic_settings;

CREATE POLICY "Authenticated users can read clinic_settings" ON public.clinic_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update clinic_settings" ON public.clinic_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full access clinic_settings" ON public.clinic_settings FOR ALL TO service_role USING (true);

-- Allow service_role to insert into clinic_settings
CREATE POLICY "Service role can insert clinic_settings" ON public.clinic_settings FOR INSERT TO service_role WITH CHECK (true);
