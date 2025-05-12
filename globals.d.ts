interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  chat_session_id: string;
  content: string;
  role: string;
  created_at: string;
}
