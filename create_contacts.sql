-- 1. Crear la tabla de contactos
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Hilar permisos para que la aplicación React pueda leer y escribir libremente
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write access for all users" ON public.contacts FOR ALL USING (true);

-- 3. (Opcional pero recomendado) Forzar la recarga del caché de la API
NOTIFY pgrst, 'reload schema';
