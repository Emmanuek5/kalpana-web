"use client";

import React from "react";
import { MessageSquare, Plus, Pin, Trash2, MoreVertical, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatItem {
  id: string;
  title: string;
  description?: string | null;
  isPinned: boolean;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
}

interface ChatSwitcherProps {
  chats: ChatItem[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onPinChat: (chatId: string, isPinned: boolean) => void;
}

export function ChatSwitcher({
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  onDeleteChat,
  onRenameChat,
  onPinChat,
}: ChatSwitcherProps) {
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");

  const handleRename = (chatId: string, currentTitle: string) => {
    setEditingId(chatId);
    setEditTitle(currentTitle);
    setMenuOpen(null);
  };

  const handleSaveRename = (chatId: string) => {
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

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

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Chats</h2>
        <Button
          onClick={onCreateChat}
          size="sm"
          className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <MessageSquare className="h-12 w-12 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No chats yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Create your first chat to get started
            </p>
          </div>
        ) : (
          <div className="py-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative px-3 py-2 mx-2 mb-1 rounded-lg cursor-pointer transition-all ${
                  currentChatId === chat.id
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "hover:bg-zinc-800/50"
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingId === chat.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveRename(chat.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(chat.id);
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditTitle("");
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {chat.isPinned && (
                          <Pin className="h-3 w-3 text-amber-500 shrink-0" />
                        )}
                        <h3 className="text-sm font-medium text-zinc-200 truncate">
                          {chat.title}
                        </h3>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-500">
                        {chat.messageCount} messages
                      </span>
                      <span className="text-xs text-zinc-600">•</span>
                      <span className="text-xs text-zinc-500">
                        {formatDate(chat.lastMessageAt)}
                      </span>
                    </div>
                  </div>

                  {/* Menu Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === chat.id ? null : chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4 text-zinc-400" />
                    </button>

                    {/* Dropdown Menu */}
                    {menuOpen === chat.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRename(chat.id, chat.title);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2 rounded-t-lg"
                        >
                          <PenLine className="h-3 w-3" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPinChat(chat.id, !chat.isPinned);
                            setMenuOpen(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                        >
                          <Pin className="h-3 w-3" />
                          {chat.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Delete "${chat.title}"? This cannot be undone.`
                              )
                            ) {
                              onDeleteChat(chat.id);
                            }
                            setMenuOpen(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2 rounded-b-lg"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          {chats.length} {chats.length === 1 ? "chat" : "chats"}
        </p>
      </div>
    </div>
  );
}
