import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import Image from "next/image";
import type { ComponentProps, HTMLAttributes } from "react";
import { Message, MessageContent, } from "./message";


export type MessageImageProps = HTMLAttributes<HTMLDivElement> & {
    from: UIMessage["role"] | "ai-agent";
    text: string;
    url: string;
    link?: string;
};

const messageImageContentVariants = cva(
    "flex flex-col gap-3 overflow-hidden rounded-lg text-sm",
    {
        variants: {
            variant: {
                contained: [
                    "max-w-[100%] px-4 pb-3",
                    "group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:[&_*]:text-foreground",
                    "group-[.is-assistant]:bg-primary group-[.is-assistant]:text-primary-foreground group-[.is-assistant]:[&_*]:text-primary-foreground",
                    "group-[.is-ai-agent]:text-foreground group-[.is-ai-agent]:[&_*]:text-foreground",
                ],
                flat: [
                    "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-primary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-primary-foreground group-[.is-user]:[&_*]:text-primary-foreground",
                    "group-[.is-assistant]:bg-secondary group-[.is-assistant]:px-4 group-[.is-assistant]:py-3 group-[.is-assistant]:text-foreground group-[.is-assistant]:[&_*]:text-foreground",
                    "group-[.is-ai-agent]:text-foreground group-[.is-ai-agent]:[&_*]:text-foreground",
                ],
            },
        },
        defaultVariants: {
            variant: "contained",
        },
    }
);

export type MessageImageContentProps = HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof messageImageContentVariants>;

export const MessageImageContent = ({
    children,
    className,
    variant,
    ...props
}: MessageImageContentProps) => (
    <div
        className={cn(messageImageContentVariants({ variant, className }))}
        {...props}
    >
        {children}
    </div>
);

export const MessageImage = ({
    className,
    from,
    text,
    url,
    link,
    ...props
}: MessageImageProps) => (
    <div
        className={cn(
            "group flex w-full items-start gap-2 py-1",
            from === "user"
                ? "is-user justify-end"
                : from === "ai-agent"
                    ? "is-ai-agent justify-start"
                    : "is-assistant justify-start",
            className
        )}
        {...props}
    >
        {/* Avatar */}
        {from !== "user" && (
            <MessageImageAvatar
                src=""
                name={from === "ai-agent" ? "SA" : "A"}
            />
        )}

        {/* Content */}
        <div className="flex flex-col gap-2 max-w-[80%]">
            {/* Text content - only show if text is not empty */}
            {text && text.trim() !== "" && (
                <Message from={from === "ai-agent" ? "ai-agent" : "user"}>
                    <MessageContent className="font-mono flex flex-row items-start">
                        {text}
                    </MessageContent>
                </Message>
            )}

            {/* Image */}
            <div
                className={cn(
                    "relative overflow-hidden rounded-lg border border-border group/image",
                    from === "user" ? "ml-auto" : "mr-auto",
                    text && text.trim() !== "" ? "max-w-[500px]" : "max-w-[500px]"
                )}
            >
                <Image
                    width={500}
                    height={500}
                    src={url}
                    alt="Message image"
                    className="w-full h-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                    style={{ maxHeight: "300px" }}
                    onClick={() => {
                        // Open link in new tab when clicked (fallback to image URL)
                        window.open(link || url, '_blank');
                    }}
                />

                {/* Click overlay */}
                {link && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-80 group-hover/image:opacity-100 transition-opacity duration-200">
                        <div className="flex items-center justify-center gap-2 text-white text-sm font-medium">
                            Click to visit website
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
                                <path d="M7 7h10v10" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* User Avatar */}
        {from === "user" && (
            <MessageImageAvatar
                src=""
                name="ZG"
            />
        )}
    </div>
);

export type MessageImageAvatarProps = ComponentProps<typeof Avatar> & {
    src: string;
    name?: string;
};

export const MessageImageAvatar = ({
    src,
    name,
    className,
    ...props
}: MessageImageAvatarProps) => (
    <Avatar className={cn("size-8 ring-1 ring-border flex-shrink-0", className)} {...props}>
        <AvatarImage alt="" className="mt-0 mb-0" src={src} />
        <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
    </Avatar>
);
