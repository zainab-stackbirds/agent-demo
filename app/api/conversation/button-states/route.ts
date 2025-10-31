import { NextRequest, NextResponse } from 'next/server';
import { getButtonStates, setButtonStates, updateButtonState, clearButtonStates } from '@/lib/state';
import type { ButtonStates } from '@/lib/state';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || 'default';
    const states = await getButtonStates(userId);

    if (!states) {
      // Return default button states
      return NextResponse.json({
        isConnectOpenPhoneClicked: false,
        isConnectThumbtackClicked: false,
        agentRecordingState: 'not_started'
      });
    }

    return NextResponse.json(states);
  } catch (error) {
    console.error('Error fetching button states:', error);
    return NextResponse.json(
      { error: 'Failed to fetch button states' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || 'default';
    const body: ButtonStates = await request.json();

    await setButtonStates(userId, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating button states:', error);
    return NextResponse.json(
      { error: 'Failed to update button states' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || 'default';
    const body: Partial<ButtonStates> = await request.json();

    console.log('[PATCH /api/conversation/button-states] Updating button states for user:', userId, 'body:', body);
    await updateButtonState(userId, body);
    console.log('[PATCH /api/conversation/button-states] Successfully updated button states');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error partially updating button states:', error);
    return NextResponse.json(
      { error: 'Failed to partially update button states' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-Id') || 'default';
    await clearButtonStates(userId);

    return NextResponse.json({ success: true, message: 'Button states cleared' });
  } catch (error) {
    console.error('Error clearing button states:', error);
    return NextResponse.json(
      { error: 'Failed to clear button states' },
      { status: 500 }
    );
  }
}

