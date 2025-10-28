import { NextRequest } from 'next/server';
import { getSubscriberRedis, getConversationState } from '@/lib/redis';

export async function GET(request: NextRequest) {
  // Create a ReadableStream for SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      
      const send = (data: string) => {
        if (isClosed) return;
        try {
          const message = `data: ${data}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('Error sending SSE data:', error);
          isClosed = true;
        }
      };

      try {
        const subscriberRedis = getSubscriberRedis();
        
        // Subscribe to conversation updates
        await subscriberRedis.subscribe('conversation:updates');
        
        // Send initial state
        const initialState = await getConversationState();
        send(JSON.stringify({ type: 'initial', data: initialState }));
        
        // Listen for updates
        subscriberRedis.on('message', (channel, message) => {
          if (channel === 'conversation:updates') {
            send(message);
          }
        });
        
        // Cleanup on client disconnect
        request.signal.addEventListener('abort', async () => {
          isClosed = true;
          try {
            await subscriberRedis.unsubscribe('conversation:updates');
            if (!controller.desiredSize) {
              controller.close();
            }
          } catch (error) {
            console.error('Error cleaning up SSE:', error);
          }
        });
      } catch (error) {
        console.error('Error in SSE stream:', error);
        if (!isClosed) {
          send(JSON.stringify({ type: 'error', data: { message: 'Stream error' } }));
          controller.close();
          isClosed = true;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

