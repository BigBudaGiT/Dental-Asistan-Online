import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export default function GeminiTester() {
    const [logs, setLogs] = useState<any[]>([]);

    const fetchLogs = async () => {
        const { data } = await supabase
            .from("messages")
            .select("*")
            .order("received_at", { ascending: false })
            .limit(10);
        setLogs(data || []);
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="m-4 border-red-500 shadow-xl bg-slate-900 border-2">
            <CardContent className="p-4 text-xs font-mono text-white">
                <h2 className="text-red-400 font-bold mb-2">--- BACKEND ERROR MONITOR (Last 10 messages) ---</h2>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {logs.map((log, i) => (
                        <div key={i} className={`p-2 rounded ${log.message_content.includes('[DEV LOG]') ? 'bg-red-950 text-red-200' : 'bg-slate-800'}`}>
                            <span className="text-slate-500">[{new Date(log.received_at).toLocaleTimeString()}]</span>{" "}
                            <strong>{log.sender}:</strong> {log.message_content}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
