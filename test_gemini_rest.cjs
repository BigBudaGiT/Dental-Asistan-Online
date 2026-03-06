require('dotenv').config({ path: '/Users/luzbelito/iA/Antigravity/clinic-connect-ai/.env' });

async function testGeminiREST() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Missing VITE_GEMINI_API_KEY");
        process.exit(1);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            { role: "user", parts: [{ text: "quiero cancelar mi turno para mañana" }] }
        ],
        systemInstruction: {
            parts: [{ text: "Eres el asistente de Dental Asistan." }]
        },
        tools: [
            {
                functionDeclarations: [
                    {
                        name: "cancel_appointment",
                        description: "Cancela un turno existente.",
                        parameters: {
                            type: "object",
                            properties: {
                                appointment_id: { type: "string" }
                            },
                            required: ["appointment_id"]
                        }
                    }
                ]
            }
        ],
        generationConfig: { temperature: 0.2 }
    };

    try {
        console.log("Sending pure POST request to Gemini 2.0 Flash REST API...");
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("API Response:");
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testGeminiREST();
