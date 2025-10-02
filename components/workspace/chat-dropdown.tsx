"use client";

import React from "react";
import { ChevronDown, MessageSquare } from "lucide-react";

export interface ChatItem {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: Date;
}

interface ChatDropdownProps {
  chats: ChatItem[];
  currentChatId: string | null;
  currentChatTitle: string;
  onSelectChat: (chatId: string) => void;
  onCreateChat?: () => void; // Optional now, handled by parent
}

export function ChatDropdown({
  chats,
  currentChatId,
  currentChatTitle,
  onSelectChat,
  onCreateChat,
}: ChatDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  // Show last 5 chats
  const recentChats = chats ? chats.slice(0, 5) : [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors"
      >
        <MessageSquare className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium text-zinc-300 max-w-[150px] truncate">
          {currentChatTitle}
        </span>
        <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu - Simplified */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Recent Chats */}
          <div className="max-h-[280px] overflow-y-auto py-0.5">
            {recentChats.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <MessageSquare className="h-6 w-6 text-zinc-700 mx-auto mb-1.5" />
                <p className="text-xs text-zinc-600">No chats yet</p>
              </div>
            ) : (
              recentChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    onSelectChat(chat.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-zinc-800 transition-colors ${
                    currentChatId === chat.id ? "bg-zinc-800/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-200 truncate flex-1">
                      {chat.title}
                    </span>
                    {currentChatId === chat.id && (
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
