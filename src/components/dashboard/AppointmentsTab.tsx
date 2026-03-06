import { useState } from "react";
import { Calendar, Clock, XCircle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statusConfig = {
  confirmed: { label: "Confirmada", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-600 border-amber-200" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/20" },
  completed: { label: "Completada", className: "bg-primary/10 text-primary border-primary/20" },
} as const;

const AppointmentsTab = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingApt, setEditingApt] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    patient_name: "",
    phone_number: "",
    appointment_date: "",
    appointment_time: "",
    status: "",
    notes: "",
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const today = new Date().toISOString().split("T")[0];
  const todayCount = appointments.filter((a) => a.appointment_date.startsWith(today)).length;
  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;

  const stats = [
    { label: "Citas Hoy", value: todayCount.toString(), icon: Calendar, color: "text-primary" },
    { label: "Pendientes", value: pendingCount.toString(), icon: Clock, color: "text-amber-500" },
    { label: "Confirmadas", value: confirmedCount.toString(), icon: CheckCircle2, color: "text-success" },
    { label: "Canceladas", value: cancelledCount.toString(), icon: XCircle, color: "text-destructive" },
  ];

  const handleEdit = (apt: any) => {
    // Convierte el ISO "2024-03-20T14:30:00Z" a fecha y hora locales para los inputs
    const d = new Date(apt.appointment_date);
    const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    // localISOTime format is "YYYY-MM-DDTHH:mm"
    const [dateStr, timeStr] = localISOTime.split("T");

    setEditForm({
      patient_name: apt.patient_name,
      phone_number: apt.phone_number,
      appointment_date: dateStr,
      appointment_time: timeStr,
      status: apt.status,
      notes: apt.notes || "",
    });
    setEditingApt(apt);
  };

  const handleSave = async () => {
    if (!editingApt) return;
    setIsSaving(true);

    try {
      // Reconstuir el timestamp UTC guardando la zona horaria del usuario
      const localDate = new Date(`${editForm.appointment_date}T${editForm.appointment_time}`);
      const utcString = localDate.toISOString();

      const { error } = await supabase
        .from("appointments")
        .update({
          patient_name: editForm.patient_name,
          phone_number: editForm.phone_number,
          appointment_date: utcString,
          status: editForm.status,
          notes: editForm.notes,
        })
        .eq("id", editingApt.id);

      if (error) throw error;

      toast({ title: "Cita actualizada", description: "Los cambios han sido guardados." });
      setEditingApt(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar la cita.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editingApt) return;
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!editingApt) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", editingApt.id);
      if (error) throw error;

      toast({ title: "Cita borrada", description: "La cita ha sido eliminada del sistema." });
      setEditingApt(null);
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo eliminar la cita.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold">Próximas Citas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground bg-muted/10 border-t border-dashed rounded-b-xl flex flex-col items-center gap-3">
              <Calendar className="w-10 h-10 opacity-20" />
              <p className="text-sm max-w-[250px]">No hay citas registradas aún. Las reservadas por WhatsApp aparecerán aquí.</p>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Paciente</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Teléfono</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Servicio</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((apt) => {
                      const status = apt.status as keyof typeof statusConfig;
                      return (
                        <tr
                          key={apt.id}
                          onClick={() => handleEdit(apt)}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-medium text-foreground">{apt.patient_name}</td>
                          <td className="p-3 text-muted-foreground">{apt.phone_number}</td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(apt.appointment_date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} Hs
                          </td>
                          <td className="p-3 text-muted-foreground">{apt.appointment_type || "-"}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={statusConfig[status]?.className || ""}>
                              {statusConfig[status]?.label || apt.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW: Stacked Cards */}
              <div className="md:hidden flex flex-col divide-y divide-border/50">
                {appointments.map((apt) => {
                  const status = apt.status as keyof typeof statusConfig;
                  const dateObj = new Date(apt.appointment_date);

                  return (
                    <div
                      key={apt.id}
                      onClick={() => handleEdit(apt)}
                      className="p-4 flex flex-col gap-3 active:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{apt.patient_name}</p>
                          <p className="text-sm text-muted-foreground truncate">{apt.phone_number}</p>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ${statusConfig[status]?.className || ""}`}>
                          {statusConfig[status]?.label || apt.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-muted/30 p-2.5 rounded-lg flex-wrap">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          <span>{dateObj.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          <span>{dateObj.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })} Hs</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                          <span className="truncate">{apt.appointment_type || "Cita General"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>


      {/* Modal para editar cita */}
      <Dialog open={!!editingApt} onOpenChange={(open) => !open && setEditingApt(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Cita</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Paciente</label>
              <Input
                value={editForm.patient_name}
                onChange={(e) => setEditForm({ ...editForm, patient_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Teléfono</label>
              <Input
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Día</label>
              <Input
                type="date"
                value={editForm.appointment_date}
                onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Hora</label>
              <div className="col-span-3 flex items-center gap-2">
                <Select
                  value={editForm.appointment_time.split(":")[0] || "00"}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, appointment_time: `${val}:${prev.appointment_time.split(":")[1] || "00"}` }))}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => {
                      const h = i.toString().padStart(2, "0");
                      return <SelectItem key={h} value={h}>{h}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <span className="font-bold text-muted-foreground">:</span>
                <Select
                  value={editForm.appointment_time.split(":")[1] || "00"}
                  onValueChange={(val) => setEditForm(prev => ({ ...prev, appointment_time: `${prev.appointment_time.split(":")[0] || "00"}:${val}` }))}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 60 }).map((_, i) => {
                      const m = i.toString().padStart(2, "0");
                      return <SelectItem key={m} value={m}>{m}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Estado</label>
              <div className="col-span-3">
                <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="confirmed">Confirmada</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <label className="text-right text-sm font-medium pt-2">Notas</label>
              <Textarea
                placeholder="Notas adicionales (alergias, observaciones, etc.)..."
                className="col-span-3 resize-none"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between gap-3 mt-4 border-t pt-4">
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving} className="w-full md:w-auto order-3 md:order-1">
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Cita
            </Button>
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto order-1 md:order-2">
              <Button variant="outline" onClick={() => setEditingApt(null)} disabled={isSaving} className="w-full md:w-auto order-2 md:order-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto order-1 md:order-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminación */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-foreground">
              ¿Estás seguro de que deseas eliminar la cita de <span className="font-semibold">{editingApt?.patient_name}</span>?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Esta acción no se puede deshacer y el turno quedará librado en la base de datos.
            </p>
          </div>
          <div className="flex flex-col md:flex-row justify-end gap-3 mt-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSaving} className="w-full md:w-auto order-2 md:order-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving} className="w-full md:w-auto order-1 md:order-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Sí, eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsTab;
