import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionUrl?: string;
  workspaceId?: string;
  agentId?: string;
  deploymentId?: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  // Fetch notifications from database
  fetchNotifications: () => Promise<void>;
  
  // Add notification (saves to database)
  addNotification: (notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    actionLabel?: string;
    actionUrl?: string;
    workspaceId?: string;
    agentId?: string;
    deploymentId?: string;
  }) => Promise<void>;
  
  // Mark as read (updates database)
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  
  // Remove notification (deletes from database)
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotifications = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  
  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        set({
          notifications: data.notifications.map((n: any) => ({
            ...n,
            type: n.type.toLowerCase(),
            timestamp: new Date(n.createdAt),
          })),
          unreadCount: data.unreadCount,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },
  
  addNotification: async (notification) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
      
      if (response.ok) {
        const newNotification = await response.json();
        set((state) => ({
          notifications: [
            {
              ...newNotification,
              type: newNotification.type.toLowerCase(),
              timestamp: new Date(newNotification.createdAt),
            },
            ...state.notifications,
          ],
          unreadCount: state.unreadCount + 1,
        }));
      }
    } catch (error) {
      console.error('Failed to add notification:', error);
    }
  },
  
  markAsRead: async (id) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id] }),
      });
      
      if (response.ok) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },
  
  markAllAsRead: async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      
      if (response.ok) {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  },
  
  removeNotification: async (id) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: notification && !notification.read 
              ? Math.max(0, state.unreadCount - 1) 
              : state.unreadCount,
          };
        });
      }
    } catch (error) {
      console.error('Failed to remove notification:', error);
    }
  },
  
  clearAll: async () => {
    try {
      const response = await fetch('/api/notifications?all=true', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        set({ notifications: [], unreadCount: 0 });
      }
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  },
}));
