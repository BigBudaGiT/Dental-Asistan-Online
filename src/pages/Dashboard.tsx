import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Calendar, Settings, LogOut, Menu, Users, Shield, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MessagesTab from "@/components/dashboard/MessagesTab";
import AppointmentsTab from "@/components/dashboard/AppointmentsTab";
import ContactsTab from "@/components/dashboard/ContactsTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import AdminTab from "@/components/dashboard/AdminTab";

export type TabKey = "messages" | "appointments" | "contacts" | "settings" | "admin";

const getTabs = (isAdmin: boolean) => {
  const baseTabs = [
    { key: "messages" as TabKey, label: "Mensajes", icon: MessageCircle },
    { key: "appointments" as TabKey, label: "Citas", icon: Calendar },
    { key: "contacts" as TabKey, label: "Agenda", icon: Users },
    { key: "settings" as TabKey, label: "Configuración", icon: Settings },
  ];
  if (isAdmin) {
    baseTabs.push({ key: "admin" as TabKey, label: "Usuarios / Equipos", icon: Shield });
  }
  return baseTabs;
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("messages");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const navigate = useNavigate();

  const [userName, setUserName] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; status: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (data) setUserProfile(data);
    setProfileLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        const name = session.user.user_metadata?.full_name;
        setUserName(name || session.user.email || "Usuario");
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        const name = session.user.user_metadata?.full_name;
        setUserName(name || session.user.email || "Usuario");
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const currentTabs = getTabs(userProfile?.role === 'admin');

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (userProfile?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 gradient-soft" />
        <div className="relative z-10 max-w-sm w-full bg-card border rounded-2xl shadow-elevated p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Cuenta en Revisión</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tu registro ha sido completado exitosamente pidiendo tu acceso a la plataforma.
              Tu cuenta debe ser <strong className="text-foreground">aprobada manualmente</strong> por el administrador antes de que puedas comenzar a gestionar la clínica.
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-muted/30 overflow-hidden relative">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:relative z-50 h-[100dvh]
        ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-16"} 
        bg-card border-r flex flex-col transition-all duration-300 shrink-0
      `}>
        <div className="h-16 flex items-center gap-2 px-4 border-b shrink-0">
          <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-xs">iA</span>
          </div>
          {sidebarOpen && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-sm"><span className="bg-gradient-to-r from-fuchsia-500 to-pink-500 text-transparent bg-clip-text"><span className="font-extrabold">i</span>-asistan</span></motion.span>}
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {currentTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
            >
              <tab.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t shrink-0 flex flex-col gap-2">
          {sidebarOpen && userName && (
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground truncate flex items-center gap-2" title={userName}>
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">{userName}</span>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Salir</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        <header className="h-16 shrink-0 bg-card border-b flex items-center px-4 gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">{currentTabs.find((t) => t.key === activeTab)?.label}</h1>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {activeTab === "messages" && <MessagesTab />}
            {activeTab === "appointments" && <AppointmentsTab />}
            {activeTab === "contacts" && <ContactsTab />}
            {activeTab === "settings" && <SettingsTab />}
            {activeTab === "admin" && <AdminTab />}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
