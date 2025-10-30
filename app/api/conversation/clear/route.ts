import { NextRequest, NextResponse } from 'next/server';
import { clearConversationState } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || 'default';
    await clearConversationState(userId);

    return NextResponse.json({ success: true, message: 'Conversation state cleared' });
  } catch (error) {
    console.error('Error clearing conversation state:', error);
    return NextResponse.json(
      { error: 'Failed to clear conversation state' },
      { status: 500 }
    );
  }
}

