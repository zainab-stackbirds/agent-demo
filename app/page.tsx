"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import { MessageImage } from "@/components/ai-elements/message-image";
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
import { AudioVisualizer } from "@/components/ui/audio-visualizer";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion, LayoutGroup } from "motion/react";
import {
  fetchConversationState,
  updateConversationState,
  clearConversationState,
  setupSSEConnection,
  fetchButtonStates,
  updatePartialButtonStates,
  type ButtonStates,
} from "@/lib/api-client";
import { ExtensionSummary } from "@/components/extension/extension-summary";
import { AppIntegrations } from "@/components/extension/app-integrations";
import { openPhoneConversation, thumbtackConversation } from "@/lib/consts";
import { Workflows } from "@/components/extension/workflows";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Header from "@/components/UnitComponents/Header";
import RecordingIndicator from "@/components/extension/recording-indicator";

export type CustomUIMessage = Omit<UIMessage, "role" | "parts"> & {
  role: "assistant" | "user" | "ai-agent";
  parts: MessagePart[];
};

// Update your types
type MessagePart =
  | { type: "text"; text: string; displayAvatar?: boolean }
  | { type: "text-image"; text: string; url: string; link?: string }
  | {
    type: "reasoning";
    text: string;
    status?: "start" | "done" | "streaming";
  }
  | { type: "source-url"; url: string }
  | {
    type: "system-event";
    event:
    | "agent-joined"
    | "agent-left"
    | "task-created"
    | "agent-switching";
    metadata?: Record<string, any>;
  }
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
  | { type: "new-workflow"; workflow: string; category?: string };

// Broadcast Channel types for cross-tab synchronization
type BroadcastMessage =
  | {
    type: "SYNC_STATE";
    payload: {
      messages: CustomUIMessage[];
      currentMessageIndex: number;
      status: ChatStatus;
      isUserMessageInPlaceholder: boolean;
      demoModeActive: boolean;
      input: string;
    };
  }
  | {
    type: "USER_MESSAGE_SUBMITTED";
    payload: {
      message: CustomUIMessage;
      newIndex: number;
    };
  }
  | {
    type: "DEMO_PROGRESS";
    payload: {
      newIndex: number;
      newMessage?: CustomUIMessage;
      status: ChatStatus;
      isUserMessageInPlaceholder: boolean;
    };
  }
  | {
    type: "WORKFLOW_RECORDING_STATE";
    payload: {
      state: "recording" | "paused" | "idle" | "not_started";
    };
  };

// Utility functions for API state management
const saveToAPI = async (state: any) => {
  try {
    await updateConversationState(state);
  } catch (error) {
    console.error("Error saving to API:", error);
  }
};

const loadFromAPI = async (): Promise<any> => {
  try {
    return await fetchConversationState();
  } catch (error) {
    console.error("Error loading from API:", error);
    // Return default state
    return {
      messages: [],
      currentMessageIndex: 0,
      status: "ready",
      isUserMessageInPlaceholder: false,
      demoModeActive: true,
      input: "",
    };
  }
};

const clearConversationStorage = async () => {
  if (typeof window !== "undefined") {
    try {
      await clearConversationState();
    } catch (error) {
      console.error("Error clearing conversation storage:", error);
    }
  }
};

const createWorkflowId = (
  messageId: string | undefined,
  fallbackMessageIndex: number,
  partIndex: number
) => {
  const baseId = messageId || `message-${fallbackMessageIndex}`;
  return `workflow-${baseId}-${partIndex}`;
};

// Simple broadcast utility - avoiding hooks to prevent re-render issues
class BroadcastSync {
  private channel: BroadcastChannel | null = null;
  private isInIframe: boolean = false;
  private messageHandlers: ((message: BroadcastMessage) => void)[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.channel = new BroadcastChannel("stackbirds-chat-sync");
      this.isInIframe = window !== window.top;
      this.setupListeners();
    }
  }

  private setupListeners() {
    if (this.channel) {
      this.channel.addEventListener(
        "message",
        (event: MessageEvent<BroadcastMessage>) => {
          this.messageHandlers.forEach((handler) =>
            handler(event.data)
          );
        }
      );
    }

    // Listen to PostMessage events (from iframes or to iframes)
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === "stackbirds-iframe") {
        const { source, ...messageData } = event.data;
        this.messageHandlers.forEach((handler) =>
          handler(messageData as BroadcastMessage)
        );
      }
    };

    // Listen to localStorage changes from other tabs (legacy support - not used with Redis)
    const handleStorageChange = (event: StorageEvent) => {
      // localStorage sync is no longer used - state is managed via Redis
      // This listener is kept for compatibility but does nothing
    };

    window.addEventListener("message", handlePostMessage);
    window.addEventListener("storage", handleStorageChange);
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
      window.parent.postMessage(
        {
          ...message,
          source: "stackbirds-iframe",
        },
        "*"
      );
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
  if (!broadcastSync && typeof window !== "undefined") {
    broadcastSync = new BroadcastSync();
  }
  return broadcastSync;
};

const mockConversation: CustomUIMessage[] = [
  ...thumbtackConversation,
  ...openPhoneConversation,
];

