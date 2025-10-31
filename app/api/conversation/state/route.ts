import { NextRequest, NextResponse } from 'next/server';
import { getConversationState, setConversationState, clearConversationState } from '@/lib/state';
import type { ConversationState } from '@/lib/state';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || 'default';
    const state = await getConversationState(userId);

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
    const userId = request.headers.get('X-User-Id') || 'default';
    const body: ConversationState = await request.json();

    await setConversationState(userId, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating conversation state:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation state' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

