"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaRobot } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const HomeClient = () => {
  const router = useRouter();

  const handleStartChat = async () => {
    const supabase = createClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: "New Chat",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      router.push(`/chat/${data.id}`);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <FaRobot className="w-16 h-16 text-primary" />
        </motion.div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Welcome to AI Assistant
        </h1>

        <p className="text-lg text-muted-foreground">
          Your intelligent programming companion powered by advanced AI. Get
          help with coding, debugging, and learning new programming concepts.
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-4"
        >
          <Button
            onClick={handleStartChat}
            className="h-12 px-8 text-lg font-medium"
          >
            <FaRobot className="mr-2 h-5 w-5" />
            Start New Chat
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HomeClient;
