// API client for conversation state management

// Generate or retrieve user ID from localStorage
function getUserId(): string {
  return "some_cool_dude"
  // if (typeof window === 'undefined') return '';

  // const USER_ID_KEY = 'stackbirds_user_id';
  // let userId = localStorage.getItem(USER_ID_KEY);

  // if (!userId) {
  //   // Generate 6 random letters
  //   userId = Array.from({ length: 6 }, () =>
  //     String.fromCharCode(97 + Math.floor(Math.random() * 26))
  //   ).join('');
  //   localStorage.setItem(USER_ID_KEY, userId);
  // }

  // return userId;
}

export interface ConversationState {
  messages: any[];
  currentMessageIndex: number;
  status: string;
  isUserMessageInPlaceholder: boolean;
  demoModeActive: boolean;
  input: string;
}

export async function fetchConversationState(): Promise<ConversationState> {
  const userId = getUserId();
  const response = await fetch('/api/conversation/state', {
    headers: {
      'X-User-Id': userId,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch conversation state');
  }
  return response.json();
}

export async function updateConversationState(state: ConversationState): Promise<void> {
  const userId = getUserId();
  const response = await fetch('/api/conversation/state', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error('Failed to update conversation state');
  }
}

export async function clearConversationState(): Promise<void> {
  const userId = getUserId();
  const response = await fetch('/api/conversation/clear', {
    method: 'POST',
    headers: {
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to clear conversation state');
  }
}

// Setup SSE connection for real-time updates
export function setupSSEConnection(onUpdate: (data: any) => void): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;

  try {
    const userId = getUserId();
    eventSource = new EventSource(`/api/conversation/stream?userId=${userId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      // SSE errors are common when the endpoint doesn't exist or server is down
      // Silently close the connection instead of logging errors
      if (eventSource && !isClosed) {
        eventSource.close();
        isClosed = true;
      }
    };
  } catch (error) {
    // Failed to create EventSource, silently continue without SSE
    console.debug('SSE not available:', error);
  }

  // Return cleanup function
  return () => {
    if (eventSource && !isClosed) {
      eventSource.close();
      isClosed = true;
    }
  };
}

