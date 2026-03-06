import { useState, useEffect, useRef } from "react";
import { Search, Send, Loader2, Smile, UserPlus, Save, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ChatSummary {
  phone_number: string;
  last_message: string;
  last_time: string;
}

interface Message {
  id: string;
  phone_number: string;
  message_content: string;
  media_url: string | null;
  sender: string;
  received_at: string;
}

interface Contact {
  phone_number: string;
  name: string;
}

const MessagesTab = () => {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");

  // Mobile UI state: false = show list, true = show conversation
  const [showMobileChat, setShowMobileChat] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all messages, grouped by phone
  const { data: allMessages = [] } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("received_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    refetchInterval: 5000,
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*");
      if (error) throw error;
      return data as Contact[];
    },
  });

  const getContactName = (phone: string) => {
    const contact = contacts.find((c) => c.phone_number === phone);
    return contact ? contact.name : null;
  };

  // Group by phone
  const chatMap = new Map<string, Message[]>();
  allMessages.forEach((msg) => {
    if (!chatMap.has(msg.phone_number)) chatMap.set(msg.phone_number, []);
    chatMap.get(msg.phone_number)!.push(msg);
  });

  const chats: ChatSummary[] = Array.from(chatMap.entries())
    .map(([phone, msgs]) => ({
      phone_number: phone,
      last_message: msgs[msgs.length - 1].message_content,
      last_time: new Date(msgs[msgs.length - 1].received_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
    }))
    .sort((a, b) => b.last_time.localeCompare(a.last_time));

  const filteredChats = chats.filter((c) => {
    const name = getContactName(c.phone_number);
    const searchLower = search.toLowerCase();
    return c.phone_number.includes(searchLower) || (name && name.toLowerCase().includes(searchLower));
  });

  const conversationMessages = selectedPhone ? (chatMap.get(selectedPhone) || []) : [];

  // Robust auto-scroll
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };

    // Jump immediately
    scrollToBottom();
    // Re-jump after a short delay in case images or avatars are still rendering
    const timeoutId = setTimeout(scrollToBottom, 150);

    return () => clearTimeout(timeoutId);
  }, [conversationMessages.length, selectedPhone]);

  const getInitials = (text: string) => {
    const parts = text.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const emojis = ["😀", "😂", "😍", "🥰", "😊", "🙏", "👍", "👋", "❤️", "🔥", "✅", "⭐", "🎉", "💪", "📅", "🦷", "💉", "🏥", "⏰", "📞", "✨", "🙌", "😷", "💊", "🩺", "📋", "🗓️", "👨‍⚕️", "👩‍⚕️", "💬"];

  const insertEmoji = (emoji: string) => {
    setReplyText((prev) => prev + emoji);
    setShowEmojis(false);
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    if (showEmojis) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojis]);

  const handleSaveContact = async () => {
    if (!selectedPhone || !newContactName.trim()) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .insert({ phone_number: selectedPhone, name: newContactName.trim() });

      if (error) {
        if (error.code === '23505') {
          // Unlikely to hit unique violation unless race condition, but handle gracefully
          await supabase.from("contacts").update({ name: newContactName.trim() }).eq('phone_number', selectedPhone);
        } else {
          throw error;
        }
      }

      toast({ title: "Contacto guardado", description: "El nombre se actualizó correctamente." });
      setIsContactModalOpen(false);
      setNewContactName("");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedPhone || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone_number: selectedPhone,
          message: replyText.trim(),
        },
      });

      if (error) {
        toast({ title: "Error de conexión", description: error.message, variant: "destructive" });
        return;
      }

      if (data && !data.success) {
        toast({ title: "Error al enviar", description: data.error || "Error desconocido", variant: "destructive" });
        console.error("send-whatsapp error:", data);
        return;
      }

      console.log("send-whatsapp response:", data);
      setReplyText("");
      // Small delay to ensure DB write is committed, then refetch
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["messages"] });
      }, 500);
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (allMessages.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">Sin mensajes aún</p>
          <p className="text-sm">Los mensajes de WhatsApp aparecerán aquí cuando los pacientes escriban.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card overflow-hidden">
      {/* Chat List (Hidden on mobile if a chat is selected) */}
      <div className={`w-full md:w-80 border-r flex-col shrink-0 ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="search-messages" name="search-messages" placeholder="Buscar por teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredChats.map((chat) => {
            const contactName = getContactName(chat.phone_number);
            const displayName = contactName || chat.phone_number;
            return (
              <button
                key={chat.phone_number}
                onClick={() => {
                  setSelectedPhone(chat.phone_number);
                  setShowMobileChat(true); // Switch to chat view on mobile
                }}
                className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${selectedPhone === chat.phone_number ? "bg-accent" : "hover:bg-muted/50"}`}
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{chat.last_time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.last_message}</p>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* Conversation (Hidden on mobile if no chat is selected) */}
      <div className={`flex-1 flex-col min-w-0 ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
        {selectedPhone ? (
          <>
            <div className="h-14 border-b flex items-center justify-between px-4 gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2 shrink-0"
                  onClick={() => setShowMobileChat(false)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{getInitials(getContactName(selectedPhone) || selectedPhone)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{getContactName(selectedPhone) || selectedPhone}</p>
                  {getContactName(selectedPhone) && <p className="text-xs text-muted-foreground">{selectedPhone}</p>}
                </div>
              </div>
              {!getContactName(selectedPhone) && (
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setIsContactModalOpen(true)}>
                  <UserPlus className="w-4 h-4" />
                  Guardar Nombre
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-3 max-w-2xl mx-auto w-full pb-4 px-1">
                {conversationMessages.map((msg) => (
                  <div key={msg.id} className={`flex w-full ${msg.sender === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] md:max-w-[75%] flex flex-col min-w-0 rounded-2xl px-4 py-2.5 text-sm ${msg.sender === "user" ? "bg-muted text-foreground rounded-bl-md" : "bg-primary text-primary-foreground rounded-br-md"}`}>
                      {msg.media_url && (
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="block mb-2 overflow-hidden rounded-xl">
                          <img
                            src={msg.media_url}
                            alt="Imagen del paciente"
                            className="w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            loading="lazy"
                          />
                        </a>
                      )}
                      {msg.message_content && !msg.message_content.startsWith("📷") && (
                        <p className="whitespace-pre-wrap break-words break-all text-left">{msg.message_content}</p>
                      )}
                      <p className={`text-[10px] mt-1 text-right ${msg.sender === "user" ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                        {new Date(msg.received_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            {/* Reply input */}
            <div className="border-t p-3 flex items-center gap-2 shrink-0 relative">
              {/* Emoji picker */}
              {showEmojis && (
                <div ref={emojiRef} className="absolute bottom-14 left-3 bg-popover border rounded-xl shadow-lg p-3 z-50 w-[280px]">
                  <div className="grid grid-cols-6 gap-1">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="text-xl hover:bg-muted rounded-lg p-1.5 transition-colors text-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button size="icon" variant="ghost" onClick={() => setShowEmojis(!showEmojis)} className="shrink-0">
                <Smile className="w-5 h-5 text-muted-foreground" />
              </Button>
              <Input
                id="reply-message"
                name="reply-message"
                placeholder="Escribe un mensaje..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                className="flex-1 h-10 text-sm"
                disabled={sending}
              />
              <Button size="icon" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecciona una conversación
          </div>
        )}
      </div>

      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Guardar Contacto</DialogTitle>
            <DialogDescription className="sr-only">
              Asigna un nombre a este número de teléfono para guardarlo en tus contactos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-1">Teléfono</p>
              <p className="text-sm font-medium">{selectedPhone}</p>
            </div>
            <div>
              <p className="text-sm text-foreground mb-1">Nombre del paciente</p>
              <Input
                id="new-contact-name"
                name="new-contact-name"
                placeholder="Ej. Juan Pérez"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveContact(); }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setIsContactModalOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveContact} disabled={!newContactName.trim()} className="gap-2 w-full sm:w-auto">
              <Save className="w-4 h-4" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesTab;
