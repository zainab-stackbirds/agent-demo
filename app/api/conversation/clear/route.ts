import { NextResponse } from 'next/server';
import { clearConversationState } from '@/lib/redis';

export async function POST() {
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

