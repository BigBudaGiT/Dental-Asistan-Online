import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Save, X, Phone, User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface Contact {
    id: string;
    phone_number: string;
    name: string;
    created_at: string;
}

const ContactsTab = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [name, setName] = useState("");

    const { data: contacts = [], isLoading } = useQuery({
        queryKey: ["contacts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("contacts")
                .select("*")
                .order("name", { ascending: true });
            if (error) throw error;
            return data as Contact[];
        },
    });

    const filteredContacts = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search)
    );

    const getInitials = (text: string) => {
        const parts = text.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return text.slice(0, 2).toUpperCase();
    };

    const resetForm = () => {
        setEditingId(null);
        setPhoneNumber("");
        setName("");
        setIsEditMode(false);
    };

    const openNewModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (contact: Contact) => {
        setEditingId(contact.id);
        setPhoneNumber(contact.phone_number);
        setName(contact.name);
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleSaveContact = async () => {
        if (!phoneNumber.trim() || !name.trim()) return;

        try {
            if (isEditMode && editingId) {
                const { error } = await supabase
                    .from("contacts")
                    .update({ phone_number: phoneNumber.trim(), name: name.trim() })
                    .eq("id", editingId);

                if (error) throw error;
                toast({ title: "Contacto actualizado", description: "Los datos se guardaron correctamente." });
            } else {
                const { error } = await supabase
                    .from("contacts")
                    .insert({ phone_number: phoneNumber.trim(), name: name.trim() });

                if (error) {
                    if (error.code === '23505') {
                        throw new Error("Este número de teléfono ya está registrado.");
                    }
                    throw error;
                }
                toast({ title: "Contacto agregado", description: "El nuevo contacto ha sido guardado." });
            }

            setIsModalOpen(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            queryClient.invalidateQueries({ queryKey: ["messages"] }); // To refresh names in chat list
        } catch (err: any) {
            toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
        }
    };

    const handleDeleteContact = async (id: string, contactName: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${contactName}?`)) return;

        try {
            const { error } = await supabase.from("contacts").delete().eq("id", id);
            if (error) throw error;

            toast({ title: "Contacto eliminado", description: "El contacto se borró de la agenda." });
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            queryClient.invalidateQueries({ queryKey: ["messages"] });
        } catch (err: any) {
            toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Agenda de Contactos</h2>
                    <p className="text-muted-foreground">Administra los nombres asociados a los números de WhatsApp.</p>
                </div>
                <Button onClick={openNewModal} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Añadir Contacto
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>Directorio</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                id="search-contacts"
                                name="search-contacts"
                                placeholder="Buscar nombre o nro..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8 text-muted-foreground">Cargando contactos...</div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                            <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-lg font-medium">No se encontraron contactos</p>
                            <p className="text-sm">Agrega tu primer contacto usando el botón superior.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <div className="hidden md:grid grid-cols-12 gap-4 p-4 font-medium border-b bg-muted/50 text-sm">
                                <div className="col-span-5">Nombre</div>
                                <div className="col-span-5">Teléfono</div>
                                <div className="col-span-2 text-right">Acciones</div>
                            </div>
                            <div className="divide-y">
                                {filteredContacts.map((contact) => (
                                    <div key={contact.id} className="flex flex-row md:grid md:grid-cols-12 gap-4 p-4 items-center justify-between text-sm transition-colors hover:bg-muted/30">
                                        <div className="md:col-span-5 font-medium flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-lg md:text-sm">
                                                {getInitials(contact.name)}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate text-base md:text-sm">{contact.name}</span>
                                                <div className="md:hidden flex items-center gap-1.5 text-muted-foreground mt-0.5">
                                                    <Phone className="w-3 h-3 opacity-70" />
                                                    <span className="truncate text-xs">{contact.phone_number}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="hidden md:flex md:col-span-5 items-center gap-2 text-muted-foreground min-w-0">
                                            <Phone className="w-3.5 h-3.5 opacity-70 shrink-0" />
                                            <span className="truncate">{contact.phone_number}</span>
                                        </div>
                                        <div className="md:col-span-2 flex justify-end gap-1 md:gap-2 shrink-0">
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(contact)} className="h-8 w-8">
                                                <Edit2 className="w-4 h-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(contact.id, contact.name)} className="h-8 w-8 hover:text-destructive">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal Crear/Editar */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Editar Contacto" : "Añadir Nuevo Contacto"}</DialogTitle>
                        <DialogDescription className="sr-only">
                            Formulario para añadir o editar un contacto en tu agenda.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Teléfono (ej. +5491123456789)</label>
                            <Input
                                id="contact-phone"
                                name="contact-phone"
                                placeholder="Número con código de país"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre Completo</label>
                            <Input
                                id="contact-name"
                                name="contact-name"
                                placeholder="Ej. Juan Pérez"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveContact(); }}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
                        <Button onClick={handleSaveContact} disabled={!phoneNumber.trim() || !name.trim()} className="gap-2 w-full sm:w-auto">
                            <Save className="w-4 h-4" />
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ContactsTab;
