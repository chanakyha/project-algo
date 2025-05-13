"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoSend, IoCopy } from "react-icons/io5";
import { FaRobot, FaUser, FaTrash, FaImage } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { a11yDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { MdFullscreen } from "react-icons/md";
import { chatService } from "@/lib/services/chat";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

interface Message {
  content: string;
  role: "user" | "assistant";
  codeBlocks?: Array<{
    code: string;
    language: string;
  }>;
  explanation?: string;
  image?: {
    url: string;
    name: string;
  };
}

const ImagePreview = ({
  image,
  onRemove,
}: {
  image: File;
  onRemove: () => void;
}) => {
  return (
    <div className="relative inline-block">
      <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
        <Image
          src={URL.createObjectURL(image)}
          alt="Preview"
          fill
          className="object-cover"
        />
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center hover:bg-destructive/90 transition-colors"
      >
        ×
      </button>
    </div>
  );
};

const MainPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatExists, setChatExists] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

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

  useEffect(() => {
    const chatId = window.location.pathname.split("/").pop();
    if (!chatId) return;

    const loadMessages = async () => {
      const supabase = createClient();

      // First check if chat session exists
      const { data: chatSession, error: chatError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", chatId)
        .single();

      if (chatError || !chatSession) {
        console.error("Chat session not found");
        setChatExists(false);
        return;
      }

      // If chat exists, load messages
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_session_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        return;
      }

      const formattedMessages = data.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        ...(msg.image_url && {
          image: {
            url: msg.image_url,
            name: "Uploaded Image",
          },
        }),
        // Parse code blocks and explanation if it's an AI message
        ...(msg.role === "assistant" && {
          codeBlocks: extractCodeBlocks(msg.content),
          explanation: msg.content.replace(/```[\s\S]*?```/g, "").trim(),
        }),
      }));

      setMessages(formattedMessages);
    };

    loadMessages();
  }, []);

  // Helper function to extract code blocks
  const extractCodeBlocks = (content: string) => {
    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || "text",
        code: match[2].trim(),
      });
    }

    return blocks;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    const chatId = window.location.pathname.split("/").pop();
    if (!chatId) return;

    let imageUrl = null;
    const supabase = createClient();

    try {
      // Upload image to Supabase Storage if present
      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const filePath = `${chatId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(filePath, selectedImage);

        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        // Get public URL for the uploaded image
        const {
          data: { publicUrl },
        } = supabase.storage.from("chat-images").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const formData = new FormData();
      if (input.trim()) formData.append("message", input);
      if (selectedImage) {
        formData.append("image", selectedImage);
      }
      formData.append(
        "context",
        JSON.stringify(
          messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
        )
      );

      const userMessage: Message = {
        role: "user",
        content: input,
        ...(imageUrl && {
          image: {
            url: imageUrl,
            name: selectedImage!.name,
          },
        }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setSelectedImage(null);
      setIsLoading(true);

      // Save user message to Supabase
      const { error: userMessageError } = await supabase
        .from("messages")
        .insert({
          chat_session_id: chatId,
          content: input,
          role: "user",
          created_at: new Date().toISOString(),
          image_url: imageUrl,
        })
        .select();

      if (userMessageError) {
        console.error("Error saving user message:", userMessageError);
        throw new Error("Failed to save user message");
      }

      // Get AI response
      const response = await fetch("/api/getAIresponse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("API call failed");

      const data = await response.json();
      const aiMessage: Message = {
        role: "assistant",
        content: data.message,
        codeBlocks: data.codeBlocks,
        explanation: data.explanation,
      };

      // Save AI response to Supabase
      const { error: aiMessageError } = await supabase
        .from("messages")
        .insert({
          chat_session_id: chatId,
          content: data.message,
          role: "assistant",
          created_at: new Date().toISOString(),
        })
        .select();

      if (aiMessageError) {
        console.error("Error saving AI message:", aiMessageError);
        throw new Error("Failed to save AI message");
      }

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message",
      });
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
    return (
      <div className="space-y-4">
        {message.image && (
          <div className="relative w-64 h-64 mb-4">
            <Image
              src={message.image.url}
              alt={message.image.name}
              fill
              className="object-cover rounded-lg"
            />
          </div>
        )}
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

  if (!chatExists) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-background to-background/95">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <FaRobot className="w-16 h-16 text-primary/50" />
            <h1 className="text-2xl font-semibold">Chat Not Found</h1>
            <p className="text-muted-foreground">
              This chat session doesn&apos;t exist or has been deleted.
            </p>
            <Button onClick={() => router.push("/")} className="mt-4">
              Return to Home
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

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
          <form onSubmit={handleSubmit} className="w-[95%] mx-auto space-y-3">
            {selectedImage && (
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                <ImagePreview
                  image={selectedImage}
                  onRemove={() => setSelectedImage(null)}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedImage.name}
                </span>
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 p-3 rounded-lg border bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setSelectedImage(e.target.files?.[0] || null)
                  }
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("image-upload")?.click()
                  }
                  className="p-3 rounded-lg"
                >
                  <FaImage className="w-5 h-5" />
                </Button>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="p-3 rounded-lg hover:scale-105 transition-transform duration-200"
              >
                <IoSend className="w-5 h-5" />
              </Button>
            </div>
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
