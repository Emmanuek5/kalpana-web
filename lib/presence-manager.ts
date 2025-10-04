/**
 * WebSocket-based Presence Manager
 *
 * This replaces the HTTP polling approach with real-time WebSocket updates.
 * Users broadcast their presence through the agent bridge WebSocket connection.
 */

export interface PresenceUser {
  userId: string;
  userName: string;
  userEmail?: string;
  role: "host" | "guest";
  color: string;
  joinedAt: number;
  lastSeen: number;
  activeFile?: string;
  cursorPosition?: { line: number; character: number };
}

export interface PresenceState {
  users: Map<string, PresenceUser>;
  hostUserId: string | null;
}

export class PresenceManager {
  private users: Map<string, PresenceUser> = new Map();
  private hostUserId: string | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(state: PresenceState) => void> = new Set();

  constructor() {
    // Cleanup stale users every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleUsers();
    }, 60000);
  }

  /**
   * Add or update a user's presence
   */
  updateUser(user: Omit<PresenceUser, "lastSeen">): void {
    const existing = this.users.get(user.userId);

    // Preserve role if already set
    const role =
      existing?.role || (this.hostUserId === null ? "host" : "guest");

    // Set host if this is the first user
    if (this.hostUserId === null) {
      this.hostUserId = user.userId;
    }

    this.users.set(user.userId, {
      ...user,
      role,
      lastSeen: Date.now(),
    });

    this.notifyListeners();
  }

  /**
   * Remove a user
   */
  removeUser(userId: string): void {
    this.users.delete(userId);

    // If host left, promote the oldest guest
    if (this.hostUserId === userId) {
      const remainingUsers = Array.from(this.users.values()).sort(
        (a, b) => a.joinedAt - b.joinedAt
      );

      if (remainingUsers.length > 0) {
        const newHost = remainingUsers[0];
        this.hostUserId = newHost.userId;
        newHost.role = "host";
        this.users.set(newHost.userId, newHost);
      } else {
        this.hostUserId = null;
      }
    }

    this.notifyListeners();
  }

  /**
   * Update user's active file and cursor position
   */
  updateUserActivity(
    userId: string,
    activity: {
      activeFile?: string;
      cursorPosition?: { line: number; character: number };
    }
  ): void {
    const user = this.users.get(userId);
    if (!user) return;

    this.users.set(userId, {
      ...user,
      ...activity,
      lastSeen: Date.now(),
    });

    this.notifyListeners();
  }

  /**
   * Get current presence state
   */
  getState(): PresenceState {
    return {
      users: new Map(this.users),
      hostUserId: this.hostUserId,
    };
  }

  /**
   * Get all active users as array
   */
  getUsers(): PresenceUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    return this.users.size;
  }

  /**
   * Check if user is host
   */
  isHost(userId: string): boolean {
    return this.hostUserId === userId;
  }

  /**
   * Subscribe to presence changes
   */
  subscribe(listener: (state: PresenceState) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleanup users who haven't sent a heartbeat in 90 seconds
   */
  private cleanupStaleUsers(): void {
    const now = Date.now();
    const staleThreshold = 90000; // 90 seconds
    let removed = false;

    for (const [userId, user] of this.users.entries()) {
      if (now - user.lastSeen > staleThreshold) {
        this.users.delete(userId);
        removed = true;
        console.log(`🧹 Removed stale user: ${user.userName}`);
      }
    }

    if (removed) {
      this.notifyListeners();
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error("Error in presence listener:", error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.users.clear();
    this.listeners.clear();
  }
}

// Singleton instance for server-side use
let presenceManagerInstance: PresenceManager | null = null;

export function getPresenceManager(): PresenceManager {
  if (!presenceManagerInstance) {
    presenceManagerInstance = new PresenceManager();
  }
  return presenceManagerInstance;
}

// Utility function to generate consistent user colors
const USER_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#ef4444", // Red
  "#84cc16", // Lime
  "#6366f1", // Indigo
];

export function getUserColor(userId: string): string {
  // Generate consistent color based on userId hash
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
