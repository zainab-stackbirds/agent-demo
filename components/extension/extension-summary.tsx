"use client";

import { Card, CardContent } from "@/components/ui/card";

interface ExtensionSummaryProps {
  heading: string;
  subheading: string;
  messages: string[];
}

export const ExtensionSummary = ({ heading, subheading, messages }: ExtensionSummaryProps) => {
  return (
    <div className="mb-3">
      <Card className="border-primary/10 bg-gradient-to-br from-background/95 via-background to-muted/10">
        <CardContent className="px-3 py-2 sm:px-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]">
            {heading}
          </h3>
          <p className="mb-3 text-[0.72rem] text-muted-foreground/70 leading-tight">
            {subheading.replace(/\\n/g, "\n")}
          </p>
          <div className="space-y-1.5">
            {messages.map((message, index) => (
              <div key={index}>
                <div className="group relative flex items-start gap-3 rounded-lg border border-muted/20 bg-muted/10 py-2.5 transition-all duration-300 backdrop-blur">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.78rem] leading-tight text-foreground/90 font-medium whitespace-pre-line break-words">
                      {message.replace(/\\n/g, "\n")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
