"use client";
import { motion } from "framer-motion";
import { IoMenuOutline } from "react-icons/io5";
import { FaRobot } from "react-icons/fa";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="p-4 border-b bg-card/80 backdrop-blur-sm"
    >
      <div className="w-[95%] mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden hover:bg-primary/10"
          >
            <IoMenuOutline className="w-6 h-6" />
          </Button>
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            <FaRobot className="w-6 h-6 text-primary" />
          </motion.div>
          <h1 className="text-xl font-bold text-foreground bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
            AI Assistant
          </h1>
        </div>
      </div>
    </motion.div>
  );
};

export default Header;
