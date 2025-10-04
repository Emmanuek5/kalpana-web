"use client";

import React from "react";
import { Bell, Check, X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { useNotifications } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch notifications on mount
  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-l-emerald-500";
      case "error":
        return "border-l-red-500";
      case "warning":
        return "border-l-yellow-500";
      default:
        return "border-l-blue-500";
    }
  };

  return (
    <div className="relative z-[100]" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-8 w-8 rounded-lg hover:bg-zinc-800/80 flex items-center justify-center transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4 text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-96 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-zinc-400 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    title="Mark all as read"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs text-zinc-400 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    title="Clear all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Bell className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-zinc-800/50 transition-colors border-l-2 ${getTypeColor(notification.type)} ${
                      !notification.read ? "bg-zinc-800/30" : ""
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium text-zinc-100 leading-tight">
                            {notification.title}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-zinc-500">
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </span>
                          {(notification.actionLabel && notification.actionUrl) && (
                            <a
                              href={notification.actionUrl}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                            >
                              {notification.actionLabel}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
