import { EventEmitter } from 'events';

export interface ButtonStates {
  isConnectOpenPhoneClicked: boolean;
  isConnectThumbtackClicked: boolean;
  agentRecordingState: 'recording' | 'paused' | 'idle' | 'not_started';
}

export interface AppStatus {
  app_id: string;
  enabled: boolean;
  connecting?: boolean;
}

export interface ConversationState {
  messages: any[];
  currentMessageIndex: number;
  status: string;
  isUserMessageInPlaceholder: boolean;
  demoModeActive: boolean;
  input: string;
  buttonStates?: ButtonStates;
  appStatuses?: AppStatus[];
}

const conversationStateByUser = new Map<string, ConversationState>();
const buttonStatesByUser = new Map<string, ButtonStates>();

const userEmitters = new Map<string, EventEmitter>();

function getUserEmitter(userId: string): EventEmitter {
  let emitter = userEmitters.get(userId);
  if (!emitter) {
    emitter = new EventEmitter();
    // Prevent potential memory leak warnings for multiple listeners per user
    emitter.setMaxListeners(1000);
    userEmitters.set(userId, emitter);
  }
  return emitter;
}

function publish(userId: string, payload: unknown): void {
  const emitter = getUserEmitter(userId);
  try {
    const message = JSON.stringify(payload);
    emitter.emit('message', message);
  } catch (err) {
    console.error('Failed to publish state update:', err);
  }
}

export async function getConversationState(userId: string): Promise<ConversationState | null> {
  return conversationStateByUser.get(userId) ?? null;
}

export async function setConversationState(userId: string, state: ConversationState): Promise<void> {
  conversationStateByUser.set(userId, state);
  publish(userId, { type: 'state_update', data: state });
}

export async function clearConversationState(userId: string): Promise<void> {
  conversationStateByUser.delete(userId);
  publish(userId, { type: 'clear', data: null });
}

export async function getButtonStates(userId: string): Promise<ButtonStates | null> {
  return buttonStatesByUser.get(userId) ?? null;
}

export async function setButtonStates(userId: string, states: ButtonStates): Promise<void> {
  buttonStatesByUser.set(userId, states);
  publish(userId, { type: 'button_states_update', data: states });
}

export async function updateButtonState(userId: string, partialState: Partial<ButtonStates>): Promise<void> {
  const current = buttonStatesByUser.get(userId) ?? {
    isConnectOpenPhoneClicked: false,
    isConnectThumbtackClicked: false,
    agentRecordingState: 'not_started',
  };
  const next: ButtonStates = { ...current, ...partialState };
  await setButtonStates(userId, next);
}

export async function clearButtonStates(userId: string): Promise<void> {
  buttonStatesByUser.delete(userId);
  publish(userId, { type: 'button_states_clear', data: null });
}

// Subscription API for SSE consumers
export function subscribeToUserChannel(
  userId: string,
  onMessage: (message: string) => void
): () => void {
  const emitter = getUserEmitter(userId);
  const handler = (message: string) => onMessage(message);
  emitter.on('message', handler);
  return () => {
    emitter.off('message', handler);
  };
}


