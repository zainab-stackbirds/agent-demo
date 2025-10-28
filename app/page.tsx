"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Fragment, useEffect, useState, useCallback, useRef } from "react";
import { Response } from "@/components/ai-elements/response";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { SystemEvent } from "@/components/ai-elements/system-event";
import type { UIMessage, ChatStatus } from "ai";
import { nanoid } from "nanoid";

type CustomUIMessage = Omit<UIMessage, 'role' | 'parts'> & {
  role: "assistant" | "user" | "ai-agent";
  parts: MessagePart[];
};

// Update your types
type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string; state?: "done" }
  | { type: "source-url"; url: string }
  | { type: "system-event"; event: "agent-joined" | "agent-left" | "task-created"; metadata?: Record<string, any> }

// Broadcast Channel types for cross-tab synchronization
type BroadcastMessage = {
  type: 'SYNC_STATE';
  payload: {
    messages: CustomUIMessage[];
    currentMessageIndex: number;
    status: ChatStatus;
    isUserMessageInPlaceholder: boolean;
    demoModeActive: boolean;
    input: string;
  };
} | {
  type: 'USER_MESSAGE_SUBMITTED';
  payload: {
    message: CustomUIMessage;
    newIndex: number;
  };
} | {
  type: 'DEMO_PROGRESS';
  payload: {
    newIndex: number;
    newMessage?: CustomUIMessage;
    status: ChatStatus;
    isUserMessageInPlaceholder: boolean;
  };
}

// Simple broadcast utility - avoiding hooks to prevent re-render issues
class BroadcastSync {
  private channel: BroadcastChannel | null = null;
  private isInIframe: boolean = false;
  private messageHandlers: ((message: BroadcastMessage) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.channel = new BroadcastChannel('stackbirds-chat-sync');
      this.isInIframe = window !== window.top;
      this.setupListeners();
    }
  }

  private setupListeners() {
    if (this.channel) {
      this.channel.addEventListener('message', (event: MessageEvent<BroadcastMessage>) => {
        this.messageHandlers.forEach(handler => handler(event.data));
      });
    }

    // Listen to PostMessage events (from iframes or to iframes)
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'stackbirds-iframe') {
        const { source, ...messageData } = event.data;
        this.messageHandlers.forEach(handler => handler(messageData as BroadcastMessage));
      }
    };

    window.addEventListener('message', handlePostMessage);
  }

  addMessageListener(handler: (message: BroadcastMessage) => void) {
    this.messageHandlers.push(handler);

    // Return cleanup function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  broadcastMessage(message: BroadcastMessage) {
    // Broadcast via BroadcastChannel
    if (this.channel) {
      this.channel.postMessage(message);
    }

    // If in iframe, also send to parent window
    if (this.isInIframe && window.parent) {
      window.parent.postMessage({
        ...message,
        source: 'stackbirds-iframe'
      }, '*');
    }
  }

  cleanup() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.messageHandlers = [];
  }
}

// Create a singleton instance
let broadcastSync: BroadcastSync | null = null;
const getBroadcastSync = () => {
  if (!broadcastSync && typeof window !== 'undefined') {
    broadcastSync = new BroadcastSync();
  }
  return broadcastSync;
};

