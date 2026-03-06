// No top-level DB client to avoid import-time crashes

// Define tool schema for Gemini
// Define raw function declarations (Deno/SDK agnostic)
export const functionDeclarations = [
    {
        name: "check_availability",
        description: "Verifica si hay turnos disponibles para una fecha específica. SOLO se pueden agendar turnos en horas en punto (ej: 09:00, 10:00). Nunca ofrezcas y medias (ej: 09:30).",
        parameters: {
            type: "object",
            properties: {
                date: {
                    type: "string",
                    description: "Fecha a consultar en formato YYYY-MM-DD",
                },
            },
            required: ["date"],
        },
    },
    {
        name: "book_appointment",
        description: "Agenda un nuevo turno en la base de datos. IMPORTANTE: La hora DEBE ser exacta en punto (ej: 09:00).",
        parameters: {
            type: "object",
            properties: {
                patient_name: {
                    type: "string",
                    description: "Nombre completo del paciente.",
                },
                obra_social: {
                    type: "string",
                    description: "Nombre de la obra social o prepaga del paciente (ej: OSDE, Swiss Medical, Particular, etc.).",
                },
                email: {
                    type: "string",
                    description: "Correo electrónico de contacto del paciente.",
                },
                appointment_date: {
                    type: "string",
                    description: "Fecha del turno en formato YYYY-MM-DD",
                },
                appointment_time: {
                    type: "string",
                    description: "Hora del turno en formato HH:00 (ej: 14:00 o 09:00)",
                },
                service: {
                    type: "string",
                    description: "Tipo de servicio odontológico o tratamiento solicitado (ej: Limpieza, Consulta General, etc.)",
                },
            },
            required: ["patient_name", "obra_social", "email", "appointment_date", "appointment_time"],
        },
    },
    {
        name: "cancel_appointment",
        description: "Cancela un turno existente asociado al paciente. Úsalo cuando el paciente solicite explícitamente cancelar su turno.",
        parameters: {
            type: "object",
            properties: {
                appointment_id: {
                    type: "string",
                    description: "El ID del turno a cancelar (provisto en el contexto).",
                },
            },
            required: ["appointment_id"],
        },
    },
    {
        name: "modify_appointment",
        description: "Modifica la fecha y/o hora de un turno existente. MUY IMPORTANTE: Antes de usar esto, debes usar check_availability para confirmar que la nueva fecha/hora está libre.",
        parameters: {
            type: "object",
            properties: {
                appointment_id: {
                    type: "string",
                    description: "El ID del turno a modificar (provisto en el contexto).",
                },
                new_date: {
                    type: "string",
                    description: "La nueva fecha para el turno en formato YYYY-MM-DD",
                },
                new_time: {
                    type: "string",
                    description: "La nueva hora para el turno en formato HH:00 (ej: 14:00)",
                },
            },
            required: ["appointment_id", "new_date", "new_time"],
        },
    }
];

// Helper for Gemini
export const tools = [{ functionDeclarations }];

// Helper for OpenAI
export const openai_tools = functionDeclarations.map(f => ({
    type: "function" as const,
    function: f
}));

// Map a JS Date's getDay() to the schedule array format.
const DOY_MAP = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Helper to check DB
export async function handle_check_availability(
    supabase: any,
    args: { date: string },
    timezone: string,
    workingHoursJson: string
) {
    console.log("Tool executing: check_availability", args, timezone);

    let schedule = [];
    try {
        schedule = JSON.parse(workingHoursJson);
    } catch (e) {
        console.error("No valid dynamic schedule found. Using fallback.");
    }

    // 1. Encontrar qué día es en español (ej: "Miércoles")
    const dateObj = new Date(`${args.date}T12:00:00.000Z`);
    const dayName = DOY_MAP[dateObj.getUTCDay()];

    // Buscar la configuración de ese día en el JSON
    const dayConfig = schedule.find((d: any) => d.day === dayName);

    if (!dayConfig || !dayConfig.active) {
        return JSON.stringify({ message: `La clínica está CERRADA el día ${args.date} (${dayName}). Por favor elige otra fecha.` });
    }

    const startHour = parseInt(dayConfig.start.split(":")[0]);
    const endHour = parseInt(dayConfig.end.split(":")[0]);

    // Generamos las horas posibles para ese día
    const validHours = [];
    for (let h = startHour; h < endHour; h++) {
        validHours.push(h);
    }

    const { data: apts, error } = await supabase
        .from("appointments")
        .select("appointment_date")
        .gte("appointment_date", `${args.date}T00:00:00`)
        .lte("appointment_date", `${args.date}T23:59:59`)
        .neq("status", "cancelled");

    if (error) {
        console.error("DB error check_availability:", error);
        return JSON.stringify({ error: "Error de base de datos al buscar turnos." });
    }

    const occupiedHours = apts.map((apt) => {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            hour12: false
        });
        const hourString = formatter.format(new Date(apt.appointment_date));
        return parseInt(hourString);
    });

    const availableHours = validHours.filter((h) => !occupiedHours.includes(h));

    if (availableHours.length === 0) {
        return JSON.stringify({ message: `No quedan turnos disponibles el ${args.date} (${dayName}).` });
    }

    return JSON.stringify({
        message: `La clínica atiende el ${args.date} (${dayName}) de ${dayConfig.start} a ${dayConfig.end}. Los siguientes horarios están libres:`,
        available_hours: availableHours.map(h => `${h.toString().padStart(2, '0')}:00`),
    });
}

