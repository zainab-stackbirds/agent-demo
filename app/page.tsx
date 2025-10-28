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
import { AudioVisualizer } from "@/components/ui/audio-visualizer";
import { AnimatePresence, motion } from "motion/react";

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
  | { type: "voice"; dummyText: string; recordingDuration: number }
  | { type: "link"; text: string; url?: string }

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

// Utility functions for localStorage management
const saveToLocalStorage = (key: string, value: any) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  }
};

const loadFromLocalStorage = (key: string, defaultValue: any = null) => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }
  return defaultValue;
};

const clearConversationStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('stackbirds-conversation');
      localStorage.removeItem('stackbirds-conversation-index');
      localStorage.removeItem('stackbirds-demo-active');
    } catch (error) {
      console.error('Error clearing conversation storage:', error);
    }
  }
};

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

    // Listen to localStorage changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key?.startsWith('stackbirds-')) {
        // Broadcast a storage sync message to trigger state updates
        this.broadcastMessage({
          type: 'SYNC_STATE',
          payload: {
            messages: loadFromLocalStorage('stackbirds-conversation', []),
            currentMessageIndex: loadFromLocalStorage('stackbirds-conversation-index', 0),
            status: 'ready',
            isUserMessageInPlaceholder: false,
            demoModeActive: loadFromLocalStorage('stackbirds-demo-active', true),
            input: ""
          }
        });
      }
    };

    window.addEventListener('message', handlePostMessage);
    window.addEventListener('storage', handleStorageChange);
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
    parts: [{ type: "voice", dummyText: "I need help with lead management.", recordingDuration: 3000 }],
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
        text: "Hi! I'm the **Sales Agent**, pre-trained for sales and lead management, so I will first need to understand your business and then understand your sales workflows. Tell me about your business. Do you have a website, facebook, instagram or google business profile?"
      },
    ],
  },
  {
    id: "msg-4",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "Yes, you can visit  www.sallypilatesstudio.com",
        recordingDuration: 4000
      },
    ],
  },
  {
    id: "msg-5",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Got it. I have recorded your business details and I will share this with other agents when you need help with other roles. Ok, let's continue. Where do you manage your leads?"
      }
    ]
  },
  {
    id: "msg-6",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "I manage my leads on thumbtack",
        recordingDuration: 4000
      },
    ],
  },
  {
    id: "msg-6",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "I will need access to Thumbtack. Lets get that going."
      },
    ],
  },
  {
    id: "msg-7",
    role: "ai-agent",
    parts: [
      {
        type: "link",
        text: "Connect to Thumbtack",
        url: "https://thumbtack.com",
      },
    ],
  },

  //   {
  //   id: "msg-6",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "Give me a few seconds, let me review your thumbtack setup. "
  //     },
  //   ],
  // },
  {
    id: "msg-10",
    role: "user",
    parts: [{ type: "voice", dummyText: "Yes. Feel free to use this. I want you to respond immediately to a lead when it comes in. Timing matters so I want to get to the customer, before someone else does", recordingDuration: 2000 }],
  },
  {
    id: "msg-11",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Great, now lets go to Openphone"
      },
    ],
  },
  {
    id: "msg-7",
    role: "ai-agent",
    parts: [
      {
        type: "link",
        text: "Connect to OpenPhone",
        url: "https://openphone.com",
      },
    ],
  },
  {
    id: "msg-14",
    role: "user",
    parts: [{ type: "voice", dummyText: "Thats all I do and then wait to get response. At this point you can let me handle it. ", recordingDuration: 2000 }],
  },
  {
    id: "msg-11",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Great. To summarize:"
      },
    ],
  },
  {
    id: "msg-11",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "You first go to Thumbtack. Then you msg leads with your template You then switch to Openphone. Then you create contact and send them the template. "
      },
    ],
  },
  {
    id: "msg-11",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "I will now manage your lead responses and update you. Where would you like to be updated? I will be recording my tasks in Stackbirds, but I can ping you if you want? "
      },
    ],
  },
  {
    id: "msg-12",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "Ok great, just send me a text when you respond. ",
        recordingDuration: 4000
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
        text: "Ok got it. Stackbirds Sales Agent is ready to go "
      },
    ],
  },
  // {
  //   id: "msg-14",
  //   role: "user",
  //   parts: [{ type: "voice", dummyText: "Awesome!", recordingDuration: 2000 }],
  // },
  // {
  //   id: "msg-15",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "What if I don't find a matching menu? Do you have a default?"
  //     },
  //   ],
  // },
  // {
  //   id: "msg-16",
  //   role: "user",
  //   parts: [
  //     {
  //       type: "voice",
  //       dummyText: "I always create custom. You can ask me if you don't find one.",
  //       recordingDuration: 3000
  //     },
  //   ],
  // },
  // {
  //   id: "msg-17",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "Got it! And lastly, how do you keep track of responses?"
  //     },
  //   ],
  // },
  // {
  //   id: "msg-18",
  //   role: "user",
  //   parts: [
  //     {
  //       type: "voice",
  //       dummyText: "Right now I don't do anything, but I know I need a process.",
  //       recordingDuration: 3000
  //     },
  //   ],
  // },
  // {
  //   id: "msg-19",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "reasoning",
  //       text: "Opportunity identified: User lacks lead tracking. Solution: Create automated tracker in Google Sheets with daily updates."
  //     },
  //     {
  //       type: "text",
  //       text: "Okay, great! I'm going to **create a spreadsheet** for us to track responses from leads. I'll update it after every message and at the end of every day. You can ask me for status anytime. Sound good?"
  //     },
  //   ],
  // },
  // {
  //   id: "msg-20",
  //   role: "user",
  //   parts: [{ type: "voice", dummyText: "Oh that's really nice!", recordingDuration: 2000 }],
  // },
  // {
  //   id: "msg-21",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "Should I review your previous messages to leads and add them to the tracker?"
  //     },
  //   ],
  // },
  // {
  //   id: "msg-22",
  //   role: "user",
  //   parts: [{ type: "voice", dummyText: "No, let's start fresh.", recordingDuration: 2000 }],
  // },
  // {
  //   id: "msg-23",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "reasoning",
  //       text: "Training complete. Agent configuration: Thumbtack lead source, OpenPhone integration, Google Sheets menu lookup, automated tracker. Ready for deployment."
  //     },
  //     {
  //       type: "text",
  //       text: "Perfect! I'm now creating your **custom Sales Agent**. Here's what I'll do:\n\n**Task**: Lead Gen Connect\n- **Apps**: Thumbtack, OpenPhone, Google Sheets\n- **Workflow**: Find leads → Create contact → Send customized template → Track responses\n- **Rules**: Never exceed budget, always confirm proposals, update tracker daily\n\nLet's gooooo! 🚀"
  //     },
  //   ],
  // },
  // {
  //   id: "msg-24",
  //   role: "assistant",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "Your **Sales Agent** is now live! You can deploy it, review its configuration, or continue training. What would you like to do next?"
  //     },
  //   ],
  // },
];

