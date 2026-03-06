import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.22.0";
import { tools, handle_check_availability, handle_book_appointment, handle_cancel_appointment, handle_modify_appointment } from "./tools.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: any) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    let phoneNumber = "";
    let supabase: any;

    const sendWhatsApp = async (text: string) => {
        if (!phoneNumber) return;
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const params = new URLSearchParams();
        const to = phoneNumber.startsWith("whatsapp:") ? phoneNumber : `whatsapp:${phoneNumber}`;
        const from = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
        params.append("To", to);
        params.append("From", from);
        params.append("Body", text);
        return fetch(twilioUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
            },
            body: params,
        }).catch(e => console.error("Twilio Error:", e));
    };

    try {
        console.log("--- Webhook Triggered (Gemini 2.0) ---");
        const formData = await req.formData();
        const from = formData.get("From")?.toString() || "";
        const body = formData.get("Body")?.toString() || "";
        phoneNumber = from.replace("whatsapp:", "");

        if (!phoneNumber || !body) return new Response("OK", { status: 200 });

        supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("messages").insert({ phone_number: phoneNumber, message_content: body, sender: "user" });

        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey || apiKey.trim() === "") {
            console.error("⚠️ Error: GEMINI_API_KEY no configurada.");
            return new Response("No API Key", { status: 500 });
        }

        // --- FAST-PATH CANCELACIÓN DIRECTA ---
        const normalizedBody = body.trim().toLowerCase();

        // Match exact or with slight punctuation (like "cancelar.", "cancelar!")
        if (normalizedBody.replace(/[.,!]/g, '') === "cancelar") {
            console.log("Fast-path: Usuario quiere cancelar");
            const { data: aptsToCancel } = await supabase
                .from("appointments")
                .select("id")
                .eq("phone_number", phoneNumber)
                .in("status", ["pending", "confirmed"])
                .gte("appointment_date", new Date().toISOString())
                .order("appointment_date", { ascending: true })
                .limit(1);

            if (aptsToCancel && aptsToCancel.length > 0) {
                const aptId = aptsToCancel[0].id;
                await supabase.from("appointments").update({ status: "cancelled" }).eq("id", aptId);

                const reply = "✅ Tu próximo turno ha sido cancelado exitosamente. Si necesitas otro, solo pídemelo.";
                await supabase.from("messages").insert({ phone_number: phoneNumber, message_content: reply, sender: "bot" });
                await sendWhatsApp(reply);

                return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
            } else {
                const reply = "No encontré ningún turno próximo a tu nombre para cancelar.";
                await supabase.from("messages").insert({ phone_number: phoneNumber, message_content: reply, sender: "bot" });
                await sendWhatsApp(reply);

                return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
            }
        }
        // --- FIN FAST-PATH ---

        const { data: settings } = await supabase.from("clinic_settings").select("*").single();
        const timezone = settings?.timezone || "America/Argentina/Buenos_Aires";
        const rawWorkingHours = settings?.working_hours || "[]";
        const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        const localToday = formatter.format(new Date());

        const { data: apts } = await supabase
            .from("appointments")
            .select("id, appointment_date, appointment_type, status")
            .eq("phone_number", phoneNumber)
            .in("status", ["pending", "confirmed"])
            .gte("appointment_date", `${localToday}T00:00:00.000Z`)
            .order("appointment_date", { ascending: true });

        let context = "No tienes turnos activos.";
        if (apts && apts.length > 0) {
            context = "Turnos activos:\n" + apts.map(a => `- [ID: ${a.id}] ${a.appointment_date} (${a.appointment_type})`).join("\n");
        }

        const { data: history } = await supabase.from("messages").select("message_content, sender").eq("phone_number", phoneNumber).order("received_at", { ascending: false }).limit(6);
        const historyMapped = (history || []).filter(m => m.message_content !== body).reverse().map(m => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.message_content }]
        }));
        historyMapped.push({ role: "user", parts: [{ text: body }] });

        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const systemInstruction = `Eres el asistente de la clínica "${settings?.clinic_name}".
Hoy: ${localToday} (${timezone}).
${context}`;

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: systemInstruction,
        });

        try {
            let result = await model.generateContent({
                contents: historyMapped,
                tools: tools as any,
                generationConfig: { temperature: 0.2 }
            });

            let response = result.response;
            let loop = 0;

            while (loop < 5) {
                const calls = response.functionCalls ? response.functionCalls() : [];
                if (!calls || calls.length === 0) break;
                loop++;

                historyMapped.push(response.candidates![0].content);

                const frs = [];
                for (const call of calls) {
                    let obj = {};
                    if (call.name === "check_availability") obj = JSON.parse(await handle_check_availability(supabase, call.args as any, timezone, rawWorkingHours));
                    else if (call.name === "book_appointment") obj = JSON.parse(await handle_book_appointment(supabase, call.args as any, phoneNumber, timezone));
                    else if (call.name === "cancel_appointment") obj = JSON.parse(await handle_cancel_appointment(supabase, call.args as any));
                    else if (call.name === "modify_appointment") obj = JSON.parse(await handle_modify_appointment(supabase, call.args as any, timezone));

                    frs.push({ functionResponse: { name: call.name, response: { content: obj } } });
                }
                historyMapped.push({ role: "function", parts: frs });
                result = await model.generateContent({ contents: historyMapped, tools: tools as any });
                response = result.response;
            }

            const reply = response.text() || "Sin respuesta de Gemini.";
            await supabase.from("messages").insert({ phone_number: phoneNumber, message_content: reply, sender: "bot" });

            // Send final response to WhatsApp with error logging
            const twilioRes = await sendWhatsApp(reply);
            if (twilioRes && !twilioRes.ok) {
                const twilioError = await twilioRes.text();
                console.error("Twilio Error Details:", twilioError);
                await supabase.from("messages").insert({
                    phone_number: phoneNumber,
                    message_content: `[DEV LOG] Twilio Rechazado: ${twilioError}`,
                    sender: "bot"
                });
            }

        } catch (iaErr: any) {
            console.error("Gemini Error:", iaErr);
            const errMsg = "[DEV LOG] Fallo Gemini: " + (iaErr.message || iaErr.toString());
            await supabase.from("messages").insert({ phone_number: phoneNumber, message_content: errMsg, sender: "bot" });

            const twilioResErr = await sendWhatsApp("⚠️ Fallo Gemini: " + (iaErr.message || "Timeout/Error"));
            if (twilioResErr && !twilioResErr.ok) {
                const twilioErrorText = await twilioResErr.text();
                await supabase.from("messages").insert({
                    phone_number: phoneNumber,
                    message_content: `[DEV LOG] Twilio Rechazado en Error: ${twilioErrorText}`,
                    sender: "bot"
                });
            }
        }

        return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });

    } catch (err: any) {
        console.error("Global Error:", err);
        const errMsg = "[DEV LOG] Error Global: " + (err.message || err.toString());
        await supabase.from("messages").insert({ phone_number: phoneNumber, message_content: errMsg, sender: "bot" });
        return new Response("Error", { status: 500 });
    }
});
