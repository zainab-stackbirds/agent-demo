// API client for conversation state management

export interface ConversationState {
  messages: any[];
  currentMessageIndex: number;
  status: string;
  isUserMessageInPlaceholder: boolean;
  demoModeActive: boolean;
  input: string;
}

export async function fetchConversationState(): Promise<ConversationState> {
  const response = await fetch('/api/conversation/state');
  if (!response.ok) {
    throw new Error('Failed to fetch conversation state');
  }
  return response.json();
}

export async function updateConversationState(state: ConversationState): Promise<void> {
  const response = await fetch('/api/conversation/state', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update conversation state');
  }
}

export async function clearConversationState(): Promise<void> {
  const response = await fetch('/api/conversation/clear', {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error('Failed to clear conversation state');
  }
}

// Setup SSE connection for real-time updates
export function setupSSEConnection(onUpdate: (data: any) => void): () => void {
  const eventSource = new EventSource('/api/conversation/stream');
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onUpdate(data);
    } catch (error) {
      console.error('Error parsing SSE data:', error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    eventSource.close();
  };
  
  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