// Helper function to render text with clickable links
const TextWithLinks = ({ text }: { text: string }) => {
  // Regex to detect URLs in text
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;

  const parts = text.split(urlRegex);
  const matches = text.match(urlRegex);

  if (!matches) {
    return <Response>{text}</Response>;
  }

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (matches.includes(part)) {
          // Ensure URL has protocol
          const url = part.startsWith('http') ? part : `https://${part}`;
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

const ChatBotDemo = () => {
  const [input, setInput] = useState("");

  // Initialize state from localStorage
  const [messages, setMessages] = useState<CustomUIMessage[]>(() =>
    loadFromLocalStorage('stackbirds-conversation', [])
  );
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(() =>
    loadFromLocalStorage('stackbirds-conversation-index', 0)
  );
  const [isUserMessageInPlaceholder, setIsUserMessageInPlaceholder] = useState(false);
  const [demoModeActive, setDemoModeActive] = useState(() =>
    loadFromLocalStorage('stackbirds-demo-active', true)
  );

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize simple broadcast sync (non-hook based to avoid typing interference)
  const [broadcastInstance] = useState(() => getBroadcastSync());
  const updateSourceRef = useRef<string>('self'); // Track if update came from broadcast

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage('stackbirds-conversation', messages);
  }, [messages]);

  useEffect(() => {
    saveToLocalStorage('stackbirds-conversation-index', currentMessageIndex);
  }, [currentMessageIndex]);

  useEffect(() => {
    saveToLocalStorage('stackbirds-demo-active', demoModeActive);
  }, [demoModeActive]);

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

  const handleStartRecording = async () => {
    if (!demoModeActive || currentMessageIndex >= mockConversation.length) return;

    const currentMessage = mockConversation[currentMessageIndex];
    if (currentMessage.role !== "user") return;

    const voicePart = currentMessage.parts.find(part => part.type === "voice");
    if (!voicePart || voicePart.type !== "voice") return;

    try {
      // Get mock audio stream (we'll use a real microphone for visualization)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setIsRecording(true);

      // Recording will continue until user clicks the cross button
      // No auto-stop timer - demo presenter is in control
    } catch (error) {
      console.error("Error accessing microphone:", error);
      // If microphone access fails, just show the mic button again
      setIsRecording(false);
    }
  };

  const handleStopRecording = (transcribedText: string) => {
    // Stop the recording
    setIsRecording(false);

    // Stop all tracks in the media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }

    // Clear the timer
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Add the transcribed message
    const userMessage: CustomUIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: transcribedText }],
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
  };

  const handleCrossButtonClick = () => {
    if (!isRecording || currentMessageIndex >= mockConversation.length) return;

    const currentMessage = mockConversation[currentMessageIndex];
    const voicePart = currentMessage.parts.find(part => part.type === "voice");
    if (!voicePart || voicePart.type !== "voice") return;

    // Add a natural delay between 50-100ms
    const delay = Math.random() * 200 + 200; // Random delay between 50-100ms

    setTimeout(() => {
      handleStopRecording(voicePart.dummyText);
    }, delay);
  };

  // Check if current message is a voice message and if we should show input
  const currentMessage = mockConversation[currentMessageIndex];
  const isVoiceMessage = currentMessage?.role === "user" &&
    currentMessage.parts.some(part => part.type === "voice");
  const shouldShowInput = currentMessage?.role === "user" && !isRecording;

  // Show mic icon when waiting for user input, when recording, or when waiting for assistant response
  const showMicSection = isVoiceMessage || isRecording ||
    (currentMessage?.role === "assistant" || currentMessage?.role === "ai-agent");

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4 max-w-md px-6">
                  <div className="text-4xl mb-6">🎙️</div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    StackBirds
                  </h2>
                  <p className="text-muted-foreground">
                    Speak and, There will be an AI-agent
                  </p>
                </div>
              </div>
            )}
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
                              <TextWithLinks text={part.text} />
                            </MessageContent>
                          </Message>
                        </Fragment>
                      );
                    case "link":
                      return (
                        <div
                          key={`${message.id}-${i}`}
                          className="flex justify-start mb-4"
                        >
                          <a
                            href={part.url || `https://${part.text}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                          >
                            {part.text}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="ml-2"
                            >
                              <path d="M7 7h10v10" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </a>
                        </div>
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

        {showMicSection && (
          // Voice message mode - show mic button or audio visualizer in same location
          <div className="mt-4 relative">
            <AnimatePresence mode="wait">
              {!isRecording ? (
                // Show mic button with fade animation
                <motion.div
                  key="mic-button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex items-center justify-center"
                >
                  <button
                    onClick={handleStartRecording}
                    disabled={!shouldShowInput || status === "streaming"}
                    className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    aria-label="Start recording"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </button>
                </motion.div>
              ) : (
                // Show audio visualizer with cross button
                <motion.div
                  key="audio-visualizer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 h-32">
                    <AudioVisualizer
                      stream={mediaStream}
                      isRecording={isRecording}
                      onClick={() => { }}
                    />
                  </div>
                  <button
                    onClick={handleCrossButtonClick}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                    aria-label="Send voice message"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBotDemo;
