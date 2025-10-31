import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"] | "ai-agent";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-center gap-2 py-1",
      from === "user"
        ? "is-user justify-end"
        : from === "ai-agent"
          ? "is-ai-agent justify-start" // New: align left for ai-agent
          : "is-assistant justify-start",
      className
    )}
    {...props}
  />
);

const messageContentVariants = cva(
  "flex flex-col gap-2 overflow-hidden rounded-lg text-sm",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[80%] px-4 py-3",
          "group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:[&_*]:text-foreground", // Switched to secondary
          "group-[.is-assistant]:bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 group-[.is-assistant]:text-black group-[.is-assistant]:[&_*]:text-black border-2 border-white", // Switched to primary
          "group-[.is-ai-agent]:text-foreground group-[.is-ai-agent]:[&_*]:text-foreground", // Plain text - no background
        ],
        flat: [
          "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-primary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-primary-foreground group-[.is-user]:[&_*]:text-primary-foreground", // Switched to primary
          "group-[.is-assistant]:bg-secondary group-[.is-assistant]:px-4 group-[.is-assistant]:py-3 group-[.is-assistant]:text-foreground group-[.is-assistant]:[&_*]:text-foreground", // Switched to secondary
          "group-[.is-ai-agent]:text-foreground group-[.is-ai-agent]:[&_*]:text-foreground", // Plain text - no background
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  }
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(messageContentVariants({ variant, className }))}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("size-8 ring-1 ring-border", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);
