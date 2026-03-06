require('dotenv').config({ path: '/Users/luzbelito/iA/Antigravity/clinic-connect-ai/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Missing VITE_GEMINI_API_KEY");
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: "Eres el asistente de Dental Asistan.",
    });

    const historyMapped = [{ role: "user", parts: [{ text: "quiero cancelar mi turno para mañana" }] }];

    try {
        console.log("Calling Gemini via Node.js API...");
        const result = await model.generateContent({
            contents: historyMapped,
            generationConfig: { temperature: 0.2 }
        });
        console.log("Response text:", result.response.text());
    } catch (err) {
        console.error("GEMINI CRASHED:");
        console.error(err);
    }
}

testGemini();
