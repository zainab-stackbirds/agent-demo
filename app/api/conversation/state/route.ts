import { NextRequest, NextResponse } from 'next/server';
import { getConversationState, setConversationState, clearConversationState } from '@/lib/redis';
import type { ConversationState } from '@/lib/redis';

export async function GET() {
  try {
    const state = await getConversationState();
    
    if (!state) {
      return NextResponse.json({ messages: [], currentMessageIndex: 0, status: 'ready', isUserMessageInPlaceholder: false, demoModeActive: true, input: '' });
    }
    
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching conversation state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation state' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ConversationState = await request.json();
    
    await setConversationState(body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating conversation state:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation state' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearConversationState();
    
    return NextResponse.json({ success: true, message: 'Conversation state cleared' });
  } catch (error) {
    console.error('Error clearing conversation state:', error);
    return NextResponse.json(
      { error: 'Failed to clear conversation state' },
      { status: 500 }
    );
  }
}

