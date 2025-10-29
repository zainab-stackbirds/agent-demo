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
          if (!isClosed) {
            isClosed = true;
            try {
              if (controller.desiredSize !== null) {
                controller.close();
              }
            } catch (closeError) {
              console.error('Error closing controller after send error:', closeError);
            }
          }
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
          if (isClosed) return; // Already cleaned up
          isClosed = true;
          try {
            await subscriberRedis.unsubscribe('conversation:updates');
            // Check if controller is not already closed
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch (error) {
            console.error('Error cleaning up SSE:', error);
          }
        });
      } catch (error) {
        console.error('Error in SSE stream:', error);
        if (!isClosed) {
          isClosed = true;
          try {
            send(JSON.stringify({ type: 'error', data: { message: 'Stream error' } }));
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch (closeError) {
            console.error('Error closing controller in error handler:', closeError);
          }
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

