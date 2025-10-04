import * as vscode from 'vscode';

interface LiveShareParticipant {
  userId: string;
  userName: string;
  email?: string;
  role: 'Owner' | 'Guest';
  joinedAt: number;
  activeFile?: string;
  cursorPosition?: { line: number; character: number };
  selection?: { start: { line: number; character: number }; end: { line: number; character: number } };
  color?: string;
}

interface LiveShareSession {
  sessionId: string;
  role: 'Host' | 'Guest';
  peerCount: number;
  state: string;
}

export class LiveShareMonitor {
  private liveShare: any = null;
  private participants: Map<string, LiveShareParticipant> = new Map();
  private onEventCallback: ((event: any) => void) | null = null;
  private sessionActive = false;
  private currentUserId: string = 'host';
  private currentUserName: string = 'You';
  private currentUserColor: string = '#10b981'; // Emerald-500
  private cursorTrackingDisposables: vscode.Disposable[] = [];

  async initialize() {
    try {
      // Try to get Live Share extension
      const liveShareExtension = vscode.extensions.getExtension('ms-vsliveshare.vsliveshare');
      
      if (!liveShareExtension) {
        console.log('⚠️ Live Share extension not installed - using custom collaboration mode');
        // Return true to enable custom collaboration without Live Share
        return true;
      }

      if (!liveShareExtension.isActive) {
        await liveShareExtension.activate();
      }

      // Get the Live Share API
      this.liveShare = await liveShareExtension.exports.getApi('1.0.0');
      
      if (!this.liveShare) {
        console.log('⚠️ Live Share API not available - using custom collaboration mode');
        return true;
      }

      console.log('✅ Live Share API initialized');
      
      // Listen for session changes
      this.liveShare.onDidChangeSession(async (event: any) => {
        await this.handleSessionChange(event);
      });

      // Listen for participant changes (peers)
      this.liveShare.onDidChangePeers?.(async (event: any) => {
        await this.handlePeersChange(event);
      });

      return true;
    } catch (error) {
      console.error('⚠️ Live Share initialization failed - using custom collaboration mode:', error);
      // Still return true to enable custom collaboration
      return true;
    }
  }

  private async handleSessionChange(event: any) {
    const session = event.session;
    
    if (!session) {
      // Session ended
      console.log('🔄 Live Share session ended');
      this.sessionActive = false;
      this.participants.clear();
      
      this.broadcastEvent({
        type: 'liveshare-session-ended',
        timestamp: Date.now(),
      });
      return;
    }

    console.log(`🔄 Live Share session changed: ${session.id}`);
    this.sessionActive = true;
    
    const sessionInfo: LiveShareSession = {
      sessionId: session.id || 'unknown',
      role: session.role === 0 ? 'Host' : 'Guest',
      peerCount: session.peerCount || 0,
      state: this.getSessionState(session),
    };

    this.broadcastEvent({
      type: 'liveshare-session-changed',
      session: sessionInfo,
      timestamp: Date.now(),
    });
  }

  private async handlePeersChange(event: any) {
    console.log(`👥 Live Share peers changed: ${event.added?.length || 0} added, ${event.removed?.length || 0} removed`);

    // Handle added peers
    if (event.added) {
      for (const peer of event.added) {
        const participant: LiveShareParticipant = {
          userId: peer.peerNumber?.toString() || `peer-${Date.now()}`,
          userName: peer.user?.displayName || `Guest ${peer.peerNumber || '?'}`,
          email: peer.user?.emailAddress,
          role: 'Guest',
          joinedAt: Date.now(),
        };

        this.participants.set(participant.userId, participant);

        // Broadcast user joined
        this.broadcastEvent({
          type: 'user-joined',
          user: participant,
          timestamp: Date.now(),
        });

        // Show notification in VSCode
        vscode.window.showInformationMessage(
          `👋 ${participant.userName} joined the workspace`
        );
      }
    }

    // Handle removed peers
    if (event.removed) {
      for (const peer of event.removed) {
        const userId = peer.peerNumber?.toString() || 'unknown';
        const participant = this.participants.get(userId);

        if (participant) {
          this.participants.delete(userId);

          // Broadcast user left
          this.broadcastEvent({
            type: 'user-left',
            user: participant,
            timestamp: Date.now(),
          });

          // Show notification in VSCode
          vscode.window.showInformationMessage(
            `👋 ${participant.userName} left the workspace`
          );
        }
      }
    }
  }

  private getSessionState(session: any): string {
    // Map session state to readable string
    if (session.state === undefined) return 'active';
    return session.state.toString();
  }

  private broadcastEvent(event: any) {
    console.log('📡 Broadcasting Live Share event:', event.type);
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }

