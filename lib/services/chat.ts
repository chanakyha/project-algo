import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
  user_id: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

class ChatService {
  private channel: RealtimeChannel | null = null;

  async subscribeToMessages(
    sessionId: string,
    onMessage: (message: Message) => void
  ) {
    const supabase = createClient();

    this.channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          onMessage(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      if (this.channel) {
        supabase.removeChannel(this.channel);
      }
    };
  }

  async fetchSessionMessages(sessionId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("session_messages")
      .select(
        `
        message:messages(
          id,
          content,
          role,
          created_at,
          user_id
        )
      `
      )
      .eq("session_id", sessionId)
      .order("sequence_order", { ascending: true });

    if (error) throw error;
    return data.map((item) => item.message);
  }

  async fetchUserSessions(userId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data;
  }
}

export const chatService = new ChatService();
