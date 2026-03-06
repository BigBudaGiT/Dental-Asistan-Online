# Dental Asistan

Asistente inteligente para clínicas dentales que automatiza la gestión de citas mediante WhatsApp con IA.

## Características

- **Chat con IA por WhatsApp** — El asistente virtual atiende pacientes 24/7, agenda citas y responde consultas
- **Gestión de agenda** — Visualiza, confirma o cancela citas desde un panel intuitivo
- **Recordatorios automáticos** — Envía recordatorios por WhatsApp un día antes de cada cita
- **Disponibilidad en tiempo real** — La IA verifica horarios disponibles antes de agendar
- **Centro de mensajes** — Visualiza las conversaciones de WhatsApp agrupadas por paciente
- **Configuración de clínica** — Horarios, servicios, webhook de WhatsApp y datos de contacto

## Tecnologías

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui (Radix UI), Tailwind CSS, Framer Motion
- **Backend/DB**: Supabase (PostgreSQL, Auth)
- **Estado**: TanStack React Query
- **Routing**: React Router v6

## Requisitos previos

- Node.js 18+ o Bun
- npm, yarn o bun

## Instalación

```sh
# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd clinic-connect-ai

# Instalar dependencias
npm install

# Crear archivo .env con las variables de Supabase (ver más abajo)
```

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_PUBLISHABLE_KEY=tu_clave_anon_publica
```

Puedes obtener estos valores en el [Panel de Supabase](https://app.supabase.com) → tu proyecto → Settings → API.

## Desarrollo

```sh
npm run dev
```

La aplicación estará disponible en **http://localhost:8080**.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run build:dev` | Build en modo development |
| `npm run preview` | Vista previa del build |
| `npm run lint` | Ejecutar ESLint |
| `npm run test` | Ejecutar tests (Vitest) |

## Estructura del proyecto

```
src/
├── App.tsx              # Router y providers
├── main.tsx
├── pages/               # Landing, Auth, Dashboard
├── components/          # UI y componentes del dashboard
├── integrations/        # Cliente y tipos de Supabase
├── hooks/
└── lib/
```

## Licencia

Privado.
