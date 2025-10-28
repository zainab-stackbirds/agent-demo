"use client";

import { cn } from "@/lib/utils";
import { SparklesIcon, CheckCircleIcon, ArrowRightIcon } from "lucide-react";
import type { ComponentProps } from "react";

export type SystemEventProps = ComponentProps<"div"> & {
    event: "agent-joined" | "agent-left" | "task-created";
    agentName?: string;
    metadata?: Record<string, any>;
};

const eventConfig = {
    "agent-joined": {
        icon: SparklesIcon,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        borderColor: "border-blue-200 dark:border-blue-800",
    },
    "agent-left": {
        icon: ArrowRightIcon,
        color: "text-gray-600 dark:text-gray-400",
        bgColor: "bg-gray-50 dark:bg-gray-950/30",
        borderColor: "border-gray-200 dark:border-gray-800",
    },
    "task-created": {
        icon: CheckCircleIcon,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
    },
};

export const SystemEvent = ({
    className,
    event,
    agentName = "AI Agent",
    metadata,
    ...props
}: SystemEventProps) => {
    const config = eventConfig[event];
    const Icon = config.icon;

    const getMessage = () => {
        switch (event) {
            case "agent-joined":
                return `${agentName} has entered the conversation`;
            case "agent-left":
                return `${agentName} has left the conversation`;
            case "task-created":
                return `Task created: ${metadata?.taskName || "Untitled"}`;
            default:
                return "System event";
        }
    };

    return (
        <div
            className={cn(
                "flex items-center justify-center gap-2 my-6",
                "animate-in fade-in-0 slide-in-from-top-2 duration-500",
                className
            )}
            {...props}
        >
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border-2",
                    "text-sm font-medium",
                    config.color,
                    config.bgColor,
                    config.borderColor,
                    "shadow-sm"
                )}
            >
                <Icon className="size-4 animate-pulse" />
                <span>{getMessage()}</span>
            </div>

            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
    );
};