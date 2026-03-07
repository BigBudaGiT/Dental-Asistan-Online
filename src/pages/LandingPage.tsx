import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, MessageCircle, Bell, Clock, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const benefits = [
  {
    icon: MessageCircle,
    title: "Chat con IA por WhatsApp",
    description: "Tu asistente virtual atiende pacientes 24/7, agenda citas y responde consultas automáticamente.",
  },
  {
    icon: Calendar,
    title: "Gestión de Agenda",
    description: "Visualiza, confirma o cancela citas desde un panel intuitivo con vista detallada.",
  },
  {
    icon: Bell,
    title: "Recordatorios Automáticos",
    description: "Envía recordatorios por WhatsApp un día antes para reducir ausencias.",
  },
  {
    icon: Clock,
    title: "Disponibilidad en Tiempo Real",
    description: "La IA verifica horarios disponibles antes de agendar, sin conflictos.",
  },
  {
    icon: Shield,
    title: "Datos Seguros",
    description: "Toda la información de pacientes está protegida con encriptación de nivel empresarial.",
  },
  {
    icon: Zap,
    title: "Configuración Rápida",
    description: "Conecta tu WhatsApp Business y empieza a recibir citas en minutos.",
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 shrink-0 rounded-lg gradient-hero flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">iA</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">
              <span className="bg-gradient-to-r from-fuchsia-500 to-pink-500 text-transparent bg-clip-text">
                <span className="font-extrabold">i</span>-asistan
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/auth">
              <Button variant="outline" size="sm">
                Iniciar Sesión
              </Button>
            </Link>
            <Link to="/auth?mode=register">
              <Button size="sm">Crear Cuenta</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 gradient-soft opacity-60" />
        <div className="container mx-auto relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
          >
            <motion.div
              custom={0}
              variants={fadeUp}
              className="mb-6 font-black tracking-tighter text-5xl md:text-7xl"
            >
              <span className="bg-gradient-to-r from-fuchsia-500 to-pink-500 text-transparent bg-clip-text">
                <span className="font-extrabold">i</span>-asistan
              </span>
            </motion.div>
            <motion.div
              custom={1}
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-6"
            >
              <MessageCircle className="w-4 h-4" />
              Asistente Virtual con IA
            </motion.div>
            <motion.h1
              custom={2}
              variants={fadeUp}
              className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight mb-6"
            >
              Gestiona tus citas por{" "}
              <span className="bg-gradient-to-r from-emerald-500 to-green-600 text-transparent bg-clip-text">WhatsApp</span>{" "}
              con inteligencia artificial
            </motion.h1>
            <motion.p
              custom={3}
              variants={fadeUp}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              <span className="bg-gradient-to-r from-fuchsia-500 to-pink-500 text-transparent bg-clip-text font-semibold">
                <span className="font-extrabold">i</span>-asistan
              </span> automatiza la atención, agenda citas y envía
              recordatorios. Todo desde WhatsApp, sin complicaciones.
            </motion.p>
            <motion.div custom={4} variants={fadeUp} className="flex items-center justify-center gap-4">
              <Link to="/auth?mode=register">
                <Button size="lg" className="px-8 text-base font-semibold">
                  Crear Cuenta
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="lg" className="px-8 text-base">
                  Iniciar Sesión
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Todo lo que tu negocio necesita
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Herramientas inteligentes para modernizar la gestión de tu negocio.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="group rounded-xl border bg-card p-6 shadow-card hover:shadow-elevated transition-shadow duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <b.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <motion.div
          className="container mx-auto max-w-3xl rounded-2xl gradient-hero p-12 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            ¿Listo para transformar tu negocio?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Únete a cientos de profesionales que ya automatizan sus citas con IA.
          </p>
          <Link to="/auth?mode=register">
            <Button size="lg" variant="secondary" className="px-8 text-base font-semibold">
              Crear Cuenta
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-hero flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">iA</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              i-asistan © 2026 -{" "}
              <a
                href="https://www.bigbuda.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors hover:underline"
              >
                www.bigbuda.com.ar
              </a>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatiza tu negocio con inteligencia artificial.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
