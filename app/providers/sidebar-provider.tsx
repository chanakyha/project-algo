"use client";
import React, { createContext, useContext, useState } from "react";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

interface SidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Don't show sidebar and header on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <div className="flex h-screen">
        <div className="hidden md:block">
          <Sidebar isOpen={true} onClose={() => {}} />
        </div>

        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <div className="md:hidden">
              <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
          )}
        </AnimatePresence>

        <div className="flex-1">{children}</div>
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
