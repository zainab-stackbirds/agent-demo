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
import { Fragment, useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { fetchConversationState, updateConversationState, clearConversationState, setupSSEConnection } from "@/lib/api-client";
import { ExtensionSummary } from "@/components/extension/extension-summary";
import { AppIntegrations } from "@/components/extension/app-integrations";

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
  | { type: "open-sidebar" }
  | { type: "summary-added"; heading: string; subheading: string; id:string }
  | { type: "summary-updated"; messages: string[]; id:string }
  | { type: "app-event"; apps: Array<{ app_id: string; enabled: boolean }> }

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

// Utility functions for API state management
const saveToAPI = async (state: any) => {
  try {
    await updateConversationState(state);
  } catch (error) {
    console.error('Error saving to API:', error);
  }
};

const loadFromAPI = async (): Promise<any> => {
  try {
    return await fetchConversationState();
  } catch (error) {
    console.error('Error loading from API:', error);
    // Return default state
    return { 
      messages: [], 
      currentMessageIndex: 0, 
      status: 'ready', 
      isUserMessageInPlaceholder: false, 
      demoModeActive: true, 
      input: '' 
    };
  }
};

const clearConversationStorage = async () => {
  if (typeof window !== 'undefined') {
    try {
      await clearConversationState();
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

    // Listen to localStorage changes from other tabs (legacy support - not used with Redis)
    const handleStorageChange = (event: StorageEvent) => {
      // localStorage sync is no longer used - state is managed via Redis
      // This listener is kept for compatibility but does nothing
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
    id: "msg-3",
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
    id: "msg-4",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Hi! I'm the **Sales Agent**, pre-trained for sales and lead management, so I will first need to understand your business and then understand your sales workflows. Tell me about your business. Do you have a website, facebook, instagram or google business profile?"
      },
    ],
  },
  {
    id: "msg-5",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "Great. I am the founder of Eat Cook Joy. I am a solo entrepreneur and run the business in texas. My goal is to help every chef in the country get help to start and run their business. Our key value prop is helping chefs provide convenience, affordability and personalization all together. My website is www.eatcookjoy.com. Let me know if you need anything else.",
        recordingDuration: 4000
      },
    ],
  },
  {
    id: "msg-6",
    role: "ai-agent",
    parts: [
       {
        type: "reasoning",
        text: "Analyzing business context",
        state: "done",
      },
      {
        type: "text",
        text: "Here is what I understand: \n **Business Name**: Eat Cook Joy \n**Value Prop**: Chef tool providing personalization + convenience + affordability \n **Location**: Texas \n **Services**: Meal Prep, Events \nAm I missing anything?"
      },
    ]
  },
  {
    id: "msg-7",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "No",
        recordingDuration: 4000
      },
    ],
  },
    {
    id: "msg-8",
    role: "ai-agent",
    parts: [
       {
        type: "reasoning",
        text: "Analyzing business context",
        state: "done",
      },
      {
        type: "text",
        text: "Got it. I will store this information and share with your other agents in the future so you don’t have to go through this step again. You can find and update this information anytime from the sidebar."
      },
      // Trigger sidebar when the business context is provided
      { type: "open-sidebar" },
      {
        type: "summary-added",
        heading: "Agent Configuration Summary",
        subheading: "Sales Agent is now learning about your workflow",
        id: "sales_agent_summary"
      },
    ]
  },
    {
    id: "msg-9",
    role: "ai-agent",
    parts: [
      {
        type: "summary-updated",
        messages: ['Business Name: Eat Cook Joy \nValue Prop: Chef tool providing personalization + convenience + affordability \n Location: Texas \nServices: Meal Prep, Events'],
        id: "sales_agent_summary"
      },
    ]
  },
  {
    id: "msg-10",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Alright, can you now walk me through how you manage leads?"
      },
    ],
  },
    {
    id: "msg-11",
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
    id: "msg-12",
    role: "ai-agent",
    parts: [
      {
        type: "app-event",
        apps: [
          { app_id: "thumbtack", enabled: false },
        ]
      },
    ],
  },
  {
    id: "msg-13",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "I will need access to Thumbtack. Lets get that going."
      },
    ],
  },
  {
    id: "msg-14",
    role: "ai-agent",
    parts: [
      {
        type: "link",
        text: "Connect to Thumbtack",
        url: "https://thumbtack.com",
      },
    ],
  },

    {
    id: "msg-15",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Next, lets figure out how you manage leads so I can start supporting you. In as much detail as possible, can you walk me through the steps? "
      },
    ],
  },
  {
    id: "msg-16",
    role: "user",
    parts: [{ type: "voice", dummyText: "Ok so first I got to Thumbtack. and then I go to jobs. This is where I see the leads. I will click on a lead, then send them a template message.", recordingDuration: 2000 }],
  },
  {
    id: "msg-17",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Do you respond to all leads?"
      },
    ],
  },
  {
    id: "msg-18",
    role: "user",
    parts: [{ type: "voice", dummyText: "Yes, I respond to all my leads.", recordingDuration: 2000 }],
  },
  {
    id: "msg-19",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Got it. I will make sure to watch out for incoming leads and send them a templated message. Would you like me to get your approval or just send the message?"
      },
    ],
  },
  {
    id: "msg-20",
    role: "user",
    parts: [{ type: "voice", dummyText: "Get my approval and then we can adjust over time?", recordingDuration: 2000 }],
  },
  {
    id: "msg-21",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Sure. Your preference has been recorded"
      },
    ],
  },
  // {
  //   id: "msg-22",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "link",
  //       text: "Connect to OpenPhone",
  //       url: "https://openphone.com",
  //     },
  //     {
  //       type: "app-event",
  //       apps: [
  //         { app_id: "thumbtack", enabled: true },
  //         { app_id: "openphone", enabled: false },
  //       ]
  //     },
  //   ],
  // },
  // {
  //   id: "msg-23",
  //   role: "user",
  //   parts: [{ type: "voice", dummyText: "Thats all I do and then wait to get response. At this point you can let me handle it. ", recordingDuration: 2000 }],
  // },
  // {
  //   id: "msg-24",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "app-event",
  //       apps: [
  //         { app_id: "thumbtack", enabled: true },
  //         { app_id: "openphone", enabled: true },
  //       ]
  //     },
  //   ],
  // },
  // {
  //   id: "msg-25",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "Great. To summarize:"
  //     },
  //   ],
  // },
  // {
  //   id: "msg-26",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "You first go to Thumbtack. Then you msg leads with your template You then switch to Openphone. Then you create contact and send them the template. "
  //     },
  //   ],
  // },
  // {
  //   id: "msg-27",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "text",
  //       text: "I will now manage your lead responses and update you. Where would you like to be updated? I will be recording my tasks in Stackbirds, but I can ping you if you want? "
  //     },
  //   ],
  // },
  // {
  //   id: "msg-28",
  //   role: "user",
  //   parts: [
  //     {
  //       type: "voice",
  //       dummyText: "Ok great, just send me a text when you respond. ",
  //       recordingDuration: 4000
  //     },
  //   ],
  // },
  // {
  //   id: "msg-29",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "reasoning",
  //       text: "Proposal logic: Fetch menus from Google Sheets → Match by event type → Adjust for allergens. Requires user confirmation before sending."
  //     },
  //     {
  //       type: "text",
  //       text: "Ok got it. Stackbirds Sales Agent is ready to go "
  //     },
  //   ],
  // },
  // {
  //   id: "msg-20a",
  //   role: "ai-agent",
  //   parts: [
  //     {
  //       type: "app-event",
  //       apps: [
  //         { app_id: "thumbtack", enabled: true },
  //         { app_id: "openphone", enabled: true },
  //         { app_id: "google-docs", enabled: true }
  //       ]
  //     },
  //   ],
  // },
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

