import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const requestBody = await req.json();
        const phoneNumber = requestBody.phone_number;
        const messageText = requestBody.message;

        console.log("Received request:", JSON.stringify({ phoneNumber, messageText }));

        if (!phoneNumber || !messageText) {
            return new Response(
                JSON.stringify({ success: false, error: "phone_number and message are required" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- Twilio credentials ---
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

        console.log("Twilio config:", {
            hasSid: !!accountSid,
            hasToken: !!authToken,
            hasPhone: !!twilioPhone,
            twilioPhone: twilioPhone
        });

        if (!accountSid || !authToken || !twilioPhone) {
            return new Response(
                JSON.stringify({ success: false, error: "Missing Twilio environment variables" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Format phone numbers for WhatsApp
        const toWhatsApp = phoneNumber.startsWith("whatsapp:")
            ? phoneNumber
            : `whatsapp:${phoneNumber}`;
        const fromWhatsApp = twilioPhone.startsWith("whatsapp:")
            ? twilioPhone
            : `whatsapp:${twilioPhone}`;

        console.log("Sending from:", fromWhatsApp, "to:", toWhatsApp);

        // --- Send via Twilio REST API ---
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

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
        console.log("Twilio response status:", twilioRes.status, "data:", JSON.stringify(twilioData));

        if (!twilioRes.ok) {
            return new Response(
                JSON.stringify({ success: false, error: twilioData.message || "Twilio API error", code: twilioData.code, details: twilioData }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- Save to DB ---
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        let dbStatus = "skipped";
        let dbError = null;

        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const cleanPhone = phoneNumber.replace("whatsapp:", "");
            const { error: insertError } = await supabase.from("messages").insert({
                phone_number: cleanPhone,
                message_content: messageText,
                sender: "bot",
            });
            if (insertError) {
                dbStatus = "error";
                dbError = insertError;
                console.error("DB insert error:", JSON.stringify(insertError));
            } else {
                dbStatus = "ok";
            }
        }

        return new Response(
            JSON.stringify({ success: true, sid: twilioData.sid, db: { status: dbStatus, error: dbError } }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Unhandled error:", error.message, error.stack);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
