import { useState } from "react";
import { Calendar, Clock, XCircle, CheckCircle2, Loader2, Trash2, Plus, FileText, Paperclip, Download, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    patient_name: "",
    phone_number: "",
    appointment_date: "",
    appointment_time: "",
    status: "",
    notes: "",
  });
  const [newForm, setNewForm] = useState({
    patient_name: "",
    phone_number: "",
    appointment_date: "",
    appointment_time: "",
    appointment_type: "",
    notes: "",
  });

  // Attachments State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/bmp", "image/tiff", "image/webp",
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
    "text/xml", "application/xml"
  ];

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

  const exportToExcel = () => {
    if (appointments.length === 0) {
      toast({ title: "Sin datos", description: "No hay citas para exportar.", variant: "destructive" });
      return;
    }

    const exportData = appointments.map(apt => {
      const dateObj = new Date(apt.appointment_date);
      const dateStr = dateObj.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
      const timeStr = dateObj.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

      const statusMap: Record<string, string> = {
        pending: "Pendiente",
        confirmed: "Confirmada",
        completed: "Completada",
        cancelled: "Cancelada"
      };

      return {
        "Paciente": apt.patient_name,
        "Teléfono": apt.phone_number,
        "Fecha": dateStr,
        "Hora": `${timeStr} Hs`,
        "Servicio": apt.appointment_type || "Cita General",
        "Estado": statusMap[apt.status] || apt.status,
        "Avisado": apt.reminder_sent ? "Sí" : "No",
        "Notas": apt.notes || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Citas");

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 25 }, // Paciente
      { wch: 15 }, // Teléfono
      { wch: 20 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 20 }, // Servicio
      { wch: 15 }, // Estado
      { wch: 10 }, // Avisado
      { wch: 40 }, // Notas
    ];
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `Agenda_Citas_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exportación exitosa", description: "El archivo Excel se ha descargado correctamente." });
  };

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
    setSelectedFiles([]);
    loadExistingFiles(apt.id);
  };

  const loadExistingFiles = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.storage.from("attachments").list(appointmentId);
      if (error) {
        console.error("Error loading files:", error);
        setExistingFiles([]);
        return;
      }

      // Filter out weird empty hidden files sometimes created by storage
      const validFiles = data?.filter(f => f.name !== ".emptyFolderPlaceholder") || [];

      // Get public URLs for each file
      const filesWithUrls = validFiles.map(file => {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(`${appointmentId}/${file.name}`);
        return {
          ...file,
          publicUrl: urlData.publicUrl
        };
      });

      setExistingFiles(filesWithUrls);
    } catch (err) {
      console.error(err);
      setExistingFiles([]);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);

    // Check total count
    if (selectedFiles.length + existingFiles.length + files.length > MAX_FILES) {
      toast({ title: "Límite excedido", description: `Solo puedes adjuntar un máximo de ${MAX_FILES} archivos por cita.`, variant: "destructive" });
      return;
    }

    // Validate type and size
    const validFiles = files.filter(file => {
      // Cast file to standard File to resolve TS unknown errors inside the array.from
      const f = file as File;
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast({ title: "Archivo no soportado", description: `${f.name} tiene un formato no válido. Usa imágenes, PDF, Word o Excel.`, variant: "destructive" });
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: "Archivo muy pesado", description: `${f.name} supera los 6MB permitidos.`, variant: "destructive" });
        return false;
      }
      return true;
    }) as File[];

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const deleteExistingFile = async (fileName: string) => {
    if (!editingApt) return;
    try {
      const { error } = await supabase.storage.from("attachments").remove([`${editingApt.id}/${fileName}`]);
      if (error) throw error;

      toast({ title: "Archivo eliminado", description: `El archivo ${fileName} ha sido borrado.` });
      setExistingFiles(prev => prev.filter(f => f.name !== fileName));
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo eliminar el archivo.", variant: "destructive" });
    }
  };

  const uploadFiles = async (appointmentId: string) => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of selectedFiles) {
        // Clean filename and add timestamp to avoid overwriting
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}_${safeName}`;
        const filePath = `${appointmentId}/${fileName}`;

        const { error } = await supabase.storage.from("attachments").upload(filePath, file);
        if (error) {
          console.error("Upload error for", file.name, error);
          toast({ title: "Error al subir", description: `No se pudo subir ${file.name}`, variant: "destructive" });
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({ title: "Archivos subidos", description: `Se anexaron ${successCount} archivos a la cita correctamente.` });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      setSelectedFiles([]);
      if (editingApt && editingApt.id === appointmentId) {
        loadExistingFiles(appointmentId);
      }
    }
  }

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

      // Try to upload pending files if any
      await uploadFiles(editingApt.id);

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

  const handleCreate = async () => {
    if (!newForm.patient_name || !newForm.phone_number || !newForm.appointment_date || !newForm.appointment_time) {
      toast({ title: "Faltan datos", description: "Por favor completa el nombre, teléfono, fecha y hora.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const localDate = new Date(`${newForm.appointment_date}T${newForm.appointment_time}`);
      const utcString = localDate.toISOString();

      const { data, error } = await supabase.from("appointments").insert({
        patient_name: newForm.patient_name,
        phone_number: newForm.phone_number,
        appointment_date: utcString,
        appointment_type: newForm.appointment_type || "Cita General",
        status: "pending",
        reminder_sent: false,
        notes: newForm.notes,
      }).select();

      if (error) throw error;

      // Try to upload files if any, to the newly created appointment
      if (data && data[0]) {
        await uploadFiles(data[0].id);
      }

      toast({ title: "Cita creada", description: "La nueva cita se ha agendado exitosamente." });
      setIsNewDialogOpen(false);
      setNewForm({
        patient_name: "",
        phone_number: "",
        appointment_date: "",
        appointment_time: "",
        appointment_type: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo crear la cita.", variant: "destructive" });
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
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold mt-1">Próximas Citas</CardTitle>
          <div className="flex gap-2">
            <Button onClick={exportToExcel} size="sm" variant="outline" className="gap-2">
              <Download className="w-4 h-4 hidden sm:inline" /> Exportar Excel
            </Button>
            <Button onClick={() => setIsNewDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4 hidden sm:inline" /> Nueva Cita
            </Button>
          </div>
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
            <DialogDescription className="sr-only">
              Modifica los detalles, fecha y estado de esta cita.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Paciente</label>
              <Input
                id="edit-patient-name"
                name="edit-patient-name"
                value={editForm.patient_name}
                onChange={(e) => setEditForm({ ...editForm, patient_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Teléfono</label>
              <Input
                id="edit-phone-number"
                name="edit-phone-number"
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Día</label>
              <Input
                id="edit-appointment-date"
                name="edit-appointment-date"
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
                id="edit-notes"
                name="edit-notes"
                placeholder="Notas adicionales (alergias, observaciones, etc.)..."
                className="col-span-3 resize-none"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={4}
              />
            </div>

            {/* Archivos Adjuntos - Editar */}
            <div className="grid grid-cols-4 items-start gap-4 pt-2 border-t mt-2">
              <label className="text-right text-sm font-medium pt-2 flex items-center justify-end gap-1">
                <Paperclip className="w-4 h-4" /> Adjuntos
              </label>
              <div className="col-span-3 space-y-3">

                {/* Lista de archivos existentes */}
                {existingFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Archivos guardados:</p>
                    <div className="flex flex-col gap-2">
                      {existingFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border text-sm">
                          <a
                            href={file.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 truncate text-primary hover:underline"
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">{file.name.substring(file.name.indexOf('_') + 1)}</span>
                          </a>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 hover:text-destructive"
                              onClick={() => deleteExistingFile(file.name)}
                              title="Eliminar archivo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seleccionar nuevos archivos */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                    <span>Subir nuevos archivos (Max 5):</span>
                    <span>{existingFiles.length + selectedFiles.length} / 5</span>
                  </p>
                  <Input
                    id="edit-attachments"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    disabled={existingFiles.length + selectedFiles.length >= MAX_FILES}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.xml"
                    className="text-xs file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:mr-2"
                  />

                  {/* Lista de archivos a subir */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-amber-50 border border-amber-100 text-sm">
                          <div className="flex items-center gap-2 truncate text-amber-900">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 shrink-0 hover:text-destructive text-amber-900/50"
                            onClick={() => removeSelectedFile(idx)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-amber-600 font-medium">Estos archivos se subirán al guardar.</p>
                    </div>
                  )}
                </div>
              </div>
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
            <DialogDescription className="sr-only">
              Confirma si deseas eliminar definitivamente esta cita de la agenda.
            </DialogDescription>
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

      {/* Modal Nueva Cita */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px] flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nueva Cita</DialogTitle>
            <DialogDescription className="sr-only">
              Completa los datos para agendar una nueva cita en el sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Paciente *</label>
                <Input
                  id="new-patient-name"
                  name="new-patient-name"
                  placeholder="Ej. Juan Pérez"
                  value={newForm.patient_name}
                  onChange={(e) => setNewForm({ ...newForm, patient_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Teléfono *</label>
                <Input
                  id="new-phone-number"
                  name="new-phone-number"
                  placeholder="Ej. +549112345678"
                  value={newForm.phone_number}
                  onChange={(e) => setNewForm({ ...newForm, phone_number: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Servicio</label>
                <Input
                  id="new-appointment-type"
                  name="new-appointment-type"
                  placeholder="Ej. Limpieza (Opcional)"
                  value={newForm.appointment_type}
                  onChange={(e) => setNewForm({ ...newForm, appointment_type: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Día *</label>
                <Input
                  id="new-appointment-date"
                  name="new-appointment-date"
                  type="date"
                  value={newForm.appointment_date}
                  onChange={(e) => setNewForm({ ...newForm, appointment_date: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Hora *</label>
                <div className="col-span-3 flex items-center gap-2">
                  <Select
                    value={newForm.appointment_time.split(":")[0] || ""}
                    onValueChange={(val) => setNewForm(prev => ({ ...prev, appointment_time: `${val}:${prev.appointment_time.split(":")[1] || "00"}` }))}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {Array.from({ length: 24 }).map((_, i) => {
                        const h = i.toString().padStart(2, "0");
                        return <SelectItem key={h} value={h}>{h}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <span className="font-bold text-muted-foreground">:</span>
                  <Select
                    value={newForm.appointment_time.split(":")[1] || ""}
                    onValueChange={(val) => setNewForm(prev => ({ ...prev, appointment_time: `${prev.appointment_time.split(":")[0] || "00"}:${val}` }))}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = (i * 5).toString().padStart(2, "0");
                        return <SelectItem key={m} value={m}>{m}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <label className="text-right text-sm font-medium pt-2">Notas</label>
                <Textarea
                  id="new-notes"
                  name="new-notes"
                  placeholder="Notas adicionales..."
                  className="col-span-3 resize-none"
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Archivos Adjuntos - Nueva Cita */}
              <div className="grid grid-cols-4 items-start gap-4 pt-2 border-t mt-2">
                <label className="text-right text-sm font-medium pt-2 flex items-center justify-end gap-1">
                  <Paperclip className="w-4 h-4" /> Adjuntos
                </label>
                <div className="col-span-3 space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                      <span>Seleccionar archivos (Max 5):</span>
                      <span>{selectedFiles.length} / 5</span>
                    </p>
                    <Input
                      id="new-attachments"
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      disabled={selectedFiles.length >= MAX_FILES}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.xml"
                      className="text-xs file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:mr-2"
                    />

                    {selectedFiles.length > 0 && (
                      <div className="flex flex-col gap-2 mt-2">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border text-sm">
                            <div className="flex items-center gap-2 truncate text-foreground">
                              <FileText className="w-4 h-4 shrink-0" />
                              <span className="truncate">{file.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 shrink-0 hover:text-destructive text-muted-foreground"
                              onClick={() => removeSelectedFile(idx)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
          <DialogFooter className="mt-2 border-t pt-4">
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Crear Cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsTab;
