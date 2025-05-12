"use client";
import { motion } from "framer-motion";
import { IoClose } from "react-icons/io5";
import { FaUser, FaHistory, FaCog, FaRobot } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { signOut } from "@/app/login/actions";
import { ModeToggle } from "@/components/ui/modetoggler";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { chatService, type ChatSession } from "@/lib/services/chat";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserMetadata {
  username?: string;
  avatar_url?: string;
  display_name?: string;
  [key: string]: string | undefined; // Allow any string key but enforce string or undefined values
}

interface UserData {
  email: string | undefined;
  username: string | undefined;
  avatar_url: string | undefined;
  display_name: string | undefined;
  created_at: string | undefined;
  last_sign_in_at: string | undefined;
  user_metadata: UserMetadata | undefined;
}

const Sidebar = ({ onClose }: SidebarProps) => {
  const [activeSection, setActiveSection] = useState<"chats" | "settings">(
    "chats"
  );
  const [userData, setUserData] = useState<UserData>({
    email: undefined,
    username: undefined,
    avatar_url: undefined,
    display_name: undefined,
    created_at: undefined,
    last_sign_in_at: undefined,
    user_metadata: undefined,
  });
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch of user data
    const fetchUserData = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Error fetching user:", error.message);
        return;
      }

      if (user) {
        setUserData({
          email: user.email,
          username:
            user.user_metadata?.username || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url,
          display_name:
            user.user_metadata?.display_name || user.user_metadata?.username,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          user_metadata: user.user_metadata,
        });
      }
    };

    fetchUserData();

    // Set up real-time subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "USER_UPDATED" || event === "SIGNED_IN") {
        const user = session?.user;
        if (user) {
          setUserData({
            email: user.email,
            username:
              user.user_metadata?.username ||
              user.email?.split("@")[0] ||
              "User",
            avatar_url: user.user_metadata?.avatar_url,
            display_name:
              user.user_metadata?.display_name || user.user_metadata?.username,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            user_metadata: user.user_metadata,
          });
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchChats = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const sessions = await chatService.fetchUserSessions(user.id);
          setChatSessions(sessions);
        } catch (error) {
          console.error("Error fetching chats:", error);
        }
      }
    };

    fetchChats();
  }, []);

  const sidebarVariants = {
    hidden: { x: -300, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 25,
        mass: 1,
      },
    },
    exit: {
      x: -300,
      opacity: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.08,
        duration: 0.4,
        ease: "easeOut",
      },
    }),
  };

  const handleNewChat = async () => {
    const supabase = createClient();

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Error getting user:", userError);
        return;
      }

      // Create new chat session
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

      if (error) {
        console.error("Error creating chat:", error);
        return;
      }

      // Refresh the chat list
      router.refresh();

      // Navigate to the new chat
      router.push(`/chat/${data.id}`);

      // Close sidebar on mobile
      onClose();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      <motion.div
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed md:static left-0 top-0 h-full w-[300px] bg-background/95 backdrop-blur-xl border-r shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-6 py-5 border-b flex items-center justify-between bg-card/50"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/20 overflow-hidden">
              {userData.avatar_url ? (
                <img
                  src={userData.avatar_url}
                  alt={userData.display_name || userData.username || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FaUser className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                {userData.display_name || userData.username}
              </h2>
              <p className="text-xs text-muted-foreground">{userData.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden -mr-2 h-9 w-9 hover:bg-primary/10 rounded-full"
          >
            <IoClose className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Navigation */}
        <motion.div
          className="px-3 pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col gap-1.5">
            <Button
              variant="default"
              className="w-full h-10 font-medium mb-2"
              onClick={handleNewChat}
            >
              <FaRobot className="mr-2 h-4 w-4" /> New Chat
            </Button>
            <Button
              variant={activeSection === "chats" ? "secondary" : "ghost"}
              className={`justify-start h-10 px-4 rounded-lg font-medium ${
                activeSection === "chats"
                  ? "bg-secondary hover:bg-secondary/90"
                  : "hover:bg-secondary/70"
              }`}
              onClick={() => setActiveSection("chats")}
            >
              <FaHistory className="mr-3 h-4 w-4 opacity-80" /> Chats
            </Button>
            <Button
              variant={activeSection === "settings" ? "secondary" : "ghost"}
              className={`justify-start h-10 px-4 rounded-lg font-medium ${
                activeSection === "settings"
                  ? "bg-secondary hover:bg-secondary/90"
                  : "hover:bg-secondary/70"
              }`}
              onClick={() => setActiveSection("settings")}
            >
              <FaCog className="mr-3 h-4 w-4 opacity-80" /> Settings
            </Button>
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {activeSection === "chats" ? (
            <div className="space-y-2">
              {chatSessions.map((chat, i) => (
                <motion.div
                  key={chat.id}
                  custom={i}
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  className="p-3.5 rounded-lg hover:bg-secondary/60 cursor-pointer transition-all duration-200 border border-transparent hover:border-border/50 group"
                  onClick={() => {
                    router.push(`/chat/${chat.id}`);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <FaRobot className="w-4 h-4 text-primary/70" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">{chat.title}</h3>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 px-1">
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                className="space-y-3"
              >
                <label className="text-sm font-medium text-foreground/90">
                  Theme Preferences
                </label>
                <div className="flex justify-center">
                  <ModeToggle className="w-full h-10 shadow-sm" />
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-4 border-t mt-auto bg-card/50"
        >
          <Button
            variant="destructive"
            size="sm"
            className="w-full h-10 text-sm font-medium hover:bg-destructive/90 transition-colors"
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </motion.div>
      </motion.div>
    </>
  );
};

export default Sidebar;