// Helper to save DB
export async function handle_book_appointment(
    supabase: any,
    args: { patient_name: string, obra_social: string, email: string, appointment_date: string, appointment_time: string, service?: string },
    phone_number: string,
    timezone: string
) {
    console.log("Tool executing: book_appointment", args, phone_number, timezone);

    const timeParts = args.appointment_time.split(":");
    const hour = timeParts[0];
    const exactTime = `${hour}:00:00`;

    function getOffset(timeZone: string, date = new Date()) {
        const tz = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).format(date);
        const match = tz.match(/GMT([+-]\d{1,2}(?::?\d{2})?)/);
        if (!match) return "Z";

        let offset = match[1];
        if (!offset.includes(":")) {
            if (offset.length === 3) offset = offset + ":00";
            else if (offset.length === 5) offset = offset.substring(0, 3) + ":" + offset.substring(3);
        }

        if (offset.length === 5 && offset[1] !== '0' && offset[2] === ':') {
            offset = offset[0] + '0' + offset.substring(1);
        }

        return offset;
    }

    const offsetString = getOffset(timezone, new Date(args.appointment_date));
    const appointment_datetime = `${args.appointment_date}T${exactTime}${offsetString}`;

    const generatedNotes = `IA Gemini:
- Obra Social: ${args.obra_social}
- Email: ${args.email}`;

    const { error } = await supabase.from("appointments").insert({
        patient_name: args.patient_name,
        phone_number: phone_number,
        appointment_date: appointment_datetime,
        appointment_type: args.service || "Consulta General",
        status: "pending",
        notes: generatedNotes,
    });

    if (error) {
        console.error("DB error book_appointment:", error);
        return JSON.stringify({ status: "error", message: "Error al guardar el turno. Reintentá por favor." });
    }

    return JSON.stringify({ status: "success", message: `Turno guardado con éxito para ${args.appointment_date} a las ${hour}:00 (${timezone})` });
}

// Helper to cancel appointment
export async function handle_cancel_appointment(supabase: any, args: { appointment_id: string }) {
    console.log("Tool executing: cancel_appointment", args);

    const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", args.appointment_id);

    if (error) {
        console.error("DB error cancel_appointment:", error);
        return JSON.stringify({ status: "error", message: "Error al cancelar el turno. Reintentá por favor." });
    }

    return JSON.stringify({ status: "success", message: "Turno cancelado exitosamente." });
}

// Helper to modify appointment
export async function handle_modify_appointment(supabase: any, args: { appointment_id: string, new_date: string, new_time: string }, timezone: string) {
    console.log("Tool executing: modify_appointment", args, timezone);

    const timeParts = args.new_time.split(":");
    const hour = timeParts[0];
    const exactTime = `${hour}:00:00`;

    function getOffset(timeZone: string, date = new Date()) {
        const tz = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).format(date);
        const match = tz.match(/GMT([+-]\d{1,2}(?::?\d{2})?)/);
        if (!match) return "Z";

        let offset = match[1];
        if (!offset.includes(":")) {
            if (offset.length === 3) offset = offset + ":00";
            else if (offset.length === 5) offset = offset.substring(0, 3) + ":" + offset.substring(3);
        }

        if (offset.length === 5 && offset[1] !== '0' && offset[2] === ':') {
            offset = offset[0] + '0' + offset.substring(1);
        }

        return offset;
    }

    const offsetString = getOffset(timezone, new Date(args.new_date));
    const appointment_datetime = `${args.new_date}T${exactTime}${offsetString}`;

    const { error } = await supabase
        .from("appointments")
        .update({ appointment_date: appointment_datetime })
        .eq("id", args.appointment_id);

    if (error) {
        console.error("DB error modify_appointment:", error);
        return JSON.stringify({ status: "error", message: "Error al re-programar el turno." });
    }

    return JSON.stringify({ status: "success", message: `El turno fue re-programado con éxito para el ${args.new_date} a las ${hour}:00` });
}
