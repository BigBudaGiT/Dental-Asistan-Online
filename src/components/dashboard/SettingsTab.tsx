import { useState, useEffect } from "react";
import { Save, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const timeOptions = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return `${hour}:00`;
});

const defaultSchedule = [
  { day: "Lunes", active: true, start: "09:00", end: "18:00" },
  { day: "Martes", active: true, start: "09:00", end: "18:00" },
  { day: "Miércoles", active: true, start: "09:00", end: "18:00" },
  { day: "Jueves", active: true, start: "09:00", end: "18:00" },
  { day: "Viernes", active: true, start: "09:00", end: "18:00" },
  { day: "Sábado", active: false, start: "09:00", end: "13:00" },
  { day: "Domingo", active: false, start: "09:00", end: "13:00" },
];

const timezonesList = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Mexico_City", label: "México (CDMX)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
  { value: "America/New_York", label: "EE.UU. (New York)" },
  { value: "UTC", label: "Tiempo Universal Coordinado (UTC)" }
];

const SettingsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["clinic_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    clinic_email: "",
    about_clinic: "",
    ai_tone: "",
    whatsapp_webhook_url: "",
    timezone: "America/Mexico_City",
  });

  const [services, setServices] = useState<string[]>([]);
  const [newService, setNewService] = useState("");
  const [schedule, setSchedule] = useState(defaultSchedule);

  useEffect(() => {
    if (settings) {
      setForm({
        clinic_name: settings.clinic_name || "",
        clinic_address: settings.clinic_address || "",
        clinic_phone: settings.clinic_phone || "",
        clinic_email: settings.clinic_email || "",
        about_clinic: settings.about_clinic || "",
        ai_tone: settings.ai_tone || "",
        whatsapp_webhook_url: settings.whatsapp_webhook_url || "",
        timezone: settings.timezone || "America/Mexico_City",
      });

      setServices(settings.services || []);

      if (settings.working_hours) {
        try {
          const parsed = JSON.parse(settings.working_hours);
          if (Array.isArray(parsed) && parsed.length === 7) {
            setSchedule(parsed);
          }
        } catch (e) {
          // Si no es JSON válido (formato viejo), mantenemos el defaultSchedule
          console.log("Formato antiguo de working_hours detectado");
        }
      }
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clinic_settings").update({
        ...form,
        services: services,
        working_hours: JSON.stringify(schedule),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic_settings"] });
      toast({ title: "Configuración guardada", description: "Los datos se actualizaron correctamente." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()]);
      setNewService("");
    }
  };

  const removeService = (srv: string) => {
    setServices(services.filter(s => s !== srv));
  };

  const updateSchedule = (index: number, field: string, value: any) => {
    const newSchedule = [...schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setSchedule(newSchedule);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Datos de la Clínica</CardTitle>
          <CardDescription>Información básica y de contacto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Nombre de la Clínica</Label>
              <Input className="mt-1.5" value={form.clinic_name} onChange={(e) => handleChange("clinic_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Teléfono</Label>
              <Input className="mt-1.5" value={form.clinic_phone} onChange={(e) => handleChange("clinic_phone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Dirección</Label>
            <Input className="mt-1.5" value={form.clinic_address} onChange={(e) => handleChange("clinic_address", e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Correo Electrónico</Label>
              <Input className="mt-1.5" value={form.clinic_email} onChange={(e) => handleChange("clinic_email", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium">Tono de la IA</Label>
              <Input className="mt-1.5" placeholder="Ej. Profesional y amable..." value={form.ai_tone} onChange={(e) => handleChange("ai_tone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Acerca de la Clínica</Label>
            <Textarea className="mt-1.5" rows={3} value={form.about_clinic} onChange={(e) => handleChange("about_clinic", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Horarios de Atención</CardTitle>
          <CardDescription>Configura los días y horarios en los que la clínica recibe pacientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule.map((day, idx) => (
            <div key={day.day} className="flex items-center justify-between gap-4 p-3 bg-muted/40 rounded-lg border border-border/50">
              <div className="flex items-center gap-3 w-32">
                <Switch
                  checked={day.active}
                  onCheckedChange={(val) => updateSchedule(idx, "active", val)}
                />
                <Label className={`text-sm font-medium ${!day.active && 'text-muted-foreground line-through'}`}>
                  {day.day}
                </Label>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-[320px]">
                <Select
                  value={day.start}
                  onValueChange={(val) => updateSchedule(idx, "start", val)}
                  disabled={!day.active}
                >
                  <SelectTrigger className="w-full text-center">
                    <SelectValue placeholder="Inicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={`start-${time}`} value={time}>{time} Hs</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-sm font-medium">a</span>
                <Select
                  value={day.end}
                  onValueChange={(val) => updateSchedule(idx, "end", val)}
                  disabled={!day.active}
                >
                  <SelectTrigger className="w-full text-center">
                    <SelectValue placeholder="Fin" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem key={`end-${time}`} value={time}>{time} Hs</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Servicios</CardTitle>
          <CardDescription>Lista de tratamientos que ofrece tu clínica. La IA los usará para ofrecerlos u organizar turnos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {services.map(srv => (
              <Badge key={srv} variant="secondary" className="px-3 py-1 text-sm bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2">
                {srv}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive transition-colors"
                  onClick={() => removeService(srv)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nuevo servicio... (Ej. Limpieza facial)"
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addService()}
            />
            <Button variant="outline" size="icon" onClick={addService} type="button">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Integración & Región</CardTitle>
          <CardDescription>Configuración de webhooks y zona horaria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Zona horaria</Label>
            <Select value={form.timezone} onValueChange={(val) => handleChange("timezone", val)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecciona una zona horaria" />
              </SelectTrigger>
              <SelectContent>
                {timezonesList.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Vital para que los turnos agendados por IA tengan la fecha y hora correctas en tu país.
            </p>
          </div>
          <div className="pt-2 border-t mt-4">
            <Label className="text-sm font-medium pt-2 block">URL del Webhook (Twilio)</Label>
            <Input
              className="mt-1.5"
              placeholder="https://tu-proyecto.supabase.co/functions/v1/twilio-webhook-whatsapp"
              value={form.whatsapp_webhook_url}
              onChange={(e) => handleChange("whatsapp_webhook_url", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} className="gap-2 px-8" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};

export default SettingsTab;