// Helper function to render text with clickable links and preserve newlines
const TextWithLinks = ({ text }: { text: string }) => {
  // Regex to detect URLs in text
  const urlRegex =
    /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;

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
          const url = part.startsWith("http")
            ? part
            : `https://${part}`;
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

  const [summaryMessages, setSummaryMessages] = useState<string[]>([]);

  // App integrations state
  const [appStatuses, setAppStatuses] = useState<
    Array<{ app_id: string; enabled: boolean; connecting?: boolean }>
  >([]);
  const [showApps, setShowApps] = useState(false);

  // Connection states for individual apps
  const [connectionStates, setConnectionStates] = useState<
    Record<string, "idle" | "connecting" | "connected">
  >({});
  const [workflowRecordingState, setWorkflowRecordingState] =
    useState("not_started");
  const [navigationButtonClicked, setNavigationButtonClicked] = useState<
    Record<string, boolean>
  >({});

  // Workflows state
  const [workflows, setWorkflows] = useState<
    Array<{
      id: string;
      workflow: string;
      category?: string;
      isNew?: boolean;
      isPretrained?: boolean;
    }>
  >([
    // Pre-trained workflows
    {
      id: "pretrained-1",
      workflow: "Analyze user business context and value proposition",
      category: "analysis",
      isPretrained: true,
    },
    {
      id: "pretrained-2",
      workflow: "Collect and store business profile information",
      category: "lead-management",
      isPretrained: true,
    },
    {
      id: "pretrained-3",
      workflow: "Connect with lead management platforms",
      category: "automation",
      isPretrained: true,
    },
  ]);
  const [showWorkflows, setShowWorkflows] = useState(true);

  // Initialize state from API
  const [messages, setMessages] = useState<CustomUIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isUserMessageInPlaceholder, setIsUserMessageInPlaceholder] =
    useState(false);
  const [demoModeActive, setDemoModeActive] = useState(true);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "paused"
  >("idle");

  // Agent switching animation state
  const [isAgentSwitching, setIsAgentSwitching] = useState(false);
  const [agentSwitchingText, setAgentSwitchingText] = useState("");

  // Hero visibility state
  const [showHero, setShowHero] = useState(true);

  // Initialize simple broadcast sync (non-hook based to avoid typing interference)
  const [broadcastInstance] = useState(() => getBroadcastSync());
  const updateSourceRef = useRef<string>("self"); // Track if update came from broadcast
  const workflowsHydratedRef = useRef(false); // Used to decide when to mark workflows as newly learned

  // Simple direct scroll to bottom - bypass the library
  const AutoScrollHandler = () => {
    const scrollToBottom = useCallback(() => {
      // Find the conversation container and scroll it
      const conversationElement =
        document.querySelector("[data-conversation-content]") ||
        document.querySelector(".conversation-content") ||
        document.querySelector('[data-testid="conversation-content"]');

      if (conversationElement) {
        conversationElement.scrollTop =
          conversationElement.scrollHeight;
      } else {
        // Fallback: scroll the window
        window.scrollTo(0, document.body.scrollHeight);
      }
    }, []);

    // Scroll on initial load
    useEffect(() => {
      if (messages.length > 0 && isInitialized) {
        // Multiple attempts with increasing delays to handle all rendering scenarios
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
        setTimeout(scrollToBottom, 600);
        setTimeout(scrollToBottom, 1200); // After motion animations complete
      }
    }, [isInitialized, scrollToBottom]);

    // Scroll when new messages are added
    useEffect(() => {
      if (messages.length > 0) {
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
      }
    }, [messages.length, scrollToBottom]);

    // Scroll when AI finishes responding
    useEffect(() => {
      if (status === "ready" && messages.length > 0) {
        setTimeout(scrollToBottom, 100);
      }
    }, [status, messages.length, scrollToBottom]);

    return null;
  };

  const appendMessage = useCallback(
    (message: CustomUIMessage) => {
      setMessages((prev) => {
        if (prev.some((existing) => existing.id === message.id)) {
          return prev;
        }

        return [...prev, message];
      });
    },
    [setMessages]
  );

  // Function to handle AI message progression (extracted from setTimeout)
  const progressAIMessage = useCallback(() => {
    if (!demoModeActive || currentMessageIndex >= mockConversation.length)
      return;

    const currentMessage = mockConversation[currentMessageIndex];

    // Mark that this is a demo progress action - should be saved to API
    saveToAPIRef.current = true;

    const newIndex = currentMessageIndex + 1;
    setStatus("ready");
    appendMessage(currentMessage);
    setCurrentMessageIndex(newIndex);

    // Check if message contains open-sidebar action and trigger it
    const hasOpenSidebar = currentMessage.parts.some(
      (part) => part.type === "open-sidebar"
    );
    if (hasOpenSidebar) {
      // Send postMessage to current window for content script to receive
      // After business profile gathering, open sidebar with profile tab
      window.postMessage(
        {
          action: "openSidebar",
          source: "stackbirds-app",
          defaultTab: "profile",
        },
        "*"
      );
    }

    // Process summary-added parts
    const summaryAddedPart = currentMessage.parts.find(
      (part) => part.type === "summary-added"
    );
    if (summaryAddedPart && summaryAddedPart.type === "summary-added") {
      setSummaryData({
        heading: summaryAddedPart.heading,
        subheading: summaryAddedPart.subheading,
      });
      setShowSummary(true);
      setSummaryMessages([]);
    }

    // Process summary-updated parts
    const summaryUpdatedPart = currentMessage.parts.find(
      (part) => part.type === "summary-updated"
    );
    if (
      summaryUpdatedPart &&
      summaryUpdatedPart.type === "summary-updated"
    ) {
      setSummaryMessages((prev) => [
        ...prev,
        ...summaryUpdatedPart.messages,
      ]);
    }

    // Process app-event parts
    const appEventPart = currentMessage.parts.find(
      (part) => part.type === "app-event"
    );
    if (appEventPart && appEventPart.type === "app-event") {
      const updatedApps = appEventPart.apps.map((app) => ({
        ...app,
        connecting: false,
      }));

      // Only update if the apps don't already exist in state, or merge with existing
      setAppStatuses((prevApps) => {
        if (prevApps.length === 0) {
          return updatedApps;
        }

        // Merge: keep existing apps and their states, add new ones
        const mergedApps = [...prevApps];
        updatedApps.forEach((newApp) => {
          const existingIndex = mergedApps.findIndex((a) => a.app_id === newApp.app_id);
          if (existingIndex >= 0) {
            // If app exists and is connected/connecting, keep its state
            if (mergedApps[existingIndex].enabled || mergedApps[existingIndex].connecting) {
              // Don't override existing connection status
              return;
            }
            // Otherwise update it
            mergedApps[existingIndex] = newApp;
          } else {
            // New app, add it
            mergedApps.push(newApp);
          }
        });
        return mergedApps;
      });

      setShowApps(true);

      // Update connection states based on app statuses (preserve existing "connected" states)
      setConnectionStates((prev) => {
        const newStates = { ...prev };
        updatedApps.forEach((app) => {
          // Only update if not already connected
          if (prev[app.app_id] === "connected") {
            // Keep connected state
            return;
          }

          if (app.enabled) {
            newStates[app.app_id] = "connected";
          } else if (app.connecting) {
            newStates[app.app_id] = "connecting";
          } else {
            newStates[app.app_id] = "idle";
          }
        });
        return newStates;
      });
    }

    // Process new-workflow parts
    const newWorkflowParts = currentMessage.parts
      .map((part, partIndex) => ({ part, partIndex }))
      .filter(
        (
          entry
        ): entry is {
          part: Extract<MessagePart, { type: "new-workflow" }>;
          partIndex: number;
        } => entry.part.type === "new-workflow"
      );

    if (newWorkflowParts.length > 0) {
      setWorkflows((prev) => {
        const next = [...prev];

        newWorkflowParts.forEach(({ part, partIndex }) => {
          const workflowId = createWorkflowId(
            currentMessage.id,
            currentMessageIndex,
            partIndex
          );
          const baseData = {
            id: workflowId,
            workflow: part.workflow,
            category: part.category || "default",
            isPretrained: false as const,
          };

          const existingIndex = next.findIndex(
            (item) => item.id === workflowId
          );

          if (existingIndex >= 0) {
            next[existingIndex] = {
              ...next[existingIndex],
              ...baseData,
              isNew: true,
            };
          } else {
            next.push({
              ...baseData,
              isNew: true,
            });
          }
        });

        return next;
      });
      setShowWorkflows(true);
    }

    // Process recording-state parts
    const recordingStatePart = currentMessage.parts.find(
      (part) => part.type === "recording-state"
    );
    if (
      recordingStatePart &&
      recordingStatePart.type === "recording-state"
    ) {
      let newState: "recording" | "paused" | "idle" | "not_started" = "not_started";
      if (recordingStatePart.state === "start") {
        newState = "recording";
        setWorkflowRecordingState("recording");
      } else if (recordingStatePart.state === "pause") {
        newState = "paused";
        setWorkflowRecordingState("paused");
      } else if (recordingStatePart.state === "stop") {
        newState = "idle";
        setWorkflowRecordingState("idle");
      }

      // Save recording state to Redis
      updatePartialButtonStates({
        agentRecordingState: newState,
      }).catch((error) => {
        console.error("Error saving recording state:", error);
      });
    }

    // Process system-event parts for agent switching
    const systemEventPart = currentMessage.parts.find(
      (part) => part.type === "system-event"
    );
    if (
      systemEventPart &&
      systemEventPart.type === "system-event" &&
      systemEventPart.event === "agent-switching"
    ) {
      setIsAgentSwitching(true);
      setAgentSwitchingText(
        `Switching to ${systemEventPart.metadata?.targetAgent || "Agent"
        }...`
      );

      // Hide the switching animation after a delay
      setTimeout(() => {
        setIsAgentSwitching(false);
        setAgentSwitchingText("");
      }, 3000);
    }

    // Broadcast the completed message
    if (updateSourceRef.current === "self" && broadcastInstance) {
      broadcastInstance.broadcastMessage({
        type: "DEMO_PROGRESS",
        payload: {
          newIndex,
          newMessage: currentMessage,
          status: "ready",
          isUserMessageInPlaceholder: false,
        },
      });
    }
  }, [currentMessageIndex, demoModeActive, appendMessage, broadcastInstance]);

  // Detect if running inside extension iframe via URL param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const isExtensionParam = urlParams.get("isExtension");
      setIsExtension(isExtensionParam === "true");

      // Check if parent window (where extension is loaded) is on our own domain
      if (isExtensionParam === "true" && window.parent !== window) {
        try {
          const parentHostname = window.parent.location.hostname;
          const isOwnDomain =
            parentHostname.includes("localhost") ||
            parentHostname.includes("agent-demo-pied.vercel.app");
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
    window.addEventListener("resize", checkIsMobile);

    // Cleanup
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // URL parameter handling for tab selection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");

      // Validate tab parameter and set active tab
      if (tabParam === "chat" || tabParam === "profile") {
        setActiveTab(tabParam);
      }
      // If invalid or no tab parameter, keep default "profile"
    }
  }, []);

  // Initialize state from API on mount
  useEffect(() => {
    const initializeState = async () => {
      try {
        const state = await loadFromAPI();
        const buttonStates = await fetchButtonStates();

        // Check if there's existing state to preserve
        if (state && state.messages && state.messages.length > 0) {
          // Use existing state - don't reset for demo mode
          setMessages(state.messages);
          setCurrentMessageIndex(state.currentMessageIndex || 0);
          setStatus(state.status || "ready");
          setIsUserMessageInPlaceholder(
            state.isUserMessageInPlaceholder || false
          );
          setDemoModeActive(
            state.demoModeActive !== undefined
              ? state.demoModeActive
              : false
          );
        } else {
          // No existing state - start fresh in demo mode
          setMessages([]);
          setCurrentMessageIndex(0);
          setStatus("ready");
          setIsUserMessageInPlaceholder(false);
          setDemoModeActive(true); // Only start demo mode when there's no existing state
        }

        // Load app statuses
        console.log("📥 Loading state from Redis:", { appStatuses: state.appStatuses, buttonStates });
        if (state.appStatuses && state.appStatuses.length > 0) {
          console.log("✅ Setting app statuses from state:", state.appStatuses);
          setAppStatuses(state.appStatuses);
          setShowApps(true);
        }

        // Load button states and sync with app statuses
        if (buttonStates.isConnectThumbtackClicked) {
          console.log("🔧 Thumbtack was previously connected, updating app statuses");
          setConnectionStates((prev) => ({
            ...prev,
            thumbtack: "connected",
          }));

          // Also update appStatuses to show thumbtack as enabled
          setAppStatuses((prev) => {
            const hasThumbtack = prev.some((app) => app.app_id === "thumbtack");
            if (hasThumbtack) {
              return prev.map((app) =>
                app.app_id === "thumbtack"
                  ? { ...app, enabled: true, connecting: false }
                  : app
              );
            } else {
              // Add thumbtack if it doesn't exist
              return [
                ...prev,
                { app_id: "thumbtack", enabled: true, connecting: false },
              ];
            }
          });
          setShowApps(true); // Ensure apps section is shown
        }

        if (buttonStates.isConnectOpenPhoneClicked) {
          setConnectionStates((prev) => ({
            ...prev,
            openphone: "connected",
          }));

          // Also update appStatuses to show openphone as enabled
          setAppStatuses((prev) => {
            const hasOpenphone = prev.some((app) => app.app_id === "openphone");
            if (hasOpenphone) {
              return prev.map((app) =>
                app.app_id === "openphone"
                  ? { ...app, enabled: true, connecting: false }
                  : app
              );
            } else {
              // Add openphone if it doesn't exist
              return [
                ...prev,
                { app_id: "openphone", enabled: true, connecting: false },
              ];
            }
          });
          setShowApps(true); // Ensure apps section is shown
        }

        setWorkflowRecordingState(buttonStates.agentRecordingState);

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing state:", error);
        // On error, start in demo mode
        setMessages([]);
        setCurrentMessageIndex(0);
        setStatus("ready");
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

      if (data.type === "state_update") {
        const state = data.data;
        // Always sync state updates for real-time synchronization
        setMessages(state.messages || []);
        setCurrentMessageIndex(state.currentMessageIndex || 0);
        setStatus(state.status || "ready");
        setIsUserMessageInPlaceholder(
          state.isUserMessageInPlaceholder || false
        );
        setDemoModeActive(
          state.demoModeActive !== undefined
            ? state.demoModeActive
            : false
        );
      } else if (data.type === "clear") {
        // Only clear if explicitly requested (not during normal operation)
        setMessages([]);
        setCurrentMessageIndex(0);
        setStatus("ready");
        setIsUserMessageInPlaceholder(false);
        setDemoModeActive(true);
      }
    });

    return cleanup;
  }, []);

  // Handle clear action from URL query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");

    if (action === "clear") {
      clearConversationStorage().then(() => {
        // Reset button states as well
        setConnectionStates({});
        setWorkflowRecordingState("not_started");

        // Remove the query param from URL without reload
        window.history.replaceState({}, "", window.location.pathname);
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
      input: "",
      appStatuses,
    });

    // Reset the flag
    saveToAPIRef.current = false;
  }, [
    messages,
    currentMessageIndex,
    status,
    isUserMessageInPlaceholder,
    demoModeActive,
    appStatuses,
    isInitialized,
  ]);

  useEffect(() => {
    console.log("--------------------------------");
    console.log("🔍 Demo mode active:", demoModeActive);
    console.log("🔍 Is initialized:", isInitialized);
    console.log("🔍 Current message index:", currentMessageIndex);
    console.log("🔍 Mock conversation length:", mockConversation.length);
    console.log("🔍 Workflow recording state:", workflowRecordingState);
    console.log("🔍 Messages:", messages);

    if (
      !demoModeActive ||
      !isInitialized ||
      currentMessageIndex >= mockConversation.length
    )
      return;

    const currentMessage = mockConversation[currentMessageIndex];
    console.log("🔍 Current message:", currentMessage);

    // Check if current message has options - if so, don't auto-progress
    const hasOptions = currentMessage.parts.some(
      (part) => part.type === "options"
    );
    console.log("🔍 Has options:", hasOptions);
    const requiresAction = currentMessage.parts.some(
      (part) => part.type === "button" && part.action !== undefined
    );
    console.log("🔍 Requires action:", requiresAction);

    if (hasOptions || requiresAction) {
      // Show the message but don't auto-progress
      console.log("🔍 Showing message with options or requires action");
      setStatus("ready");
      appendMessage(currentMessage);
      return;
    }

    if (currentMessage.role === "user") {
      // Show user message as placeholder - wait for manual input
      setInput(""); // Clear input
      setIsUserMessageInPlaceholder(true);

      // Broadcast the waiting state
      if (updateSourceRef.current === "self" && broadcastInstance) {
        broadcastInstance.broadcastMessage({
          type: "DEMO_PROGRESS",
          payload: {
            newIndex: currentMessageIndex,
            status: "ready",
            isUserMessageInPlaceholder: true,
          },
        });
      }
      // Don't auto-progress - wait for user to send manually
    } else {
      // AI message - first show thinking state
      // Mark that this is a state change that should be saved
      saveToAPIRef.current = true;
      setStatus("streaming");

      // Broadcast streaming state
      if (updateSourceRef.current === "self" && broadcastInstance) {
        broadcastInstance.broadcastMessage({
          type: "DEMO_PROGRESS",
          payload: {
            newIndex: currentMessageIndex,
            status: "streaming",
            isUserMessageInPlaceholder: false,
          },
        });
      }

      // Automatically progress to next message after a delay
      setTimeout(() => {
        progressAIMessage();
      }, 2000); // 2 second delay
    }
  }, [
    currentMessageIndex,
    demoModeActive,
    isInitialized,
    appendMessage,
    progressAIMessage,
  ]);

  // Start demo mode on mount
  useEffect(() => {
    if (
      demoModeActive &&
      mockConversation.length > 0 &&
      currentMessageIndex === 0 &&
      messages.length === 0
    ) {
      // The demo progression useEffect will handle showing the first message
      // since it has options, it will stop there and wait for user interaction
    }

    // Broadcast instance is automatically initialized when created
  }, [demoModeActive, currentMessageIndex, messages.length]);

  // Process existing messages to extract summary and app data
  const messagesProcessedRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0 || messagesProcessedRef.current) return;

    // Process all messages to find the latest summary and app state
    let latestSummaryData: { heading: string; subheading: string } | null =
      null;
    let latestSummaryMessages: string[] = [];
    let latestAppStatuses: Array<{
      app_id: string;
      enabled: boolean;
      connecting?: boolean;
    }> = [];
    let newWorkflows: Array<{
      id: string;
      workflow: string;
      category?: string;
      isNew?: boolean;
      isPretrained?: boolean;
    }> = [];

    const shouldMarkAsNew = workflowsHydratedRef.current;

    messages.forEach((message, messageIndex) => {
      message.parts.forEach((part, partIndex) => {
        if (part.type === "summary-added") {
          latestSummaryData = {
            heading: part.heading,
            subheading: part.subheading,
          };
          latestSummaryMessages = [];
        } else if (part.type === "summary-updated") {
          latestSummaryMessages = [
            ...latestSummaryMessages,
            ...part.messages,
          ];
        } else if (part.type === "app-event") {
          // When processing existing messages, clear connecting state
          latestAppStatuses = part.apps.map((app) => ({
            ...app,
            connecting: false,
          }));
        } else if (part.type === "new-workflow") {
          newWorkflows.unshift({
            id: createWorkflowId(
              message.id,
              messageIndex,
              partIndex
            ),
            workflow: part.workflow,
            category: part.category || "default",
            isNew: shouldMarkAsNew,
            isPretrained: false,
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
      // Merge with existing app statuses if any
      setAppStatuses((prevApps) => {
        if (prevApps.length === 0) {
          return latestAppStatuses;
        }

        // Merge: keep existing apps with their connection states
        const mergedApps = [...prevApps];
        latestAppStatuses.forEach((newApp) => {
          const existingIndex = mergedApps.findIndex((a) => a.app_id === newApp.app_id);
          if (existingIndex >= 0) {
            // If app exists and is connected/connecting, keep its state
            if (mergedApps[existingIndex].enabled || mergedApps[existingIndex].connecting) {
              // Don't override
              return;
            }
            // Otherwise update it
            mergedApps[existingIndex] = newApp;
          } else {
            // New app, add it
            mergedApps.push(newApp);
          }
        });
        return mergedApps;
      });

      setShowApps(true);

      // Initialize connection states based on app statuses (preserve existing "connected" states)
      setConnectionStates((prev) => {
        const newStates = { ...prev };
        latestAppStatuses.forEach((app) => {
          // Don't override existing connected states
          if (prev[app.app_id] === "connected") {
            return;
          }

          if (app.enabled) {
            newStates[app.app_id] = "connected";
          } else if (app.connecting) {
            newStates[app.app_id] = "connecting";
          } else {
            newStates[app.app_id] = "idle";
          }
        });
        return newStates;
      });
    }

    if (newWorkflows.length > 0) {
      setWorkflows((prev) => {
        // Preserve pre-trained workflows and merge with new ones using stable IDs
        const pretrainedWorkflows = prev.filter((w) => w.isPretrained);
        const prevById = new Map(
          prev.map((workflow) => [workflow.id, workflow])
        );

        const mergedWorkflows = newWorkflows.map((workflow) => {
          const existing = prevById.get(workflow.id);
          if (existing) {
            return {
              ...existing,
              workflow: workflow.workflow,
              category: workflow.category,
              isNew: existing.isNew,
              isPretrained: false,
            };
          }

          return workflow;
        });

        return [...pretrainedWorkflows, ...mergedWorkflows];
      });
      setShowWorkflows(true);
    }

    if (!workflowsHydratedRef.current) {
      workflowsHydratedRef.current = true;
    }
  }, [messages, isExtension]);

  // Handle broadcast messages from other tabs/iframes
  useEffect(() => {
    if (!broadcastInstance) return;

    const messageCleanup = broadcastInstance.addMessageListener(
      (message: BroadcastMessage) => {
        updateSourceRef.current = "broadcast";

        switch (message.type) {
          case "SYNC_STATE":
            const { payload } = message;
            setMessages(payload.messages);
            setCurrentMessageIndex(payload.currentMessageIndex);
            setStatus(payload.status);
            setIsUserMessageInPlaceholder(
              payload.isUserMessageInPlaceholder
            );
            setDemoModeActive(payload.demoModeActive);
            break;

          case "USER_MESSAGE_SUBMITTED":
            appendMessage(message.payload.message);
            setCurrentMessageIndex(message.payload.newIndex);
            setIsUserMessageInPlaceholder(false);
            setInput("");
            break;

          case "DEMO_PROGRESS":
            setCurrentMessageIndex(message.payload.newIndex);
            setStatus(message.payload.status);
            setIsUserMessageInPlaceholder(
              message.payload.isUserMessageInPlaceholder
            );
            if (message.payload.newMessage) {
              appendMessage(message.payload.newMessage);
            }
            break;

          case "WORKFLOW_RECORDING_STATE":
            setWorkflowRecordingState(message.payload.state);
            if (
              message.payload.state === "recording" &&
              window.parent &&
              window.parent !== window
            ) {
              window.parent.postMessage(
                {
                  action: "recordingStarted",
                  source: "stackbirds-app",
                },
                "*"
              );
            }
            break;
        }

        setTimeout(() => {
          updateSourceRef.current = "self";
        }, 100);
      }
    );

    return () => {
      if (messageCleanup) {
        messageCleanup();
      }
    };
  }, [broadcastInstance, appendMessage]);

  // Broadcast state changes when they come from this tab (not from broadcast)
  useEffect(() => {
    if (updateSourceRef.current === "self" && broadcastInstance) {
      broadcastInstance.broadcastMessage({
        type: "SYNC_STATE",
        payload: {
          messages,
          currentMessageIndex,
          status,
          isUserMessageInPlaceholder,
          demoModeActive,
          input: "", // Don't sync input to avoid typing interference
        },
      });
    }
  }, [
    messages,
    currentMessageIndex,
    status,
    isUserMessageInPlaceholder,
    demoModeActive,
    broadcastInstance,
  ]);

  const handleStartRecording = async () => {
    if (!demoModeActive || currentMessageIndex >= mockConversation.length)
      return;

    const currentMessage = mockConversation[currentMessageIndex];
    if (currentMessage.role !== "user") return;

    const voicePart = currentMessage.parts.find(
      (part) => part.type === "voice"
    );
    if (!voicePart || voicePart.type !== "voice") return;

    try {
      // Get mock audio stream (we'll use a real microphone for visualization)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
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

  const handleStopRecording = (transcribedText: string, autoSubmit: boolean = false) => {
    // Stop the recording
    setIsRecording(false);
    setRecordingState("idle");

    // Stop all tracks in the media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    // Clear the timer
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (autoSubmit) {
      // Original flow: automatically submit the message
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
      if (updateSourceRef.current === "self" && broadcastInstance) {
        broadcastInstance.broadcastMessage({
          type: "USER_MESSAGE_SUBMITTED",
          payload: { message: userMessage, newIndex },
        });
      }
    } else {
      // New flow: just populate the input field with transcribed text
      setInput(transcribedText);
    }
  };

  const handleCrossButtonClick = () => {
    if (!isRecording || currentMessageIndex >= mockConversation.length)
      return;

    const currentMessage = mockConversation[currentMessageIndex];
    const voicePart = currentMessage.parts.find(
      (part) => part.type === "voice"
    );
    if (!voicePart || voicePart.type !== "voice") return;

    // Add a natural delay between 200-400ms
    const delay = Math.random() * 200 + 200;

    setTimeout(() => {
      // Don't auto-submit, just populate input field
      handleStopRecording(voicePart.dummyText, false);
    }, delay);
  };

  // Check if current message is a voice message and if we should show input
  const currentMessage = mockConversation[currentMessageIndex];
  const isVoiceMessage =
    currentMessage?.role === "user" &&
    currentMessage.parts.some((part) => part.type === "voice");
  const shouldShowInput = currentMessage?.role === "user" && !isRecording;
  const isUserTurnToSpeak = shouldShowInput && status !== "streaming";

  // Render conversation messages
  const renderConversationMessages = () => (
    <>
      {messages.map((message, index) => (
        <motion.div
          key={message.id}
          layoutId={`message-${message.id}`}
          layout="position"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            layout: {
              duration: 1,
              ease: [0.16, 1, 0.3, 1],
              delay: 0,
            },
            opacity: { duration: 0.6, delay: index * 0.05 },
            y: { duration: 0.6, delay: index * 0.05 },
          }}
        >
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
                      (part) => part.type === "source-url"
                    ).length
                  }
                />
                {message.parts
                  .filter(
                    (part) => part.type === "source-url"
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
                  <Fragment key={`${message.id}-${i}`}>
                    <Message
                      from={message.role}
                      className="mb-2"
                    >
                      {message.role === "user" ? (
                        <>
                          <MessageContent>
                            <TextWithLinks
                              text={part.text}
                            />
                          </MessageContent>
                          <MessageAvatar
                            src=""
                            name="ZG"
                          />
                        </>
                      ) : message.role === "ai-agent" &&
                        part.displayAvatar !== undefined &&
                        part.displayAvatar === false ? (
                        <>
                          <div className="w-11" />
                          <MessageContent className="p-1 pb-3">
                            <TextWithLinks
                              text={part.text}
                            />
                          </MessageContent>
                        </>
                      ) : (
                        <>
                          <MessageAvatar
                            src=""
                            name={
                              message.role ===
                                "ai-agent"
                                ? "SA"
                                : "A"
                            }
                          />
                          <MessageContent>
                            <TextWithLinks
                              text={part.text}
                            />
                          </MessageContent>
                        </>
                      )}
                    </Message>
                  </Fragment>
                );
              case "options":
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className="flex flex-wrap gap-2 mb-6 ml-10"
                  >
                    {part.options.map(
                      (option, optionIndex) => (
                        <motion.button
                          key={optionIndex}
                          initial={{
                            opacity: 0,
                            y: 10,
                            scale: 0.95,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            transition: {
                              delay:
                                optionIndex *
                                0.1,
                              duration: 0.5,
                              ease: [
                                0.16, 1, 0.3, 1,
                              ],
                            },
                          }}
                          whileHover={{
                            scale: 1.05,
                            transition: {
                              duration: 0.2,
                            },
                          }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            // Handle option selection - add user message and progress conversation
                            if (
                              option.action ===
                              "select_sales"
                            ) {
                              // Mark as user action
                              saveToAPIRef.current =
                                true;

                              // Hide the hero with a fade-out animation
                              setShowHero(false);

                              // Add user message for the selected option
                              const userMessage: CustomUIMessage =
                              {
                                id: `user-${Date.now()}`,
                                role: "user",
                                parts: [
                                  {
                                    type: "text",
                                    text: option.label,
                                  },
                                ],
                              };

                              // Add the user message and progress to next AI message
                              appendMessage(
                                userMessage
                              );
                              const newIndex =
                                currentMessageIndex +
                                1;
                              setCurrentMessageIndex(
                                newIndex
                              );

                              // Broadcast the user message and progress
                              if (
                                updateSourceRef.current ===
                                "self" &&
                                broadcastInstance
                              ) {
                                broadcastInstance.broadcastMessage(
                                  {
                                    type: "USER_MESSAGE_SUBMITTED",
                                    payload:
                                    {
                                      message:
                                        userMessage,
                                      newIndex,
                                    },
                                  }
                                );
                              }
                            }
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-md border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          {option.label}
                        </motion.button>
                      )
                    )}
                  </div>
                );
              case "button":
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className="flex items-center gap-3 justify-start mb-6 ml-10"
                  >
                    <button
                      onClick={() => {
                        if (
                          [
                            "connect_thumbtack",
                            "connect_openphone",
                          ].includes(part.action)
                        ) {
                          const appId =
                            part.action.split(
                              "_"
                            )[1];
                          // Mark as user action
                          saveToAPIRef.current = true;

                          // Set connecting state
                          setConnectionStates(
                            (prev) => ({
                              ...prev,
                              [appId]:
                                "connecting",
                            })
                          );

                          // Set connecting state for Thumbtack
                          setAppStatuses((prev) => {
                            const existingApp =
                              prev.find(
                                (app) =>
                                  app.app_id ===
                                  appId
                              );
                            if (existingApp) {
                              return prev.map(
                                (app) =>
                                  app.app_id ===
                                    appId
                                    ? {
                                      ...app,
                                      connecting:
                                        true,
                                      enabled:
                                        false,
                                    }
                                    : app
                              );
                            } else {
                              // If app doesn't exist yet, add it
                              return [
                                ...prev,
                                {
                                  app_id: appId,
                                  enabled:
                                    false,
                                  connecting:
                                    true,
                                },
                              ];
                            }
                          });

                          // After 3 seconds, mark as connected
                          setTimeout(() => {
                            saveToAPIRef.current =
                              true;
                            setConnectionStates(
                              (prev) => ({
                                ...prev,
                                [appId]:
                                  "connected",
                              })
                            );
                            setAppStatuses((prev) =>
                              prev.map((app) =>
                                app.app_id ===
                                  appId
                                  ? {
                                    ...app,
                                    connecting:
                                      false,
                                    enabled:
                                      true,
                                  }
                                  : app
                              )
                            );

                            // Save button state to Redis
                            const buttonUpdate: Partial<ButtonStates> = {};
                            if (appId === "thumbtack") {
                              buttonUpdate.isConnectThumbtackClicked = true;
                            } else if (appId === "openphone") {
                              buttonUpdate.isConnectOpenPhoneClicked = true;
                            }
                            console.log("💾 Saving button state to Redis:", buttonUpdate);
                            updatePartialButtonStates(buttonUpdate).then(() => {
                              console.log("✅ Button state saved successfully");
                            }).catch((error) => {
                              console.error("❌ Error saving button state:", error);
                            });

                            // After connection completes, wait 10 seconds then progress to next message
                            setTimeout(() => {
                              saveToAPIRef.current =
                                true;
                              const nextIndex =
                                currentMessageIndex +
                                1;
                              if (
                                nextIndex <
                                mockConversation.length
                              ) {
                                const nextMessage =
                                  mockConversation[
                                  nextIndex
                                  ];
                                setStatus(
                                  "ready"
                                );
                                appendMessage(
                                  nextMessage
                                );
                                setCurrentMessageIndex(
                                  nextIndex
                                );

                                // Broadcast the progress
                                if (
                                  updateSourceRef.current ===
                                  "self" &&
                                  broadcastInstance
                                ) {
                                  broadcastInstance.broadcastMessage(
                                    {
                                      type: "DEMO_PROGRESS",
                                      payload:
                                      {
                                        newIndex:
                                          nextIndex,
                                        newMessage:
                                          nextMessage,
                                        status: "ready",
                                        isUserMessageInPlaceholder:
                                          false,
                                      },
                                    }
                                  );
                                }
                              }
                            }, 5000); // 5 second pause after connection completes
                          }, 3000);
                        } else if (
                          [
                            "navigate_thumbtack",
                            "navigate_openphone",
                          ].includes(part.action)
                        ) {
                          // Mark button as clicked FIRST
                          setNavigationButtonClicked(
                            (prev) => ({
                              ...prev,
                              [part.action]: true,
                            })
                          );

                          // Open URL in new tab if provided
                          if (part.url) {
                            window.open(
                              part.url,
                              "_blank"
                            );
                          }

                          // Use a small delay to ensure state updates before progressing
                          setTimeout(() => {
                            // Progress to next message and show it automatically
                            saveToAPIRef.current =
                              true;
                            const nextIndex =
                              currentMessageIndex +
                              1;
                            if (
                              nextIndex <
                              mockConversation.length
                            ) {
                              const nextMessage =
                                mockConversation[
                                nextIndex
                                ];
                              setStatus("ready");
                              appendMessage(
                                nextMessage
                              );
                              setCurrentMessageIndex(
                                nextIndex
                              );

                              // Broadcast the progress
                              if (
                                updateSourceRef.current ===
                                "self" &&
                                broadcastInstance
                              ) {
                                broadcastInstance.broadcastMessage(
                                  {
                                    type: "DEMO_PROGRESS",
                                    payload:
                                    {
                                      newIndex:
                                        nextIndex,
                                      newMessage:
                                        nextMessage,
                                      status: "ready",
                                      isUserMessageInPlaceholder:
                                        false,
                                    },
                                  }
                                );
                              }
                            }
                          }, 100);
                        } else if (
                          part.action ===
                          "start_capture"
                        ) {
                          // Start capture - show recording indicator
                          saveToAPIRef.current = true;
                          setWorkflowRecordingState(
                            "recording"
                          );

                          // Save recording state to Redis
                          updatePartialButtonStates({
                            agentRecordingState: "recording",
                          }).catch((error) => {
                            console.error("Error saving recording state:", error);
                          });

                          if (
                            window.parent &&
                            window.parent !== window
                          ) {
                            window.parent.postMessage(
                              {
                                action: "recordingStarted",
                                source: "stackbirds-app",
                              },
                              "*"
                            );
                          }

                          if (
                            updateSourceRef.current ===
                            "self" &&
                            broadcastInstance
                          ) {
                            broadcastInstance.broadcastMessage(
                              {
                                type: "WORKFLOW_RECORDING_STATE",
                                payload: {
                                  state: "recording",
                                },
                              }
                            );
                          }

                          setTimeout(() => {
                            // Progress to next message and show it automatically
                            saveToAPIRef.current =
                              true;
                            const nextIndex =
                              currentMessageIndex +
                              1;
                            if (
                              nextIndex <
                              mockConversation.length
                            ) {
                              const nextMessage =
                                mockConversation[
                                nextIndex
                                ];
                              setStatus("ready");
                              appendMessage(
                                nextMessage
                              );
                              setCurrentMessageIndex(
                                nextIndex
                              );

                              // Broadcast the progress
                              if (
                                updateSourceRef.current ===
                                "self" &&
                                broadcastInstance
                              ) {
                                broadcastInstance.broadcastMessage(
                                  {
                                    type: "DEMO_PROGRESS",
                                    payload:
                                    {
                                      newIndex:
                                        nextIndex,
                                      newMessage:
                                        nextMessage,
                                      status: "ready",
                                      isUserMessageInPlaceholder:
                                        false,
                                    },
                                  }
                                );
                              }
                            }
                          }, 100);
                        }
                      }}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${(part.action ===
                        "connect_thumbtack" ||
                        part.action ===
                        "connect_openphone") &&
                        connectionStates[
                        part.action.split("_")[1]
                        ] === "connected"
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : (part.action ===
                          "connect_thumbtack" ||
                          part.action ===
                          "connect_openphone") &&
                          connectionStates[
                          part.action.split(
                            "_"
                          )[1]
                          ] === "connecting"
                          ? "bg-blue-400 text-white cursor-wait"
                          : (part.action ===
                            "navigate_thumbtack" ||
                            part.action ===
                            "navigate_openphone") &&
                            navigationButtonClicked[
                            part.action
                            ]
                            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                            : part.action ===
                              "start_capture" &&
                              workflowRecordingState !==
                              "not_started"
                              ? "border border-border"
                              : "text-white"
                        }`}
                      style={
                        (part.action ===
                          "connect_thumbtack" ||
                          part.action ===
                          "connect_openphone") &&
                          connectionStates[
                          part.action.split("_")[1]
                          ] === "idle"
                          ? ({
                            backgroundColor:
                              "#365ccd",
                            "--hover-color":
                              "#2d4bb8",
                          } as React.CSSProperties & {
                            "--hover-color": string;
                          })
                          : (part.action ===
                            "connect_thumbtack" ||
                            part.action ===
                            "connect_openphone") &&
                            connectionStates[
                            part.action.split("_")[1]
                            ] === "connected"
                            ? {
                              backgroundColor:
                                "#333",
                              "--hover-color":
                                "#2d4bb8",
                              color: "white",
                            } as React.CSSProperties & {
                              "--hover-color": string;
                            }
                            : (part.action ===
                              "connect_thumbtack" ||
                              part.action ===
                              "connect_openphone") &&
                              connectionStates[
                              part.action.split("_")[1]
                              ] === "connecting"
                              ? {
                                backgroundColor:
                                  "#365ccd",
                                "--hover-color":
                                  "#2d4bb8",
                                color: "white",
                              } as React.CSSProperties & {
                                "--hover-color": string;
                              }
                              : (part.action ===
                                "navigate_thumbtack" ||
                                part.action ===
                                "navigate_openphone") &&
                                navigationButtonClicked[
                                part.action
                                ]
                                ? {}
                                : part.action ===
                                  "start_capture" &&
                                  workflowRecordingState !==
                                  "not_started"
                                  ? {}
                                  : ({
                                    backgroundColor:
                                      "#365ccd",
                                    "--hover-color":
                                      "#2d4bb8",
                                  } as React.CSSProperties & {
                                    "--hover-color": string;
                                  })
                      }
                      onMouseEnter={(e) => {
                        if (
                          (part.action ===
                            "connect_thumbtack" ||
                            part.action ===
                            "connect_openphone") &&
                          connectionStates[
                          part.action.split(
                            "_"
                          )[1]
                          ] === "idle"
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#2d4bb8";
                        } else if (
                          (part.action ===
                            "navigate_thumbtack" ||
                            part.action ===
                            "navigate_openphone") &&
                          !navigationButtonClicked[
                          part.action
                          ]
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#2d4bb8";
                        } else if (
                          part.action ===
                          "start_capture" &&
                          workflowRecordingState ===
                          "not_started"
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#2d4bb8";
                        } else if (
                          !(
                            part.action ===
                            "connect_thumbtack" ||
                            part.action ===
                            "connect_openphone"
                          ) &&
                          !(
                            part.action ===
                            "navigate_thumbtack" ||
                            part.action ===
                            "navigate_openphone"
                          ) &&
                          part.action !==
                          "start_capture"
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#2d4bb8";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (
                          (part.action ===
                            "connect_thumbtack" ||
                            part.action ===
                            "connect_openphone") &&
                          connectionStates[
                          part.action.split(
                            "_"
                          )[1]
                          ] === "idle"
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#365ccd";
                        } else if (
                          (part.action ===
                            "navigate_thumbtack" ||
                            part.action ===
                            "navigate_openphone") &&
                          !navigationButtonClicked[
                          part.action
                          ]
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#365ccd";
                        } else if (
                          part.action ===
                          "start_capture" &&
                          workflowRecordingState ===
                          "not_started"
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#365ccd";
                        } else if (
                          !(
                            part.action ===
                            "connect_thumbtack" ||
                            part.action ===
                            "connect_openphone"
                          ) &&
                          !(
                            part.action ===
                            "navigate_thumbtack" ||
                            part.action ===
                            "navigate_openphone"
                          ) &&
                          part.action !==
                          "start_capture"
                        ) {
                          e.currentTarget.style.backgroundColor =
                            "#365ccd";
                        }
                      }}
                      disabled={
                        ((part.action ===
                          "connect_thumbtack" ||
                          part.action ===
                          "connect_openphone") &&
                          (connectionStates[
                            part.action.split(
                              "_"
                            )[1]
                          ] === "connecting" ||
                            connectionStates[
                            part.action.split(
                              "_"
                            )[1]
                            ] === "connected")) ||
                        ((part.action ===
                          "navigate_thumbtack" ||
                          part.action ===
                          "navigate_openphone") &&
                          navigationButtonClicked[
                          part.action
                          ])
                      }
                    >
                      {(part.action ===
                        "connect_thumbtack" ||
                        part.action ===
                        "connect_openphone") &&
                        connectionStates[
                        part.action.split("_")[1]
                        ] === "connecting" ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Connecting...
                        </>
                      ) : (part.action ===
                        "connect_thumbtack" ||
                        part.action ===
                        "connect_openphone") &&
                        connectionStates[
                        part.action.split("_")[1]
                        ] === "connected" ? (
                        `Connected to ${part.text.replace(
                          "Connect ",
                          ""
                        )}`
                      ) : (
                        part.text
                      )}
                      {part.url && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
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

                    {/* Recording Control Bar - Show inline with Start capture button */}
                    {part.action === "start_capture" && (
                      <AnimatePresence>
                        {workflowRecordingState ===
                          "recording" && (
                            <motion.div
                              initial={{
                                opacity: 0,
                                x: -10,
                              }}
                              animate={{
                                opacity: 1,
                                x: 0,
                              }}
                              exit={{
                                opacity: 0,
                                x: -10,
                              }}
                              transition={{
                                duration: 0.3,
                              }}
                            >
                              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                                <motion.div
                                  className="w-2.5 h-2.5 bg-red-600 rounded-full"
                                  animate={{
                                    opacity: [
                                      1, 0.3,
                                      1,
                                    ],
                                  }}
                                  transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                  }}
                                />
                                <span className="text-sm font-semibold text-red-600">
                                  Recording
                                </span>
                                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                                  <button
                                    onClick={() => {
                                      saveToAPIRef.current =
                                        true;
                                      setWorkflowRecordingState(
                                        "paused"
                                      );

                                      // Send message to content script to show pause overlay
                                      if (
                                        window.parent &&
                                        window.parent !==
                                        window
                                      ) {
                                        window.parent.postMessage(
                                          {
                                            action: "recordingPaused",
                                            source: "stackbirds-app",
                                          },
                                          "*"
                                        );
                                      }
                                    }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Pause"
                                  >
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
                                      className="text-gray-600 dark:text-gray-400"
                                    >
                                      <rect
                                        x="6"
                                        y="4"
                                        width="4"
                                        height="16"
                                      />
                                      <rect
                                        x="14"
                                        y="4"
                                        width="4"
                                        height="16"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      saveToAPIRef.current =
                                        true;
                                      setWorkflowRecordingState(
                                        "not_started"
                                      );
                                    }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Stop"
                                  >
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
                                      className="text-gray-600 dark:text-gray-400"
                                    >
                                      <rect
                                        x="6"
                                        y="6"
                                        width="12"
                                        height="12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                        {workflowRecordingState ===
                          "paused" && (
                            <motion.div
                              initial={{
                                opacity: 0,
                                x: -10,
                              }}
                              animate={{
                                opacity: 1,
                                x: 0,
                              }}
                              exit={{
                                opacity: 0,
                                x: -10,
                              }}
                              transition={{
                                duration: 0.3,
                              }}
                            >
                              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                                <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-500">
                                  Paused
                                </span>
                                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                                  <button
                                    onClick={() => {
                                      saveToAPIRef.current =
                                        true;
                                      setWorkflowRecordingState(
                                        "recording"
                                      );
                                      if (
                                        window.parent &&
                                        window.parent !==
                                        window
                                      ) {
                                        window.parent.postMessage(
                                          {
                                            action: "recordingStarted",
                                            source: "stackbirds-app",
                                          },
                                          "*"
                                        );
                                      }

                                      if (
                                        updateSourceRef.current ===
                                        "self" &&
                                        broadcastInstance
                                      ) {
                                        broadcastInstance.broadcastMessage(
                                          {
                                            type: "WORKFLOW_RECORDING_STATE",
                                            payload:
                                            {
                                              state: "recording",
                                            },
                                          }
                                        );
                                      }
                                    }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Resume"
                                  >
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
                                      className="text-gray-600 dark:text-gray-400"
                                    >
                                      <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      saveToAPIRef.current =
                                        true;
                                      setWorkflowRecordingState(
                                        "not_started"
                                      );
                                    }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Stop"
                                  >
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
                                      className="text-gray-600 dark:text-gray-400"
                                    >
                                      <rect
                                        x="6"
                                        y="6"
                                        width="12"
                                        height="12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                      </AnimatePresence>
                    )}
                  </div>
                );
              case "link":
                return (
                  <div
                    key={`${message.id}-${i}`}
                    className="flex justify-start mb-6 ml-10"
                  >
                    <a
                      href={
                        part.url ||
                        `https://${part.text}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={
                        {
                          backgroundColor: "#365ccd",
                          "--hover-color": "#2d4bb8",
                        } as React.CSSProperties & {
                          "--hover-color": string;
                        }
                      }
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "#2d4bb8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "#365ccd";
                      }}
                    >
                      {part.text}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
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
                    className="mb-2"
                  >
                    {/* Avatar with pulsing red border */}
                    <div className="relative">
                      <motion.div
                        className="absolute -inset-0.5 rounded-full"
                        animate={{
                          scale: [1, 1.15, 1],
                          opacity: [0.5, 0.8, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <div className="w-full h-full rounded-full bg-red-500 blur-sm" />
                      </motion.div>
                      <motion.div
                        className="absolute -inset-1 rounded-full border-2 border-red-500"
                        animate={{
                          scale: [1, 1.1, 1],
                          opacity: [0.6, 1, 0.6],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <MessageAvatar
                        src=""
                        name="SA"
                        className="relative z-10"
                      />
                    </div>

                    {/* Subtle message content */}
                    <MessageContent>
                      <TextWithLinks
                        text={part.message}
                      />
                    </MessageContent>

                    <AnimatePresence>
                      {workflowRecordingState ===
                        "recording" && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              x: -10,
                            }}
                            animate={{
                              opacity: 1,
                              x: 0,
                            }}
                            exit={{
                              opacity: 0,
                              x: -10,
                            }}
                            transition={{
                              duration: 0.3,
                            }}
                          >
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                              <motion.div
                                className="w-2.5 h-2.5 bg-red-600 rounded-full"
                                animate={{
                                  opacity: [
                                    1, 0.3,
                                    1,
                                  ],
                                }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              />
                              <span className="text-sm font-semibold text-red-600">
                                Recording
                              </span>
                              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                                <button
                                  onClick={() => {
                                    saveToAPIRef.current =
                                      true;
                                    setWorkflowRecordingState(
                                      "paused"
                                    );

                                    // Send message to content script to show pause overlay
                                    if (
                                      window.parent &&
                                      window.parent !==
                                      window
                                    ) {
                                      window.parent.postMessage(
                                        {
                                          action: "recordingPaused",
                                          source: "stackbirds-app",
                                        },
                                        "*"
                                      );
                                    }
                                  }}
                                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                  title="Pause"
                                >
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
                                    className="text-gray-600 dark:text-gray-400"
                                  >
                                    <rect
                                      x="6"
                                      y="4"
                                      width="4"
                                      height="16"
                                    />
                                    <rect
                                      x="14"
                                      y="4"
                                      width="4"
                                      height="16"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    saveToAPIRef.current =
                                      true;
                                    setWorkflowRecordingState(
                                      "not_started"
                                    );
                                  }}
                                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                  title="Stop"
                                >
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
                                    className="text-gray-600 dark:text-gray-400"
                                  >
                                    <rect
                                      x="6"
                                      y="6"
                                      width="12"
                                      height="12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                      {workflowRecordingState ===
                        "paused" && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              x: -10,
                            }}
                            animate={{
                              opacity: 1,
                              x: 0,
                            }}
                            exit={{
                              opacity: 0,
                              x: -10,
                            }}
                            transition={{
                              duration: 0.3,
                            }}
                          >
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
                              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                              <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-500">
                                Paused
                              </span>
                              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                                <button
                                  onClick={() => {
                                    saveToAPIRef.current =
                                      true;
                                    setWorkflowRecordingState(
                                      "recording"
                                    );
                                    if (
                                      window.parent &&
                                      window.parent !==
                                      window
                                    ) {
                                      window.parent.postMessage(
                                        {
                                          action: "recordingStarted",
                                          source: "stackbirds-app",
                                        },
                                        "*"
                                      );
                                    }

                                    if (
                                      updateSourceRef.current ===
                                      "self" &&
                                      broadcastInstance
                                    ) {
                                      broadcastInstance.broadcastMessage(
                                        {
                                          type: "WORKFLOW_RECORDING_STATE",
                                          payload:
                                          {
                                            state: "recording",
                                          },
                                        }
                                      );
                                    }
                                  }}
                                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                  title="Resume"
                                >
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
                                    className="text-gray-600 dark:text-gray-400"
                                  >
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    saveToAPIRef.current =
                                      true;
                                    setWorkflowRecordingState(
                                      "not_started"
                                    );
                                  }}
                                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                  title="Stop"
                                >
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
                                    className="text-gray-600 dark:text-gray-400"
                                  >
                                    <rect
                                      x="6"
                                      y="6"
                                      width="12"
                                      height="12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                    </AnimatePresence>
                  </Message>
                );
              case "reasoning":
                return (
                  <Reasoning
                    key={`${message.id}-${i}`}
                    className="w-full"
                    isStreaming={
                      status === "streaming" &&
                      i === message.parts.length - 1 &&
                      message.id === messages.at(-1)?.id
                    }
                  >
                    <ReasoningTrigger />
                    <ReasoningContent>
                      {part.text}
                    </ReasoningContent>
                  </Reasoning>
                );
              case "text-image":
                return (
                  <MessageImage
                    key={`${message.id}-${i}`}
                    from={message.role}
                    text={part.text}
                    url={part.url}
                    link={part.link}
                    className="mb-2"
                  />
                );
              case "voice":
                return (
                  <Fragment key={`${message.id}-${i}`}>
                    <Message
                      from={message.role}
                      className="mb-2"
                    >
                      {message.role === "user" ? (
                        <>
                          <MessageContent>
                            <TextWithLinks
                              text={
                                part.dummyText
                              }
                            />
                          </MessageContent>
                          <MessageAvatar
                            src=""
                            name="ZG"
                          />
                        </>
                      ) : (
                        <>
                          <MessageAvatar
                            src=""
                            name={
                              message.role ===
                                "ai-agent"
                                ? "SA"
                                : "A"
                            }
                          />
                          <MessageContent>
                            <TextWithLinks
                              text={
                                part.dummyText
                              }
                            />
                          </MessageContent>
                        </>
                      )}
                    </Message>
                  </Fragment>
                );
              default:
                return null;
            }
          })}
        </motion.div>
      ))}
      {status === "submitted" && <Loader />}
    </>
  );

  // Handle text input submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !input.trim() ||
      !demoModeActive ||
      currentMessageIndex >= mockConversation.length
    )
      return;

    const currentMessage = mockConversation[currentMessageIndex];
    if (currentMessage.role !== "user") return;

    // Mark as user action
    saveToAPIRef.current = true;

    // Create user message
    const userMessage: CustomUIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: input.trim() }],
    };

    const newIndex = currentMessageIndex + 1;
    setIsUserMessageInPlaceholder(false);
    appendMessage(userMessage);
    setCurrentMessageIndex(newIndex);
    setInput("");

    // Broadcast the user message and progress
    if (updateSourceRef.current === "self" && broadcastInstance) {
      broadcastInstance.broadcastMessage({
        type: "USER_MESSAGE_SUBMITTED",
        payload: { message: userMessage, newIndex },
      });
    }
  };

  // Render sticky input section
  const renderInputSection = () => (
    <div className="sticky bottom-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border/40 py-4 px-6">
      <AnimatePresence mode="wait">
        {recordingState === "recording" ? (
          // Show audio visualizer when recording
          <motion.div
            key="audio-visualizer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 h-24">
                <AudioVisualizer
                  stream={mediaStream}
                  isRecording={recordingState === "recording"}
                  onClick={() => { }}
                />
              </div>
              <button
                onClick={handleCrossButtonClick}
                className="flex items-center justify-center w-12 h-12 rounded-full  text-green transition-all shadow-md hover:shadow-lg hover:bg-green-600 hover:text-white duration-300"
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
            </div>
          </motion.div>
        ) : (
          // Show input box with plus, input field, and mic icon
          <motion.div
            key="input-box"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="max-w-4xl mx-auto"
          >
            <form onSubmit={handleTextSubmit} className="relative">
              <div className="flex items-center gap-2 w-full rounded-full border border-border/40 bg-background shadow-sm px-4 py-3 focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-all">
                {/* Plus icon for attachments */}
                <button
                  type="button"
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
                  aria-label="Add attachment"
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
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                </button>

                {/* Input field */}
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything"
                  disabled={
                    !shouldShowInput ||
                    status === "streaming"
                  }
                  className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground shadow-none"
                />

                {/* Microphone/Send icon button */}
                <div className="flex items-center gap-2">
                  {input.trim() ? (
                    // Show send icon when there's text
                    <button
                      type="submit"
                      disabled={
                        !shouldShowInput ||
                        status === "streaming"
                      }
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Send message"
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
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    </button>
                  ) : (
                    // Show microphone icon when no text
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      disabled={
                        !shouldShowInput ||
                        status === "streaming"
                      }
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Start recording"
                    >
                      <motion.svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={
                          isUserTurnToSpeak &&
                            !isRecording
                            ? {
                              rotate: [
                                0, -8, 8, -8, 0,
                              ],
                            }
                            : { rotate: 0 }
                        }
                        transition={
                          isUserTurnToSpeak &&
                            !isRecording
                            ? {
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                            : { duration: 0.2 }
                        }
                      >
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line
                          x1="12"
                          x2="12"
                          y1="19"
                          y2="22"
                        />
                      </motion.svg>
                    </button>
                  )}

                  {/* Audio visualizer icon (when recording state is paused or idle but mic section should show) */}
                  {recordingState === "paused" && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                      <div className="flex gap-0.5 items-end">
                        <div
                          className="w-1 bg-foreground rounded-full"
                          style={{ height: "8px" }}
                        />
                        <div
                          className="w-1 bg-foreground rounded-full"
                          style={{ height: "12px" }}
                        />
                        <div
                          className="w-1 bg-foreground rounded-full"
                          style={{ height: "16px" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <LayoutGroup>
      <div className="max-w-7xl p-4 md:p-0 mx-auto relative size-full min-h-screen flex flex-col">
        {/* Show Header always */}
        {!isMobile && !isExtension && <Header />}

        {/* Mobile Tabs - Show on mobile width (including narrow extension sidebars) */}
        {isMobile && (
          <div className="flex flex-col flex-1 min-h-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full flex flex-col flex-1 min-h-0"
            >
              {messages.some((m) => m.id === "msg-16") && (
                <TabsList className="grid w-full grid-cols-2 flex-shrink-0 sticky top-0 z-10 bg-[#ddd] text-white px-2 py-1 gap-0 h-12">
                  <TabsTrigger
                    value="chat"
                    className="text-black data-[state=active]:text-black data-[state=active]:bg-white px-4 py-2 transition-all duration-200 ease-in-out"
                  >
                    Chat
                  </TabsTrigger>
                  <TabsTrigger
                    value="profile"
                    className="data-[state=active]:bg-[#f5f5f5] data-[state=active]:text-foreground px-4 py-2 transition-all duration-200 ease-in-out"
                  >
                    Business Profile
                  </TabsTrigger>
                </TabsList>
              )}

              <TabsContent
                value="chat"
                className="mt-0 flex-1 flex flex-col min-h-0 transition-all duration-200 ease-in-out"
              >
                <div className="flex flex-col flex-1 min-h-0">
                  <Conversation className="flex-1 min-h-0">
                    <ConversationContent>
                      {renderConversationMessages()}
                      {/* Manual progression indicator */}
                      {/* {waitingForManualProgression && (
                        <div className="flex justify-center py-4 opacity-20">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 text-blue-700">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium">Press "0" to continue</span>
                          </div>
                        </div>
                      )} */}
                      <AutoScrollHandler />
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>
                </div>
                {renderInputSection()}
              </TabsContent>

              <TabsContent
                value="profile"
                className="mt-0 flex-1 flex flex-col min-h-0 transition-all duration-200 ease-in-out"
              >
                {/* Business Profile content - wrapped in scrollable container for consistency */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {showSummary && summaryData ? (
                    <>
                      <ExtensionSummary
                        heading={summaryData.heading}
                        subheading={
                          summaryData.subheading
                        }
                        messages={summaryMessages}
                      />
                      {showApps &&
                        appStatuses.length > 0 && (
                          <div className="mt-4">
                            <AppIntegrations
                              apps={appStatuses}
                            />
                          </div>
                        )}
                      {showWorkflows &&
                        workflows.length > 0 && (
                          <div className="mt-4">
                            <Workflows
                              workflows={
                                workflows
                              }
                            />
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center min-h-full">
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
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        No Business Profile Yet
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Start a conversation with the
                        assistant to create your
                        business profile. Your
                        information will appear here
                        once it's collected.
                      </p>
                      <button
                        onClick={() =>
                          setActiveTab("chat")
                        }
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Start Chat
                      </button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Extension mode only - Show sidebar layout when in extension and desktop width */}
        {!isMobile && isExtension && (
          <div className="flex flex-1 min-h-0 gap-6">
            {/* Main chat area - 2/3 width */}
            <div className="w-2/3 flex-shrink-0 flex flex-col min-h-0">
              <Conversation className="flex-1 min-h-0">
                <ConversationContent>
                  {renderConversationMessages()}
                  <AutoScrollHandler />
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
              {renderInputSection()}
            </div>

            {/* Sidebar - 1/3 width */}
            <div className="w-1/3 flex-shrink-0 flex flex-col min-h-0">
              <RecordingIndicator
                recordingState={workflowRecordingState}
              />

              {showSummary && summaryData && (
                <div className="flex-shrink-0 mb-4">
                  <ExtensionSummary
                    heading={summaryData.heading}
                    subheading={summaryData.subheading}
                    messages={summaryMessages}
                  />
                </div>
              )}

              {showApps && appStatuses.length > 0 && (
                <div className="flex-shrink-0 mb-4">
                  <AppIntegrations apps={appStatuses} />
                </div>
              )}

              {showWorkflows && workflows.length > 0 && (
                <div className="flex-shrink-0 mb-4">
                  <Workflows workflows={workflows} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Desktop conversation - Hide on mobile and when extension is on localhost/deployed app */}
        {!isMobile && !(isExtension && isOnOwnDomain) && (
          <motion.div
            layoutId="conversation-container"
            layout="position"
            className="flex flex-col flex-1 min-h-0 px-6 will-change-transform"
            initial={false}
            animate={{
              paddingTop: 16,
            }}
            transition={{
              layout: { duration: 1, ease: [0.16, 1, 0.3, 1] },
            }}
          >
            <motion.div
              layoutId="conversation-content"
              layout="position"
              className="flex-1 flex flex-col min-h-0 will-change-transform"
              transition={{
                layout: {
                  duration: 1,
                  ease: [0.16, 1, 0.3, 1],
                },
              }}
            >
              <Conversation className="flex-1 min-h-0">
                <ConversationContent>
                  {renderConversationMessages()}
                  {/* Manual progression indicator */}
                  {/* {waitingForManualProgression && (
                    <div className="flex justify-center py-4 opacity-20">
                      <div className="opacity-20 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 text-blue-700">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Press "0" to continue</span>
                      </div>
                    </div>
                  )} */}
                  <AutoScrollHandler />
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </motion.div>
            {renderInputSection()}
          </motion.div>
        )}
      </div>
    </LayoutGroup>
  );
};

export default ChatBotDemo;
