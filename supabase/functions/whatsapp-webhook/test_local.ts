import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { load } from "https://deno.land/std@0.210.0/dotenv/mod.ts";
import { tools } from "./tools.ts";

const env = await load({ envPath: "/Users/luzbelito/iA/Antigravity/clinic-connect-ai/.env" });

const supabaseUrl = env["VITE_SUPABASE_URL"];
const supabaseKey = env["VITE_SUPABASE_ANON_KEY"];
const apiKey = env["VITE_GEMINI_API_KEY"];

if (!supabaseUrl || !supabaseKey || !apiKey) {
    console.log("Missing env vars in the specific file");
    Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGemini() {
    console.log("Mocking a WhatsApp webhook request...");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: "Eres el asistente de Dental Asistan.",
    });

    const historyMapped = [{ role: "user", parts: [{ text: "quiero cancelar mi turno para mañana" }] }];

    try {
        console.log("Calling Gemini...");
        const result = await model.generateContent({
            contents: historyMapped,
            tools: tools as any,
            generationConfig: { temperature: 0.2 }
        });

        const response = result.response;
        console.log("TEXT RESPONSE:", response.text());
        const calls = response.functionCalls ? response.functionCalls() : [];
        console.log("FUNCTION CALLS:", calls.length > 0 ? calls : "None");

    } catch (err: any) {
        console.error("GEMINI CRASHED:");
        console.error(err);
    }
}

testGemini();
