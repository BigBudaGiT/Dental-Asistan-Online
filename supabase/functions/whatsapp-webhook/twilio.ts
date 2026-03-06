/**
 * Utility functions for interacting with the Twilio API.
 */

export const sendWhatsAppMessage = async (
    to: string,
    body: string
): Promise<boolean> => {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
        console.error("Missing Twilio configuration environment variables.");
        return false;
    }

    // Ensure the recipient number has the required "whatsapp:" prefix
    const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:+${to.replace(/\D/g, "")}`;
    const fromWhatsApp = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const requestBody = new URLSearchParams();
    requestBody.append("To", toWhatsApp);
    requestBody.append("From", fromWhatsApp);
    requestBody.append("Body", body);

    try {
        const response = await fetch(twilioUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
            },
            body: requestBody.toString(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to send Twilio message:", errorData);
            return false;
        }

        const data = await response.json();
        console.log("Message sent successfully. SID:", data.sid);
        return true;
    } catch (error: any) {
        console.error("Error connecting to Twilio API:", error.message);
        return false;
    }
};
