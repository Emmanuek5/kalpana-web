import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface AgentState {
  status: string;
  messages: any[];
  toolCalls: any[];
  filesEdited: any[];
  connected: boolean;
}

export function useAgentStream(agentId: string | null) {
  const [state, setState] = useState<AgentState>({
    status: 'IDLE',
    messages: [],
    toolCalls: [],
    filesEdited: [],
    connected: false
  });
  
  const socketRef = useRef<Socket | null>(null);
  const lastChunkRef = useRef<string | null>(null);

  
  useEffect(() => {
    if (!agentId) return;
    
    console.log(`🔌 Connecting to Socket.io for agent ${agentId}`);
    
    // Connect to Socket.io container
    const socket = io('http://localhost:3002', {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ Socket.io connected');
      setState(prev => ({ ...prev, connected: true }));
      
      // Subscribe to agent
      socket.emit('subscribe-agent', agentId);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket.io disconnected');
      setState(prev => ({ ...prev, connected: false }));
    });
    
    // Receive initial state
    socket.on('agent-state', (initialState: any) => {
      console.log('📦 Received initial agent state', initialState);
      setState(prev => ({
        ...prev,
        status: initialState.status,
        messages: initialState.conversationHistory || [],
        toolCalls: initialState.toolCalls || [],
        filesEdited: initialState.filesEdited || []
      }));
    });
    
    // Receive real-time events
    socket.on('agent-event', (event: any) => {
      console.log('📡 Received agent event:', event.type);
      
      switch (event.type) {
        case 'text-delta':
          setState(prev => {
            const messages = [...prev.messages];
            const lastMessage = messages[messages.length - 1];
            
            if (lastChunkRef.current === event.textDelta) {
              return prev;
            }

            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.streaming) {
              // Append to existing message
              lastMessage.content += event.textDelta;
            } else {
              // Create new message
              messages.push({
                role: 'assistant',
                content: event.textDelta,
                timestamp: new Date().toISOString(),
                streaming: true
              });
            }
            lastChunkRef.current = event.textDelta;
            
            return { ...prev, messages };
          });
          break;
          
        case 'tool-call':
          setState(prev => {
            const toolCall = {
              id: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
              state: 'executing',
              timestamp: new Date().toISOString()
            };
            
            return {
              ...prev,
              toolCalls: [...prev.toolCalls, toolCall]
            };
          });
          break;
          
        case 'tool-result':
          setState(prev => ({
            ...prev,
            toolCalls: prev.toolCalls.map(tc =>
              tc.id === event.toolCallId
                ? { ...tc, state: 'complete', result: event.result }
                : tc
            )
          }));
          break;
          
        case 'file-edit':
          setState(prev => ({
            ...prev,
            filesEdited: [...prev.filesEdited, event.fileEdit]
          }));
          break;
          
        case 'status':
          setState(prev => ({
            ...prev,
            status: event.status
          }));
          lastChunkRef.current = null;
          break;
          
        case 'finish':
          setState(prev => {
            const messages = [...prev.messages];
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.streaming) {
              delete lastMessage.streaming;
            }
            return {
              ...prev,
              status: 'COMPLETED',
              messages
            };
          });
          lastChunkRef.current = null;
          break;
          
        case 'error':
          setState(prev => ({
            ...prev,
            status: 'ERROR'
          }));
          lastChunkRef.current = null;
          break;
      }
    });
    
    socket.on('error', (error: any) => {
      console.error('Socket.io error:', error);
    });
    
    return () => {
      console.log(`🔌 Disconnecting from agent ${agentId}`);
      socket.emit('unsubscribe-agent', agentId);
      socket.close();
      socketRef.current = null;
    };
  }, [agentId]);
  
  return state;
}
