
-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  appointment_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Clinic settings table (singleton row)
CREATE TABLE public.clinic_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  clinic_name TEXT,
  clinic_address TEXT,
  clinic_phone TEXT,
  clinic_email TEXT,
  working_hours TEXT,
  services TEXT[],
  about_clinic TEXT,
  whatsapp_webhook_url TEXT,
  timezone TEXT DEFAULT 'America/Mexico_City',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

-- Insert default clinic settings
INSERT INTO public.clinic_settings (clinic_name, services) VALUES ('Mi Clínica Dental', ARRAY['Limpieza dental', 'Ortodoncia', 'Blanqueamiento']);

-- RLS: Authenticated users can read/write all data (single-clinic app)
CREATE POLICY "Authenticated users can read messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read clinic_settings" ON public.clinic_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update clinic_settings" ON public.clinic_settings FOR UPDATE TO authenticated USING (true);

-- Service role policies for edge functions (webhooks)
CREATE POLICY "Service role full access messages" ON public.messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access appointments" ON public.appointments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access clinic_settings" ON public.clinic_settings FOR ALL USING (auth.role() = 'service_role');