const mockConversation: CustomUIMessage[] = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "I need help with lead management." }],
  },
  {
    id: "msg-2",
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        text: "Analyzing user's request... Determining best agent for lead management workflows. Sales agent is optimal for this task.",
        state: "done",
      },
      {
        type: "text",
        text: "Got it! Based on your need, I'm invoking our **Sales Agent** who specializes in lead management. Let me hand this over..."
      },
    ],
  },
  {
    id: "msg-2b",
    role: "assistant", // Role doesn't matter for system events, but keep it for type safety
    parts: [
      {
        type: "system-event",
        event: "agent-joined",
        metadata: { agentName: "Sales Agent" }
      },
    ],
  },
  {
    id: "msg-3",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Hi! I'm the **Sales Agent**, pre-trained for sales and lead management. To customize my approach to *your* business, I need to ask a few questions. Ready? Let's get started! 🚀"
      },
    ],
  },
  {
    id: "msg-4",
    role: "ai-agent",
    parts: [
      { type: "text", text: "First, where do you find your leads?" },
    ],
  },
  {
    id: "msg-5",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Great! Let me walk you through Thumbtack. I login, open my leads tab, check for new leads, and never exceed my budget. When I find a lead, I pull my template and follow up via my business line."
      },
    ],
  },
  {
    id: "msg-6",
    role: "ai-agent",
    parts: [
      {
        type: "reasoning",
        text: "Extracting key workflow: Lead source = Thumbtack. Budget constraint = Never exceed. Follow-up = Business line template."
      },
      {
        type: "text",
        text: "Got it! To summarize:\n- You find leads on **Thumbtack**\n- Never pass your set budget\n- Always redirect clients to your **business line**\n\nIs this correct?"
      },
    ],
  },
  {
    id: "msg-7",
    role: "user",
    parts: [{ type: "text", text: "Correct!" }],
  },
  {
    id: "msg-8",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Then I go to OpenPhone (via browser extension), copy the phone number from Thumbtack, create a contact, and send my first message using a template. I modify it for the client's request—name, allergens, menu, etc."
      },
    ],
  },
  {
    id: "msg-9",
    role: "ai-agent",
    parts: [
      {
        type: "reasoning",
        text: "Workflow step 2: Create OpenPhone contact → Use template → Customize (name, allergens, menu)."
      },
      {
        type: "text",
        text: "Got it! So you:\n1. Create a new contact in **OpenPhone**\n2. Send the first message via a **template**\n3. Customize it (name, allergens, menu)\n\nCorrect?"
      },
    ],
  },
  {
    id: "msg-10",
    role: "user",
    parts: [{ type: "text", text: "Correct." }],
  },
  {
    id: "msg-11",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Okay, how do you know what proposal/menu to use? Can you show me?"
      },
    ],
  },
  {
    id: "msg-12",
    role: "user",
    parts: [
      {
        type: "text",
        text: "I go to Google Sheets, pull up my menus, and find the closest match based on event type. I adjust dishes for allergens if needed."
      },
    ],
  },
  {
    id: "msg-13",
    role: "ai-agent",
    parts: [
      {
        type: "reasoning",
        text: "Proposal logic: Fetch menus from Google Sheets → Match by event type → Adjust for allergens. Requires user confirmation before sending."
      },
      {
        type: "text",
        text: "Perfect! Your proposals are based on **existing menus in Google Sheets**. Before I send any message to a client, I'll **always check with you** if it's good to go. Sound right?"
      },
    ],
  },
  {
    id: "msg-14",
    role: "user",
    parts: [{ type: "text", text: "Awesome!" }],
  },
  {
    id: "msg-15",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "What if I don't find a matching menu? Do you have a default?"
      },
    ],
  },
  {
    id: "msg-16",
    role: "user",
    parts: [
      {
        type: "text",
        text: "I always create custom. You can ask me if you don't find one."
      },
    ],
  },
  {
    id: "msg-17",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Got it! And lastly, how do you keep track of responses?"
      },
    ],
  },
  {
    id: "msg-18",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Right now I don't do anything, but I know I need a process."
      },
    ],
  },
  {
    id: "msg-19",
    role: "ai-agent",
    parts: [
      {
        type: "reasoning",
        text: "Opportunity identified: User lacks lead tracking. Solution: Create automated tracker in Google Sheets with daily updates."
      },
      {
        type: "text",
        text: "Okay, great! I'm going to **create a spreadsheet** for us to track responses from leads. I'll update it after every message and at the end of every day. You can ask me for status anytime. Sound good?"
      },
    ],
  },
  {
    id: "msg-20",
    role: "user",
    parts: [{ type: "text", text: "Oh that's really nice!" }],
  },
  {
    id: "msg-21",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Should I review your previous messages to leads and add them to the tracker?"
      },
    ],
  },
  {
    id: "msg-22",
    role: "user",
    parts: [{ type: "text", text: "No, let's start fresh." }],
  },
  {
    id: "msg-23",
    role: "ai-agent",
    parts: [
      {
        type: "reasoning",
        text: "Training complete. Agent configuration: Thumbtack lead source, OpenPhone integration, Google Sheets menu lookup, automated tracker. Ready for deployment."
      },
      {
        type: "text",
        text: "Perfect! I'm now creating your **custom Sales Agent**. Here's what I'll do:\n\n**Task**: Lead Gen Connect\n- **Apps**: Thumbtack, OpenPhone, Google Sheets\n- **Workflow**: Find leads → Create contact → Send customized template → Track responses\n- **Rules**: Never exceed budget, always confirm proposals, update tracker daily\n\nLet's gooooo! 🚀"
      },
    ],
  },
  {
    id: "msg-24",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Your **Sales Agent** is now live! You can deploy it, review its configuration, or continue training. What would you like to do next?"
      },
    ],
  },
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<CustomUIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isUserMessageInPlaceholder, setIsUserMessageInPlaceholder] = useState(false);
  const [demoModeActive, setDemoModeActive] = useState(true);

  // Initialize simple broadcast sync (non-hook based to avoid typing interference)
  const [broadcastInstance] = useState(() => getBroadcastSync());
  const updateSourceRef = useRef<string>('self'); // Track if update came from broadcast

  useEffect(() => {
    if (!demoModeActive || currentMessageIndex >= mockConversation.length) return;

    const currentMessage = mockConversation[currentMessageIndex];

    if (currentMessage.role === "user") {
      // Show user message as placeholder - wait for manual input
      setInput(""); // Clear input
      setIsUserMessageInPlaceholder(true);

      // Broadcast the waiting state
      if (updateSourceRef.current === 'self' && broadcastInstance) {
        broadcastInstance.broadcastMessage({
          type: 'DEMO_PROGRESS',
          payload: {
            newIndex: currentMessageIndex,
            status: "ready",
            isUserMessageInPlaceholder: true
          }
        });
      }
      // Don't auto-progress - wait for user to send manually
    } else {
      // AI message - first show thinking state
      setStatus("streaming");

      // Broadcast streaming state
      if (updateSourceRef.current === 'self' && broadcastInstance) {
        broadcastInstance.broadcastMessage({
          type: 'DEMO_PROGRESS',
          payload: {
            newIndex: currentMessageIndex,
            status: "streaming",
            isUserMessageInPlaceholder: false
          }
        });
      }

      const thinkingTimer = setTimeout(() => {
        const newIndex = currentMessageIndex + 1;
        setStatus("ready");
        setMessages(prev => [...prev, currentMessage]);
        setCurrentMessageIndex(newIndex);

        // Broadcast the completed message
        if (updateSourceRef.current === 'self' && broadcastInstance) {
          broadcastInstance.broadcastMessage({
            type: 'DEMO_PROGRESS',
            payload: {
              newIndex,
              newMessage: currentMessage,
              status: "ready",
              isUserMessageInPlaceholder: false
            }
          });
        }
      }, 3000);
      return () => clearTimeout(thinkingTimer);
    }
  }, [currentMessageIndex, demoModeActive]);

  // Start demo mode on mount
  useEffect(() => {
    if (demoModeActive && mockConversation.length > 0) {
      const firstMessage = mockConversation[0];
      if (firstMessage.role === "user") {
        setInput(""); // Clear input initially
        setIsUserMessageInPlaceholder(true);
      }
    }

    // Broadcast instance is automatically initialized when created
  }, [demoModeActive]);

  // Handle broadcast messages from other tabs/iframes
  useEffect(() => {
    if (!broadcastInstance) return;

    const messageCleanup = broadcastInstance.addMessageListener((message: BroadcastMessage) => {
      updateSourceRef.current = 'broadcast';

      switch (message.type) {
        case 'SYNC_STATE':
          const { payload } = message;
          setMessages(payload.messages);
          setCurrentMessageIndex(payload.currentMessageIndex);
          setStatus(payload.status);
          setIsUserMessageInPlaceholder(payload.isUserMessageInPlaceholder);
          setDemoModeActive(payload.demoModeActive);
          break;

        case 'USER_MESSAGE_SUBMITTED':
          setMessages(prev => [...prev, message.payload.message]);
          setCurrentMessageIndex(message.payload.newIndex);
          setIsUserMessageInPlaceholder(false);
          setInput("");
          break;

        case 'DEMO_PROGRESS':
          setCurrentMessageIndex(message.payload.newIndex);
          setStatus(message.payload.status);
          setIsUserMessageInPlaceholder(message.payload.isUserMessageInPlaceholder);
          if (message.payload.newMessage) {
            setMessages(prev => [...prev, message.payload.newMessage!]);
          }
          break;
      }

      setTimeout(() => {
        updateSourceRef.current = 'self';
      }, 100);
    });

    return () => {
      if (messageCleanup) {
        messageCleanup();
      }
    };
  }, [broadcastInstance]);

  // Broadcast state changes when they come from this tab (not from broadcast)
  useEffect(() => {
    if (updateSourceRef.current === 'self' && broadcastInstance) {
      broadcastInstance.broadcastMessage({
        type: 'SYNC_STATE',
        payload: {
          messages,
          currentMessageIndex,
          status,
          isUserMessageInPlaceholder,
          demoModeActive,
          input: "" // Don't sync input to avoid typing interference
        }
      });
    }
  }, [messages, currentMessageIndex, status, isUserMessageInPlaceholder, demoModeActive, broadcastInstance]);

  const handleSubmit = (message: PromptInputMessage) => {
    if (!demoModeActive || currentMessageIndex >= mockConversation.length) return;

    const currentMessage = mockConversation[currentMessageIndex];

    // Only process if we're waiting for a user message
    if (currentMessage.role === "user" && isUserMessageInPlaceholder) {
      // Add the user's actual input as a message
      const userMessage: CustomUIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: message.text || "" }],
      };

      const newIndex = currentMessageIndex + 1;

      setIsUserMessageInPlaceholder(false);
      setMessages(prev => [...prev, userMessage]);
      setCurrentMessageIndex(newIndex);
      setInput(""); // Clear input 

      // Broadcast the user message submission
      if (updateSourceRef.current === 'self' && broadcastInstance) {
        broadcastInstance.broadcastMessage({
          type: 'USER_MESSAGE_SUBMITTED',
          payload: { message: userMessage, newIndex }
        });
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>

                {message.parts
                  .filter((part) => part.type === "system-event")
                  .map((part, i) => (
                    <SystemEvent
                      key={`${message.id}-event-${i}`}
                      event={part.event}
                      agentName={part.metadata?.agentName}
                      metadata={part.metadata}
                    />
                  ))}

                {message.role === "assistant" &&
                  message.parts.filter(
                    (part) => part.type === "source-url"
                  ).length > 0 && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter(
                            (part) =>
                              part.type ===
                              "source-url"
                          ).length
                        }
                      />
                      {message.parts
                        .filter(
                          (part) =>
                            part.type ===
                            "source-url"
                        )
                        .map((part, i) => (
                          <SourcesContent
                            key={`${message.id}-${i}`}
                          >
                            <Source
                              key={`${message.id}-${i}`}
                              href={part.url}
                              title={part.url}
                            />
                          </SourcesContent>
                        ))}
                    </Sources>
                  )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Fragment
                          key={`${message.id}-${i}`}
                        >
                          <Message
                            from={message.role}
                          >
                            <MessageContent>
                              <Response>
                                {part.text}
                              </Response>
                            </MessageContent>
                          </Message>
                        </Fragment>
                      );
                    case "reasoning":
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={
                            status ===
                            "streaming"
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {part.text}
                          </ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          onSubmit={handleSubmit}
          className="mt-4"
          globalDrop
          multiple
        >
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder={
                isUserMessageInPlaceholder && currentMessageIndex < mockConversation.length
                  ? mockConversation[currentMessageIndex].parts
                    .filter(part => part.type === "text")
                    .map(part => part.text)
                    .join(" ")
                  : "Ask me anything..."
              }
            />
          </PromptInputBody>
          <PromptInputFooter className="flex justify-end">
            <PromptInputSubmit
              disabled={!input || isUserMessageInPlaceholder || status === "streaming"}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
