"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
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
import { openPhoneConversation } from "@/lib/consts";
import { Workflows } from "@/components/extension/workflows";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type CustomUIMessage = Omit<UIMessage, 'role' | 'parts'> & {
  role: "assistant" | "user" | "ai-agent";
  parts: MessagePart[];
};

// Update your types
type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string; state?: "done" }
  | { type: "source-url"; url: string }
  | { type: "system-event"; event: "agent-joined" | "agent-left" | "task-created" | "agent-switching"; metadata?: Record<string, any> }
  | { type: "voice"; dummyText: string; recordingDuration: number }
  | { type: "link"; text: string; url?: string }
  | { type: "open-sidebar" }
  | { type: "summary-added"; heading: string; subheading: string; id: string }
  | { type: "summary-updated"; messages: string[]; id: string }
  | { type: "app-event"; apps: Array<{ app_id: string; enabled: boolean }> }
  | { type: "options"; options: Array<{ label: string; action: string }> }
  | { type: "button"; text: string; action: string; url?: string }
  | { type: "recording-state"; state: "start" | "pause" | "stop" }
  | { type: "agent-interrupt"; message: string }
  | { type: "new-workflow"; workflow: string; category?: string }

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
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "How can I help you?"
      },
      {
        type: "options",
        options: [
          { label: "Sales", action: "select_sales" },
          { label: "Marketing", action: "select_marketing" },
          { label: "Operations", action: "select_operations" },
          { label: "Analyst", action: "select_analyst" }
        ]
      }
    ],
  },
  {
    id: "msg-2",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Great, I can help you with that. Switching to Sales agent mode."
      }
    ],
  },
  {
    id: "msg-2b",
    role: "assistant",
    parts: [
      {
        type: "system-event",
        event: "agent-switching",
        metadata: { targetAgent: "Sales Agent" }
      }
    ],
  },
  {
    id: "msg-3",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "I need to understand your business first. Tell me about your business. Do you have a website, facebook, instagram or google business profile?"
      },
    ],
  },
  {
    id: "msg-4",
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
    id: "msg-5",
    role: "ai-agent",
    parts: [
      {
        type: "reasoning",
        text: "Analyzing business context",
        state: "done",
      },
      {
        type: "text",
        text: "Here is what I understand:\n\n**Business Name**: Eat Cook Joy\n**Value Prop**: Chef tool providing personalization + convenience + affordability\n**Location**: Texas\n**Services**: Meal Prep, Events\n\nAm I missing anything?"
      },
    ]
  },
  {
    id: "msg-6",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "No",
        recordingDuration: 1000
      },
    ],
  },
  {
    id: "msg-7",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Got it. I will store this information and share with your other agents in the future so you don't have to go through this step again. You can find and update this information anytime from the sidebar."
      },
      { type: "open-sidebar" },
      {
        type: "summary-added",
        heading: "Business Profile",
        subheading: "Your business information for all agents",
        id: "business_profile"
      },
    ]
  },
  {
    id: "msg-8",
    role: "ai-agent",
    parts: [
      {
        type: "summary-updated",
        messages: ['Business Name: Eat Cook Joy\nValue Prop: Chef tool providing personalization + convenience + affordability\nLocation: Texas\nServices: Meal Prep, Events'],
        id: "business_profile"
      },
    ]
  },
  {
    id: "msg-9",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Ok, let's continue. Where do you manage your leads?"
      },
    ],
  },
  {
    id: "msg-10",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "I manage my leads on Thumbtack",
        recordingDuration: 2000
      },
    ],
  },
  {
    id: "msg-10b",
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
    id: "msg-11",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Got it. Lets connect with Thumbtack"
      },
      {
        type: "button",
        text: "Connect Thumbtack",
        action: "connect_thumbtack"
      }
    ],
  },
  {
    id: "msg-12",
    role: "ai-agent",
    parts: [
      {
        type: "app-event",
        apps: [
          { app_id: "thumbtack", enabled: true },
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
        text: "Now that I can access Thumbtack, lets walk through how you manage your leads there."
      },
    ],
  },
  {
    id: "msg-13b",
    role: "ai-agent",
    parts: [
      {
        type: "button",
        text: "Go To Thumbtack",
        action: "navigate_thumbtack",
        url: "https://thumbtack.com"
      }
    ],
  },
  {
    id: "msg-14",
    role: "user",
    parts: [
      {
        type: "recording-state",
        state: "start"
      },
      {
        type: "voice",
        dummyText: "Ok so first I got to Thumbtack. and then I go to jobs. This is where I see the leads. I will click on a lead, then send them a template message.",
        recordingDuration: 4000
      },
    ],
  },
  {
    id: "msg-14b",
    role: "ai-agent",
    parts: [
      {
        type: "recording-state",
        state: "pause"
      }
    ]
  },
  {
    id: "msg-15",
    role: "ai-agent",
    parts: [
      {
        type: "agent-interrupt",
        message: "Do you respond to all leads?"
      },
    ],
  },
  {
    id: "msg-16",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "Yes, I respond to all my leads.",
        recordingDuration: 2000
      },
    ],
  },
  {
    id: "msg-17",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Got it. I will make sure to watch out for incoming leads and send them a templated message. Would you like me to get your approval or just send the message?"
      },
    ],
  },
  {
    id: "msg-18",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "Get my approval and then we can adjust over time?",
        recordingDuration: 3000
      },
    ],
  },
  {
    id: "msg-19",
    role: "ai-agent",
    parts: [
      {
        type: "text",
        text: "Sure. Your preference has been recorded"
      },
      {
        type: "new-workflow",
        workflow: "Respond to all incoming leads automatically",
        category: "lead-management"
      },
      {
        type: "new-workflow",
        workflow: "Get user approval before sending templated messages",
        category: "communication"
      },
    ],
  },
  {
    id: "msg-19b",
    role: "ai-agent",
    parts: [
      {
        type: "recording-state",
        state: "pause"
      }
    ],
  },
  {
    id: "msg-20",
    role: "ai-agent",
    parts: [
      {
        type: "agent-interrupt",
        message: "Ok so I see your templates, these are the ones you want me to use?"
      }
    ],
  },
  {
    id: "msg-21",
    role: "user",
    parts: [
      {
        type: "voice",
        dummyText: "Yes. Feel free to use this. After Thumbtack message is sent I continue the conversation on Openphone.",
        recordingDuration: 4000
      },
    ],
  },
  {
    id: "msg-22",
    role: "ai-agent",
    parts: [
      {
        type: "new-workflow",
        workflow: "Use approved templates for initial lead responses",
        category: "communication"
      },
      {
        type: "new-workflow",
        workflow: "Continue conversations on OpenPhone after Thumbtack",
        category: "communication"
      },
    ],
  },
  ...openPhoneConversation
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

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Summary state for extension view
  const [summaryData, setSummaryData] = useState<{
    heading: string;
    subheading: string;
  } | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const [summaryMessages, setSummaryMessages] = useState<string[]>([])

  // App integrations state
  const [appStatuses, setAppStatuses] = useState<Array<{ app_id: string; enabled: boolean; connecting?: boolean }>>([])
  const [showApps, setShowApps] = useState(false)

  // Workflows state
  const [workflows, setWorkflows] = useState<Array<{
    id: string;
    workflow: string;
    category?: string;
    isNew?: boolean;
    isPretrained?: boolean;
  }>>([
    // Pre-trained workflows
    {
      id: "pretrained-1",
      workflow: "Analyze user business context and value proposition",
      category: "analysis",
      isPretrained: true
    },
    {
      id: "pretrained-2",
      workflow: "Collect and store business profile information",
      category: "lead-management",
      isPretrained: true
    },
    {
      id: "pretrained-3",
      workflow: "Connect with lead management platforms",
      category: "automation",
      isPretrained: true
    }
  ])
  const [showWorkflows, setShowWorkflows] = useState(true)

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
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");

  // Agent switching animation state
  const [isAgentSwitching, setIsAgentSwitching] = useState(false);
  const [agentSwitchingText, setAgentSwitchingText] = useState("");

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

  // Mobile responsive detection
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // Tailwind md breakpoint
    };

    // Check on mount
    checkIsMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIsMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Initialize state from API on mount
  useEffect(() => {
    const initializeState = async () => {
      try {
        const state = await loadFromAPI();
        // For demo mode, start fresh - don't load old state that might interfere
        setMessages([]);
        setCurrentMessageIndex(0);
        setStatus('ready');
        setIsUserMessageInPlaceholder(false);
        setDemoModeActive(true); // Always start in demo mode
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing state:', error);
        // Even on error, start in demo mode
        setMessages([]);
        setCurrentMessageIndex(0);
        setStatus('ready');
        setIsUserMessageInPlaceholder(false);
        setDemoModeActive(true);
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
        // Don't override demo state when demo mode is active
        // Demo mode controls the conversation flow locally
        if (!demoModeActive) {
          setMessages(state.messages || []);
          setCurrentMessageIndex(state.currentMessageIndex || 0);
          setStatus(state.status || 'ready');
          setIsUserMessageInPlaceholder(state.isUserMessageInPlaceholder || false);
          setDemoModeActive(state.demoModeActive !== undefined ? state.demoModeActive : true);
        }
      } else if (data.type === 'clear') {
        // Don't clear demo state when demo mode is active
        if (!demoModeActive) {
          setMessages([]);
          setCurrentMessageIndex(0);
          setStatus('ready');
          setIsUserMessageInPlaceholder(false);
          setDemoModeActive(true);
        }
      }
    });

    return cleanup;
  }, [demoModeActive]);

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
    if (!demoModeActive || !isInitialized || currentMessageIndex >= mockConversation.length) return;

    const currentMessage = mockConversation[currentMessageIndex];

    // Check if current message has options - if so, don't auto-progress
    const hasOptions = currentMessage.parts.some(part => part.type === "options");
    if (hasOptions) {
      // Show the message but don't auto-progress
      setStatus("ready");
      appendMessage(currentMessage);
      return;
    }

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
          setAppStatuses(appEventPart.apps.map(app => ({ ...app, connecting: false })));
          setShowApps(true);
        }

        // Process new-workflow parts
        const newWorkflowPart = currentMessage.parts.find(part => part.type === "new-workflow");
        if (newWorkflowPart && newWorkflowPart.type === "new-workflow") {
          setWorkflows(prev => [
            // Add new workflow at the top
            {
              id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              workflow: newWorkflowPart.workflow,
              category: newWorkflowPart.category || "default",
              isNew: true,
              isPretrained: false
            },
            // Mark existing new workflows as no longer "new"
            ...prev.map(w => w.isNew ? { ...w, isNew: false } : w)
          ]);
          setShowWorkflows(true);
        }

        // Process recording-state parts
        const recordingStatePart = currentMessage.parts.find(part => part.type === "recording-state");
        if (recordingStatePart && recordingStatePart.type === "recording-state") {
          if (recordingStatePart.state === "start") {
            setRecordingState("recording");
          } else if (recordingStatePart.state === "pause") {
            setRecordingState("paused");
          } else if (recordingStatePart.state === "stop") {
            setRecordingState("idle");
          }
        }

        // Process system-event parts for agent switching
        const systemEventPart = currentMessage.parts.find(part => part.type === "system-event");
        if (systemEventPart && systemEventPart.type === "system-event" && systemEventPart.event === "agent-switching") {
          setIsAgentSwitching(true);
          setAgentSwitchingText(`Switching to ${systemEventPart.metadata?.targetAgent || 'Agent'}...`);

          // Hide the switching animation after a delay
          setTimeout(() => {
            setIsAgentSwitching(false);
            setAgentSwitchingText("");
          }, 3000);
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
  }, [currentMessageIndex, demoModeActive, isInitialized, appendMessage]);

  // Start demo mode on mount
  useEffect(() => {
    if (demoModeActive && mockConversation.length > 0 && currentMessageIndex === 0 && messages.length === 0) {
      // The demo progression useEffect will handle showing the first message
      // since it has options, it will stop there and wait for user interaction
    }

    // Broadcast instance is automatically initialized when created
  }, [demoModeActive, currentMessageIndex, messages.length]);

  // Process existing messages to extract summary and app data
  useEffect(() => {
    if (messages.length === 0) return;

    // Process all messages to find the latest summary and app state
    let latestSummaryData: { heading: string; subheading: string } | null = null;
    let latestSummaryMessages: string[] = [];
    let latestAppStatuses: Array<{ app_id: string; enabled: boolean }> = [];
    let newWorkflows: Array<{
      id: string;
      workflow: string;
      category?: string;
      isNew?: boolean;
      isPretrained?: boolean;
    }> = [];

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
          // When processing existing messages, clear connecting state
          latestAppStatuses = part.apps.map(app => ({ ...app, connecting: false }));
        } else if (part.type === "new-workflow") {
          newWorkflows.push({
            id: `workflow-existing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            workflow: part.workflow,
            category: part.category || "default",
            isNew: false, // Since we're processing existing messages, don't mark as new
            isPretrained: false
          });
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

    if (newWorkflows.length > 0) {
      setWorkflows(prev => {
        // Get pre-trained workflows and put learned ones first
        const pretrainedWorkflows = prev.filter(w => w.isPretrained);
        return [...newWorkflows, ...pretrainedWorkflows];
      });
      setShowWorkflows(true);
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
      setRecordingState("recording");

      // Recording will continue until user clicks the cross button
      // No auto-stop timer - demo presenter is in control
    } catch (error) {
      console.error("Error accessing microphone:", error);
      // If microphone access fails, just show the mic button again
      setIsRecording(false);
      setRecordingState("idle");
    }
  };

  const handleStopRecording = (transcribedText: string) => {
    // Stop the recording
    setIsRecording(false);
    setRecordingState("idle");

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

  // Render conversation messages
  const renderConversationMessages = () => (
    <>
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
              case "options":
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className="flex flex-wrap gap-2 mb-4 justify-start"
                  >
                    {part.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        onClick={() => {
                          // Handle option selection - add user message and progress conversation
                          if (option.action === "select_sales") {
                            // Mark as user action
                            saveToAPIRef.current = true;

                            // Add user message for the selected option
                            const userMessage: CustomUIMessage = {
                              id: `user-${Date.now()}`,
                              role: "user",
                              parts: [{ type: "text", text: option.label }],
                            };

                            // Add the user message and progress to next AI message
                            appendMessage(userMessage);
                            const newIndex = currentMessageIndex + 1;
                            setCurrentMessageIndex(newIndex);

                            // Broadcast the user message and progress
                            if (updateSourceRef.current === 'self' && broadcastInstance) {
                              broadcastInstance.broadcastMessage({
                                type: 'USER_MESSAGE_SUBMITTED',
                                payload: { message: userMessage, newIndex }
                              });
                            }
                          }
                        }}
                        className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent text-foreground transition-colors"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                );
              case "button":
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className="flex justify-start mb-4"
                  >
                    <button
                      onClick={() => {
                        if (["connect_thumbtack", "connect_openphone"].includes(part.action)) {
                          const appId = part.action.split('_')[1]
                          // Mark as user action
                          saveToAPIRef.current = true;

                          // Set connecting state for Thumbtack
                          setAppStatuses(prev => {
                            const existingApp = prev.find(app => app.app_id === appId);
                            if (existingApp) {
                              return prev.map(app =>
                                app.app_id === appId
                                  ? { ...app, connecting: true, enabled: false }
                                  : app
                              );
                            } else {
                              // If app doesn't exist yet, add it
                              return [...prev, { app_id: appId, enabled: false, connecting: true }];
                            }
                          });

                          // After 10 seconds, mark as connected and progress to next message
                          setTimeout(() => {
                            saveToAPIRef.current = true;
                            setAppStatuses(prev =>
                              prev.map(app =>
                                app.app_id === appId
                                  ? { ...app, connecting: false, enabled: true }
                                  : app
                              )
                            );
                            // Progress to next message after connection is complete
                            setCurrentMessageIndex(prev => prev + 1);
                          }, 10000);
                        } else if (["navigate_thumbtack", "navigate_openphone"].includes(part.action)) {
                          // Open Thumbtack in new tab/window
                          window.open(part.url, '_blank');
                          // Progress to next message
                          saveToAPIRef.current = true;
                          setCurrentMessageIndex(prev => prev + 1);
                        }
                      }}
                      className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                    >
                      {part.text}
                      {part.url && (
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
                      )}
                    </button>
                  </div>
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
              case "agent-interrupt":
                return (
                  <Message
                    key={`${message.id}-${i}`}
                    from="ai-agent"
                  >
                    <MessageContent>
                      <div className="flex items-center gap-2">
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
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="font-medium">Agent Interrupt</span>
                      </div>
                      <p className="mt-1">{part.message}</p>
                    </MessageContent>
                  </Message>
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
    </>
  );

  // Render mic section
  const renderMicSection = () => (
    showMicSection && (
      <div className="flex-shrink-0 mt-4 relative">
        <AnimatePresence mode="wait">
          {recordingState === "idle" ? (
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
          ) : recordingState === "paused" ? (
            // Show recording paused state
            <motion.div
              key="recording-paused"
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
                aria-label="Resume recording"
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
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg text-sm font-medium border border-yellow-200">
                Recording Paused
              </div>
            </motion.div>
          ) : (
            // Show audio visualizer when recording
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
                  isRecording={recordingState === "recording"}
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
    )
  );

  return (
    <div className={`max-w-4xl mx-auto p-6 relative size-full h-screen ${isExtension && showSummary || isMobile ? 'flex flex-col' : ''}`}>
      {/* Mobile Tabs - Show on mobile width (including narrow extension sidebars) */}
      {isMobile && (
        <div className="flex flex-col h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="profile">Business Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-4 flex-1 flex flex-col min-h-0">
              <div className="flex flex-col h-full">
                <Conversation className="flex-1">
                  <ConversationContent>
                    {renderConversationMessages()}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>

                {renderMicSection()}
              </div>
            </TabsContent>

            <TabsContent value="profile" className="mt-4 flex-1 flex flex-col min-h-0">
              {/* Business Profile content */}
              {showSummary && summaryData ? (
                <>
                  <ExtensionSummary
                    heading={summaryData.heading}
                    subheading={summaryData.subheading}
                    messages={summaryMessages}
                  />
                  {showApps && appStatuses.length > 0 && (
                    <div className="mt-4">
                      <AppIntegrations apps={appStatuses} />
                    </div>
                  )}
                  {showWorkflows && workflows.length > 0 && (
                    <div className="mt-4">
                      <Workflows workflows={workflows} />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground mb-4"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="m22 2-5 10-7-5" />
                  </svg>
                  <h3 className="text-lg font-medium text-foreground mb-2">No Business Profile Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Start a conversation with the assistant to create your business profile.
                    Your information will appear here once it's collected.
                  </p>
                  <button
                    onClick={() => setActiveTab("chat")}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Start Chat
                  </button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Extension mode only - Show summary and apps at top when in extension and desktop width */}
      {!isMobile && isExtension && showSummary && summaryData && (
        <div className="flex-shrink-0 mb-4">
          <ExtensionSummary
            heading={summaryData.heading}
            subheading={summaryData.subheading}
            messages={summaryMessages}
          />
        </div>
      )}

      {!isMobile && isExtension && showApps && appStatuses.length > 0 && (
        <div className="flex-shrink-0 mb-4">
          <AppIntegrations apps={appStatuses} />
        </div>
      )}

      {!isMobile && isExtension && showWorkflows && workflows.length > 0 && (
        <div className="flex-shrink-0 mb-4">
          <Workflows workflows={workflows} />
        </div>
      )}

      {/* Desktop conversation - Hide on mobile and when extension is on localhost/deployed app */}
      {!isMobile && !(isExtension && isOnOwnDomain) && (
        <div className={`flex flex-col ${isExtension && showSummary ? 'flex-1 min-h-0' : 'h-full'}`}>
          <Conversation className="h-full">
            <ConversationContent>
              {renderConversationMessages()}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {renderMicSection()}
        </div>
      )}
    </div>
  );
};

export default ChatBotDemo;
