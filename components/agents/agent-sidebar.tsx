"use client";

import { Badge } from "@/components/ui/badge";
import { Activity, MessageSquare } from "lucide-react";
import React, { useState } from "react";

interface AgentSidebarProps {
  children: React.ReactNode;
  activityCount: number;
  chatCount: number;
  defaultTab?: "activity" | "chat";
}

export function AgentSidebar({
  children,
  activityCount,
  chatCount,
  defaultTab = "activity",
}: AgentSidebarProps) {
  const [activeTab, setActiveTab] = useState<"activity" | "chat">(defaultTab);
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);

  // Handle sidebar resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    setSidebarWidth(Math.max(300, Math.min(800, newWidth)));
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Attach global mouse listeners
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  return (
    <div className="flex flex-col relative" style={{ width: `${sidebarWidth}px` }}>
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />

      {/* Tab Header */}
      <div className="border-b border-zinc-800/50 px-4 py-3 bg-zinc-900/30">
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${
              activeTab === "activity"
                ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <Activity className="h-4 w-4" />
            Activity
            {activityCount > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0">
                {activityCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${
              activeTab === "chat"
                ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
            {chatCount > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0">
                {chatCount}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            // Pass activeTab to children
            return React.cloneElement(child as React.ReactElement<any>, {
              isActive: child.props.tab === activeTab,
            });
          }
          return child;
        })}
      </div>
    </div>
  );
}

// Tab content wrapper
export function AgentSidebarTab({
  tab,
  isActive,
  children,
}: {
  tab: "activity" | "chat";
  isActive?: boolean;
  children: React.ReactNode;
}) {
  if (!isActive) return null;
  return <>{children}</>;
}
