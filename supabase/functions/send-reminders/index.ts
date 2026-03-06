import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: any) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Starting send-reminders function execution.");

    // 1. Initialize Supabase Admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Get Clinic Settings (specifically, timezone and clinic name)
    const { data: settings, error: settingsError } = await supabase
      .from("clinic_settings")
      .select("clinic_name, timezone")
      .eq("id", 1)
      .single();

    if (settingsError || !settings) {
      console.error("Failed to load clinic settings:", settingsError);
      throw new Error("Could not load clinic settings");
    }

    const clinicTimezone = settings.timezone || "America/Mexico_City";
    const clinicName = settings.clinic_name || "la clínica";

    // --- NEW LOGIC: Auto-complete past appointments ---
    // Buscar citas cuyo appointment_date sea menor al instante actual (UTC) y marcarlas como "completed"
    const nowUTC = new Date().toISOString();

    const { data: updatedAppointments, error: updatePastError } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .in("status", ["pending", "confirmed"])
      .lt("appointment_date", nowUTC)
      .select("id");

    if (updatePastError) {
      console.error("Error auto-completing past appointments:", updatePastError);
      // No lanzamos error para seguir con los recordatorios aunque esto falle
    } else {
      console.log(`Auto-completed ${updatedAppointments?.length || 0} past appointments.`);
    }
    // ----------------------------------------------------

    // 3. Calculate "tomorrow's" date boundaries in the clinic's local timezone
    // We want to find appointments happening anytime 'tomorrow' local time.

    // Get current time in clinic timezone
    const nowLocalStr = new Date().toLocaleString("en-US", { timeZone: clinicTimezone });
    const nowLocal = new Date(nowLocalStr);

    // Add 1 day to get 'tomorrow' local time
    const tomorrowLocal = new Date(nowLocal.getTime() + 24 * 60 * 60 * 1000);

    // Extract YYYY-MM-DD for tomorrow in local region
    const year = tomorrowLocal.getFullYear();
    const month = String(tomorrowLocal.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrowLocal.getDate()).padStart(2, '0');
    const tomorrowDateString = `${year}-${month}-${day}`;

    // Calculate the start and end of "tomorrow" in UTC to query the DB (because DB stores UTC)
    // Start of tomorrow: YYYY-MM-DDT00:00:00.000 in local timezone -> convert to UTC
    const localStartOfTomorrowStr = `${tomorrowDateString}T00:00:00.000`;
    // We create a Date object assuming it's the local time by parsing it with the locale/timezone, but Deno Date formatting is tricky.
    // A more reliable way in vanilla JS is to construct the Date in UTC, then subtract the offset.

    // Simpler approach for dates stored as strings YYYY-MM-DD in DB, or full ISO timestamps:
    // If appointment_date is stored as ISO 8601 (e.g. 2024-03-01T14:30:00Z)
    // Let's get the range in ISO UTC that corresponds to the local day of tomorrow.

    // Helper to format ISO without changing to local
    // Note: the standard JS Date doesn't easily convert "Local string -> UTC Date" cleanly without libraries.
    // Since we know the day we want is `tomorrowDateString` ...

    // Let's use string operations against the `appointment_date` if they are stored in UTC... Wait, we must be careful.
    // Better strategy: Fetch all upcoming appointments that haven't had a reminder sent, and filter them in memory using Date objects.

    const { data: appointments, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .in("status", ["pending", "confirmed"])
      .eq("reminder_sent", false)
      .gte("appointment_date", new Date().toISOString()); // Only future ones

    if (aptError) {
      console.error("Failed to fetch appointments:", aptError);
      throw new Error("Could not load appointments");
    }

    console.log(`Found ${appointments?.length || 0} future appointments waiting for reminders.`);

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No reminders to send today." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter appointments exactly for 'tomorrow' in local time
    const appointmentsToRemind = appointments.filter((apt) => {
      // Parse the appointment datetime into local time string
      const aptLocalStr = new Date(apt.appointment_date).toLocaleString("en-US", { timeZone: clinicTimezone });
      const aptLocal = new Date(aptLocalStr);

      const aptYear = aptLocal.getFullYear();
      const aptMonth = String(aptLocal.getMonth() + 1).padStart(2, '0');
      const aptDay = String(aptLocal.getDate()).padStart(2, '0');
      const aptDateString = `${aptYear}-${aptMonth}-${aptDay}`;

      return aptDateString === tomorrowDateString;
    });

    console.log(`Filtered: ${appointmentsToRemind.length} appointments exactly for tomorrow (${tomorrowDateString} local).`);

    // 4. Setup Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Missing Twilio configuration");
      throw new Error("Twilio environment variables are not fully configured.");
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const fromWhatsApp = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;

    const results = [];

    // 5. Loop and send messages
    for (const apt of appointmentsToRemind) {
      const { id, patient_name, phone_number, appointment_date } = apt;

      // Extract time to show to patient (e.g. "14:30")
      const aptLocalStr = new Date(appointment_date).toLocaleString("en-US", { timeZone: clinicTimezone });
      const aptLocal = new Date(aptLocalStr);
      const hours = String(aptLocal.getHours()).padStart(2, '0');
      const minutes = String(aptLocal.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const messageText = `Hola *${patient_name}*, te recordamos que mañana tienes una cita programada en *${clinicName}* a las *${timeStr} hs*. Por favor, contéstanos este mensaje para confirmarnos tu asistencia o avisarnos si necesitas reprogramar. ¡Te esperamos!`;

      const toWhatsApp = phone_number.startsWith("whatsapp:") ? phone_number : `whatsapp:${phone_number}`;

      console.log(`Sending reminder to ${patient_name} (${toWhatsApp}) for appointment at ${timeStr}`);

      try {
        const params = new URLSearchParams();
        params.append("To", toWhatsApp);
        params.append("From", fromWhatsApp);
        params.append("Body", messageText);

        const twilioRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
          },
          body: params.toString(),
        });

        const twilioData = await twilioRes.json();

        if (!twilioRes.ok) {
          console.error(`Twilio error for ${patient_name}:`, twilioData);
          results.push({ id, status: "error", error: twilioData.message });
          continue; // Skip DB update if message failed
        }

        // 6. DB Updates upon success: Mark reminder sent
        const { error: updateError } = await supabase
          .from("appointments")
          .update({ reminder_sent: true })
          .eq("id", id);

        if (updateError) {
          console.error(`Failed to mark reminder sent for ${id}:`, updateError);
          results.push({ id, status: "db_error", error: updateError.message });
        } else {
          // Also log in messages table
          const cleanPhone = phone_number.replace("whatsapp:", "");
          await supabase.from("messages").insert({
            phone_number: cleanPhone,
            message_content: messageText,
            sender: "bot",
          });

          results.push({ id, status: "success", twilio_sid: twilioData.sid });
        }
      } catch (err: any) {
        console.error(`Exception while sending to ${patient_name}:`, err);
        results.push({ id, status: "error", error: err.message });
      }
    }

    console.log("Finished sending reminders. Results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        processed: appointmentsToRemind.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unhandled top-level error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
