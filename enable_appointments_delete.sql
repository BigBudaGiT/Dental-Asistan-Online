-- Habilitar permisos de eliminación para la tabla appointments
-- Esto permite que el dashboard borre citas que ya no son deseadas.

DO $$ 
BEGIN
  -- Intenta crear la política. Si el RLS no está activo, igual la crea.
  CREATE POLICY "Enable delete access for all users" ON public.appointments FOR DELETE USING (true);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'La política ya existe.';
END $$;