  async startSession(): Promise<string | null> {
    try {
      console.log('🚀 Starting collaboration session...');
      
      // If Live Share is available, use it
      if (this.liveShare) {
        const session = await this.liveShare.share({ suppressNotification: false });
        
        if (!session) {
          throw new Error('Failed to start Live Share session');
        }

        // Get the share link
        let shareLink: string | null = null;
        
        if (session.peerNumber === 0) {
          // We're the host, get the share URI
          const uri = await session.getSharedServerUri?.();
          shareLink = uri?.toString() || null;
        }
        
        console.log(`✅ Live Share session started: ${shareLink || 'No link available'}`);
        this.sessionActive = true;
        
        return shareLink;
      } else {
        // Custom collaboration mode (without Live Share)
        console.log('📡 Starting custom collaboration session...');
        this.sessionActive = true;
        
        // Generate a custom session link (workspace URL)
        const workspaceUrl = vscode.workspace.workspaceFolders?.[0]?.uri.toString();
        const sessionId = `kalpana-${Date.now()}`;
        const customLink = `${workspaceUrl}#session=${sessionId}`;
        
        console.log(`✅ Custom collaboration session started: ${customLink}`);
        
        // Broadcast session started event
        this.broadcastEvent({
          type: 'liveshare-session-changed',
          session: {
            sessionId,
            role: 'Host',
            peerCount: 0,
            state: 'active',
          },
          timestamp: Date.now(),
        });
        
        return customLink;
      }
    } catch (error: any) {
      console.error('❌ Failed to start collaboration session:', error);
      throw error;
    }
  }

  async endSession() {
    if (!this.liveShare) return;

    try {
      await this.liveShare.end?.();
      console.log('✅ Live Share session ended');
      
      this.sessionActive = false;
      this.participants.clear();
      
      this.broadcastEvent({
        type: 'liveshare-session-ended',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('❌ Failed to end Live Share session:', error);
    }
  }

  getParticipants(): LiveShareParticipant[] {
    return Array.from(this.participants.values());
  }

  isActive(): boolean {
    return this.sessionActive;
  }

  onEvent(callback: (event: any) => void) {
    this.onEventCallback = callback;
  }

  // ========== Custom Cursor Tracking ==========
  
  startCursorTracking() {
    console.log('📍 Starting cursor tracking...');
    
    // Track cursor position changes
    const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (!this.sessionActive) return;
      
      const editor = event.textEditor;
      const selection = editor.selection;
      const activeFile = vscode.workspace.asRelativePath(editor.document.uri);
      
      // Broadcast cursor update
      this.broadcastEvent({
        type: 'cursor-update',
        userId: this.currentUserId,
        userName: this.currentUserName,
        color: this.currentUserColor,
        file: activeFile,
        cursorPosition: {
          line: selection.active.line,
          character: selection.active.character,
        },
        selection: {
          start: {
            line: selection.start.line,
            character: selection.start.character,
          },
          end: {
            line: selection.end.line,
            character: selection.end.character,
          },
        },
        timestamp: Date.now(),
      });
    });

    // Track active file changes
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!this.sessionActive || !editor) return;
      
      const activeFile = vscode.workspace.asRelativePath(editor.document.uri);
      
      // Broadcast file change
      this.broadcastEvent({
        type: 'file-changed',
        userId: this.currentUserId,
        userName: this.currentUserName,
        color: this.currentUserColor,
        file: activeFile,
        timestamp: Date.now(),
      });
    });

    // Track visible editors (for presence in multiple files)
    const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      if (!this.sessionActive) return;
      
      const visibleFiles = editors.map(editor => 
        vscode.workspace.asRelativePath(editor.document.uri)
      );
      
      // Broadcast visible files update
      this.broadcastEvent({
        type: 'visible-files-changed',
        userId: this.currentUserId,
        userName: this.currentUserName,
        visibleFiles,
        timestamp: Date.now(),
      });
    });

    this.cursorTrackingDisposables.push(
      selectionChangeDisposable,
      activeEditorDisposable,
      visibleEditorsDisposable
    );
    
    console.log('✅ Cursor tracking started');
  }

  stopCursorTracking() {
    console.log('🛑 Stopping cursor tracking...');
    this.cursorTrackingDisposables.forEach(disposable => disposable.dispose());
    this.cursorTrackingDisposables = [];
  }

  // Simulate a remote user joining (for testing)
  simulateUserJoin(userName: string, userId?: string) {
    const newUser: LiveShareParticipant = {
      userId: userId || `user-${Date.now()}`,
      userName,
      role: 'Guest',
      joinedAt: Date.now(),
      color: this.generateRandomColor(),
    };

    this.participants.set(newUser.userId, newUser);

    this.broadcastEvent({
      type: 'user-joined',
      user: newUser,
      timestamp: Date.now(),
    });

    return newUser;
  }

  // Update remote user cursor position
  updateRemoteUserCursor(userId: string, file: string, cursorPosition: any, selection?: any) {
    const participant = this.participants.get(userId);
    if (!participant) return;

    participant.activeFile = file;
    participant.cursorPosition = cursorPosition;
    participant.selection = selection;

    this.broadcastEvent({
      type: 'cursor-update',
      userId,
      userName: participant.userName,
      color: participant.color,
      file,
      cursorPosition,
      selection,
      timestamp: Date.now(),
    });
  }

  private generateRandomColor(): string {
    const colors = [
      '#3b82f6', // Blue
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#f59e0b', // Amber
      '#10b981', // Emerald
      '#06b6d4', // Cyan
      '#f97316', // Orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
