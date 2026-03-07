import { useState, useEffect } from "react";
import { User, Shield, ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type UserProfile = {
    id: string;
    email: string;
    role: "admin" | "user";
    status: "pending" | "approved" | "rejected";
    created_at: string;
};

const AdminTab = () => {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("user_profiles")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching profiles:", error);
            toast({ title: "Error", description: "No se pudieron cargar los usuarios.", variant: "destructive" });
        } else {
            setProfiles(data as UserProfile[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setCurrentUserId(session?.user?.id || null);
        });
        fetchProfiles();
    }, []);

    const updateStatus = async (id: string, newStatus: "approved" | "rejected" | "pending") => {
        const { error } = await supabase.from("user_profiles").update({ status: newStatus }).eq("id", id);
        if (error) {
            toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
        } else {
            toast({ title: "Actualizado", description: `El usuario ahora está ${newStatus}.` });
            setProfiles(profiles.map(p => p.id === id ? { ...p, status: newStatus } : p));
        }
    };

    const updateRole = async (id: string, newRole: "admin" | "user") => {
        const { error } = await supabase.from("user_profiles").update({ role: newRole }).eq("id", id);
        if (error) {
            toast({ title: "Error", description: "No se pudo actualizar el rol.", variant: "destructive" });
        } else {
            toast({ title: "Rol Actualizado", description: `El usuario ahora es ${newRole}.` });
            setProfiles(profiles.map(p => p.id === id ? { ...p, role: newRole } : p));
        }
    };

    const deleteUser = async (id: string) => {
        if (!window.confirm("¿Estás completamente seguro de borrar esta cuenta? Esta acción no se puede deshacer y borrará todos sus datos.")) return;

        const { data, error } = await supabase.functions.invoke('delete-user', {
            body: { userIdToDelete: id }
        });

        if (error || data?.error) {
            console.error("Error al borrar usuario:", error || data?.error);
            toast({ title: "Error", description: data?.error || "Fallo al intentar borrar el usuario de la DB.", variant: "destructive" });
        } else {
            toast({ title: "Usuario Eliminado", description: "La cuenta ha sido borrada permanentemente." });
            setProfiles(profiles.filter(p => p.id !== id));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprobado</Badge>;
            case "pending":
                return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
            case "rejected":
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rechazado</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Usuarios y Equipo</h2>
                    <p className="text-muted-foreground">Administra el acceso a la plataforma.</p>
                </div>
                <Button onClick={fetchProfiles} variant="outline" size="sm">Actualizar</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cuentas Registradas</CardTitle>
                    <CardDescription>Visualiza y aprueba a los nuevos miembros de tu equipo.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
                    ) : profiles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No hay usuarios registrados.</div>
                    ) : (
                        <div className="space-y-4">
                            {profiles.map((profile) => (
                                <div key={profile.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card/50 gap-4 transition-all hover:bg-accent/50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                            <User className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">{profile.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getStatusBadge(profile.status)}
                                                {profile.role === 'admin' && (
                                                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                                                        <Shield className="w-3 h-3 mr-1" /> Admin
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {profile.status === 'pending' && (
                                            <>
                                                <Button size="sm" onClick={() => updateStatus(profile.id, 'approved')} className="bg-emerald-600 hover:bg-emerald-700">
                                                    Aprobar
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => updateStatus(profile.id, 'rejected')}>
                                                    Rechazar
                                                </Button>
                                            </>
                                        )}

                                        {profile.status === 'approved' && (
                                            <Button size="sm" variant="ghost" onClick={() => updateStatus(profile.id, 'pending')} className="text-muted-foreground">
                                                Suspender
                                            </Button>
                                        )}

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => updateRole(profile.id, profile.role === 'admin' ? 'user' : 'admin')}
                                        >
                                            {profile.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                                        </Button>

                                        {profile.id !== currentUserId && (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => deleteUser(profile.id)}
                                                title="Borrar completamente esta cuenta de la base de datos"
                                            >
                                                Borrar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminTab;
