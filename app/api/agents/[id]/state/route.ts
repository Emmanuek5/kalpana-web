import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Update agent state (called by container for batched updates)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agentId = (await params).id;
    const { conversationHistory, toolCalls, filesEdited } = await req.json();
    
    // Retry logic for write conflicts/deadlocks
    let retries = 3;
    let lastError: any;
    
    while (retries > 0) {
      try {
        // Check if agent exists first
        const agent = await prisma.agent.findUnique({
          where: { id: agentId },
          select: { id: true, status: true }
        });
        
        if (!agent) {
          console.warn(`⚠️ Agent ${agentId} not found, ignoring state update`);
          return NextResponse.json({ 
            success: false, 
            message: 'Agent not found' 
          }, { status: 404 });
        }
        
        // Update agent in database
        await prisma.agent.update({
          where: { id: agentId },
          data: {
            conversationHistory: JSON.stringify(conversationHistory),
            toolCalls: JSON.stringify(toolCalls),
            filesEdited: JSON.stringify(filesEdited),
            lastMessageAt: new Date()
          }
        });
        
        return NextResponse.json({ success: true });
      } catch (error: any) {
        lastError = error;
        
        // Agent was deleted between check and update (P2025)
        if (error.code === 'P2025') {
          console.warn(`⚠️ Agent ${agentId} was deleted, ignoring state update`);
          return NextResponse.json({ 
            success: false, 
            message: 'Agent was deleted' 
          }, { status: 404 });
        }
        
        // Retry on write conflict or deadlock (P2034)
        if (error.code === 'P2034' && retries > 1) {
          console.warn(`⚠️ Write conflict for agent ${agentId}, retrying... (${retries - 1} attempts left)`);
          retries--;
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
          continue;
        }
        
        // Not a retryable error or out of retries
        throw error;
      }
    }
    
    throw lastError;
  } catch (error: any) {
    console.error('Error updating agent state:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update agent state' },
      { status: 500 }
    );
  }
}
