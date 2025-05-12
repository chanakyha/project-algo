"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoSend, IoCopy } from "react-icons/io5";
import { FaRobot, FaUser, FaTrash } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { a11yDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { MdFullscreen } from "react-icons/md";
import { chatService } from "@/lib/services/chat";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface Message {
  content: string;
  role: "user" | "assistant";
  codeBlocks?: Array<{
    code: string;
    language: string;
  }>;
  explanation?: string;
}

const MainPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fullscreenCode, setFullscreenCode] = useState<{
    code: string;
    language: string;
  } | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/getAIresponse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          context: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("API call failed");

      const data = await response.json();
      const aiMessage: Message = {
        role: "assistant",
        content: data.message,
        codeBlocks: data.codeBlocks,
        explanation: data.explanation,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDeleteChat = async () => {
    try {
      const chatId = window.location.pathname.split("/").pop();
      if (!chatId) return;

      await chatService.deleteSession(chatId);

      toast({
        title: "Success",
        description: "Chat deleted successfully",
      });

      router.push("/");
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete chat",
      });
    }
  };

  const renderMessage = (message: Message) => {
    if (message.role === "user") {
      return <p className="text-sm">{message.content}</p>;
    }

    return (
      <div className="space-y-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.explanation || message.content}
        </p>
        {message.codeBlocks?.map((block, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="relative">
              <div className="absolute right-2 top-2 flex gap-2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(block.code)}
                  className="h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                >
                  <IoCopy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFullscreenCode(block)}
                  className="h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                >
                  <MdFullscreen className="w-4 h-4" />
                </Button>
              </div>
              <SyntaxHighlighter
                style={a11yDark}
                language={block.language}
                className="rounded-lg !m-0 shadow-lg border border-border/50"
                showLineNumbers
                wrapLines
                customStyle={{
                  padding: "1.5rem",
                  fontSize: "0.9rem",
                  backgroundColor: "#0F172A",
                }}
              >
                {block.code}
              </SyntaxHighlighter>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-background to-background/95">
      <div className="flex-1 flex flex-col">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="border-b bg-card/80 backdrop-blur-sm p-4"
        >
          <div className="w-[95%] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 15 }}
                transition={{ duration: 0.2 }}
              >
                <FaRobot className="w-5 h-5 text-primary" />
              </motion.div>
              <h2 className="text-lg font-medium">Chat</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteChat}
              className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <FaTrash className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="max-w-[95%] mx-auto">
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -50, scale: 0.9 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`flex items-start gap-3 mb-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className={`flex gap-3 max-w-[90%]`}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className={`p-4 rounded-lg ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground shadow-lg"
                          : "bg-card/50 text-card-foreground border shadow-sm backdrop-blur-sm"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <motion.div
                          whileHover={{ rotate: 15 }}
                          transition={{ duration: 0.2 }}
                        >
                          {message.role === "user" ? (
                            <FaUser className="w-5 h-5" />
                          ) : (
                            <FaRobot className="w-5 h-5" />
                          )}
                        </motion.div>
                        {renderMessage(message)}
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border shadow-lg">
                    <div className="flex space-x-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5],
                            y: [0, -10, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 1,
                            delay: i * 0.2,
                          }}
                          className="w-2 h-2 bg-primary rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="border-t bg-card/80 backdrop-blur-sm p-4"
        >
          <form onSubmit={handleSubmit} className="w-[95%] mx-auto flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-3 rounded-lg border bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300"
            />
            <Button
              type="submit"
              disabled={isLoading}
              className="p-3 rounded-lg hover:scale-105 transition-transform duration-200"
            >
              <IoSend className="w-5 h-5" />
            </Button>
          </form>
        </motion.div>
      </div>

      <AnimatePresence>
        {fullscreenCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setFullscreenCode(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-6xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(fullscreenCode.code)}
                  className="absolute right-12 top-2 h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                >
                  <IoCopy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFullscreenCode(null)}
                  className="absolute right-2 top-2 h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                >
                  ×
                </Button>
                <SyntaxHighlighter
                  style={a11yDark}
                  language={fullscreenCode.language}
                  className="rounded-lg !m-0 shadow-xl"
                  showLineNumbers
                  wrapLines
                  customStyle={{
                    padding: "1.5rem",
                    fontSize: "0.9rem",
                    backgroundColor: "#0F172A",
                  }}
                >
                  {fullscreenCode.code}
                </SyntaxHighlighter>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainPage;