// Helper function to render text with clickable links and preserve newlines
const TextWithLinks = ({ text }: { text: string }) => {
  // Regex to detect URLs in text
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;

  const parts = text.split(urlRegex);
  const matches = text.match(urlRegex);

  if (!matches) {
    // No URLs found - wrap Response in a div with whitespace-pre-wrap to preserve newlines
    return (
      <div className="whitespace-pre-wrap">
        <Response>{text}</Response>
      </div>
    );
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if running inside extension iframe
  const [isExtension, setIsExtension] = useState(false);
  const [isOnOwnDomain, setIsOnOwnDomain] = useState(false);

  // Summary state for extension view
  const [summaryData, setSummaryData] = useState<{
    heading: string;
    subheading: string;
  } | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const [summaryMessages, setSummaryMessages] = useState<string[]>([])

  // App integrations state
  const [appStatuses, setAppStatuses] = useState<Array<{ app_id: string; enabled: boolean }>>([])
  const [showApps, setShowApps] = useState(false)

  // Initialize state from API
  const [messages, setMessages] = useState<CustomUIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isUserMessageInPlaceholder, setIsUserMessageInPlaceholder] = useState(false);
  const [demoModeActive, setDemoModeActive] = useState(true);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize simple broadcast sync (non-hook based to avoid typing interference)
  const [broadcastInstance] = useState(() => getBroadcastSync());
  const updateSourceRef = useRef<string>('self'); // Track if update came from broadcast

  const appendMessage = useCallback((message: CustomUIMessage) => {
    setMessages(prev => {
      if (prev.some(existing => existing.id === message.id)) {
        return prev;
      }

      return [...prev, message];
    });
  }, [setMessages]);

  // Detect if running inside extension iframe via URL param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isExtensionParam = urlParams.get('isExtension');
      setIsExtension(isExtensionParam === 'true');

      // Check if parent window (where extension is loaded) is on our own domain
      if (isExtensionParam === 'true' && window.parent !== window) {
        try {
          const parentHostname = window.parent.location.hostname;
          const isOwnDomain = parentHostname.includes('localhost') ||
                             parentHostname.includes('agent-demo-pied.vercel.app');
          setIsOnOwnDomain(isOwnDomain);
        } catch (e) {
          // Cross-origin error, means we're on a different domain
          setIsOnOwnDomain(false);
        }
      }
    }
  }, []);

  // Initialize state from API on mount
  useEffect(() => {
    const initializeState = async () => {
      try {
        const state = await loadFromAPI();
        setMessages(state.messages || []);
        setCurrentMessageIndex(state.currentMessageIndex || 0);
        setStatus(state.status || 'ready');
        setIsUserMessageInPlaceholder(state.isUserMessageInPlaceholder || false);
        setDemoModeActive(state.demoModeActive !== undefined ? state.demoModeActive : true);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing state:', error);
        setIsInitialized(true);
      }
    };

    initializeState();
  }, []);

  // Setup SSE connection for real-time updates
  useEffect(() => {
    const cleanup = setupSSEConnection((data) => {
      // Mark that this update came from SSE, not user action
      saveToAPIRef.current = false;
      
      if (data.type === 'state_update') {
        const state = data.data;
        setMessages(state.messages || []);
        setCurrentMessageIndex(state.currentMessageIndex || 0);
        setStatus(state.status || 'ready');
        setIsUserMessageInPlaceholder(state.isUserMessageInPlaceholder || false);
        setDemoModeActive(state.demoModeActive !== undefined ? state.demoModeActive : true);
      } else if (data.type === 'clear') {
        setMessages([]);
        setCurrentMessageIndex(0);
        setStatus('ready');
        setIsUserMessageInPlaceholder(false);
        setDemoModeActive(true);
      }
    });

    return cleanup;
  }, []);

  // Handle clear action from URL query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'clear') {
      clearConversationStorage().then(() => {
        // Remove the query param from URL without reload
        window.history.replaceState({}, '', window.location.pathname);
      });
    }
  }, []);

  // Save state to API only when it changes from user actions (not SSE updates)
  const saveToAPIRef = useRef(false);
  
  useEffect(() => {
    if (!isInitialized) return;
    if (!saveToAPIRef.current) return; // Skip if this update came from SSE
    
    saveToAPI({
      messages,
      currentMessageIndex,
      status,
      isUserMessageInPlaceholder,
      demoModeActive,
      input: ""
    });
    
    // Reset the flag
    saveToAPIRef.current = false;
  }, [messages, currentMessageIndex, status, isUserMessageInPlaceholder, demoModeActive, isInitialized]);

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
      // Mark that this is a state change that should be saved
      saveToAPIRef.current = true;
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
        // Mark that this is a demo progress action - should be saved to API
        saveToAPIRef.current = true;
        
        const newIndex = currentMessageIndex + 1;
        setStatus("ready");
        appendMessage(currentMessage);
        setCurrentMessageIndex(newIndex);

        // Check if message contains open-sidebar action and trigger it
        const hasOpenSidebar = currentMessage.parts.some(part => part.type === "open-sidebar");
        if (hasOpenSidebar) {
          // Send postMessage to current window for content script to receive
          window.postMessage({ action: "openSidebar", source: "stackbirds-app" }, "*");
        }

        // Process summary-added parts
        const summaryAddedPart = currentMessage.parts.find(part => part.type === "summary-added");
        if (summaryAddedPart && summaryAddedPart.type === "summary-added") {
          setSummaryData({
            heading: summaryAddedPart.heading,
            subheading: summaryAddedPart.subheading
          });
          setShowSummary(true);
          setSummaryMessages([]);
        }

        // Process summary-updated parts
        const summaryUpdatedPart = currentMessage.parts.find(part => part.type === "summary-updated");
        if (summaryUpdatedPart && summaryUpdatedPart.type === "summary-updated") {
          setSummaryMessages(prev => [...prev, ...summaryUpdatedPart.messages]);
        }

        // Process app-event parts
        const appEventPart = currentMessage.parts.find(part => part.type === "app-event");
        if (appEventPart && appEventPart.type === "app-event") {
          setAppStatuses(appEventPart.apps);
          setShowApps(true);
        }

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
  }, [currentMessageIndex, demoModeActive, appendMessage]);

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

  // Process existing messages to extract summary and app data
  useEffect(() => {
    if (messages.length === 0) return;

    // Process all messages to find the latest summary and app state
    let latestSummaryData: { heading: string; subheading: string } | null = null;
    let latestSummaryMessages: string[] = [];
    let latestAppStatuses: Array<{ app_id: string; enabled: boolean }> = [];

    messages.forEach(message => {
      message.parts.forEach(part => {
        if (part.type === "summary-added") {
          latestSummaryData = {
            heading: part.heading,
            subheading: part.subheading
          };
          latestSummaryMessages = [];
        } else if (part.type === "summary-updated") {
          latestSummaryMessages = [...latestSummaryMessages, ...part.messages];
        } else if (part.type === "app-event") {
          latestAppStatuses = part.apps;
        }
      });
    });

    // Update state with the latest data
    if (latestSummaryData) {
      setSummaryData(latestSummaryData);
      setShowSummary(true);
      setSummaryMessages(latestSummaryMessages);
    }

    if (latestAppStatuses.length > 0) {
      setAppStatuses(latestAppStatuses);
      setShowApps(true);
    }
  }, [messages]);

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
          appendMessage(message.payload.message);
          setCurrentMessageIndex(message.payload.newIndex);
          setIsUserMessageInPlaceholder(false);
          setInput("");
          break;

        case 'DEMO_PROGRESS':
          setCurrentMessageIndex(message.payload.newIndex);
          setStatus(message.payload.status);
          setIsUserMessageInPlaceholder(message.payload.isUserMessageInPlaceholder);
          if (message.payload.newMessage) {
            appendMessage(message.payload.newMessage);
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
  }, [broadcastInstance, appendMessage]);

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

    // Mark that this is a user action - should be saved to API
    saveToAPIRef.current = true;

    // Add the transcribed message
    const userMessage: CustomUIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: transcribedText }],
    };

    const newIndex = currentMessageIndex + 1;

    setIsUserMessageInPlaceholder(false);
    appendMessage(userMessage);
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
  const isUserTurnToSpeak = shouldShowInput && status !== "streaming";

  // Show mic icon when waiting for user input, when recording, or when waiting for assistant response
  const showMicSection = isVoiceMessage || isRecording ||
    (currentMessage?.role === "assistant" || currentMessage?.role === "ai-agent");

  return (
    <div className={`max-w-4xl mx-auto p-6 relative size-full h-screen ${isExtension && showSummary ? 'flex flex-col' : ''}`}>
      {/* Extension-only content - sticky at top */}
      {isExtension && showSummary && summaryData && (
        <div className="flex-shrink-0 mb-4">
          <ExtensionSummary
            heading={summaryData.heading}
            subheading={summaryData.subheading}
            messages={summaryMessages}
          />
        </div>
      )}

      {/* App Integrations - shown below summary */}
      {isExtension && showApps && appStatuses.length > 0 && (
        <div className="flex-shrink-0 mb-4">
          <AppIntegrations apps={appStatuses} />
        </div>
      )}

      {/* Hide conversation when extension is on localhost/deployed app */}
      {!(isExtension && isOnOwnDomain) && (
        <div className={`flex flex-col ${isExtension && showSummary ? 'flex-1 min-h-0' : 'h-full'}`}>
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
          <div className="flex-shrink-0 mt-4 relative">
            <AnimatePresence mode="wait">
              {!isRecording ? (
                // Show mic button with fade animation
                <motion.div
                  key="mic-button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex items-center justify-center relative"
                >
                  <button
                    onClick={handleStartRecording}
                    disabled={!shouldShowInput || status === "streaming"}
                    className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative z-10"
                    aria-label="Start recording"
                  >
                    <motion.svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="origin-center"
                      animate={isUserTurnToSpeak ? { rotate: [0, -8, 8, -8, 0] } : { rotate: 0 }}
                      transition={isUserTurnToSpeak ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </motion.svg>
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
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-500 transition-all shadow-md hover:shadow-lg border-green-500"
                    aria-label="Send voice message"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default ChatBotDemo;
