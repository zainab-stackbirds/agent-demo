"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "motion/react";

interface ExtensionSummaryProps {
  heading: string;
  subheading: string;
  messages: string[];
}

export const ExtensionSummary = ({ heading, subheading, messages }: ExtensionSummaryProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mb-3"
    >
      <Card className="border-primary/10 bg-gradient-to-br from-background/95 via-background to-muted/10">
        <CardContent className="px-3 py-2 sm:px-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]">
            {heading}
          </h3>
          <p className="mb-3 text-[0.72rem] text-muted-foreground/70 leading-tight">
            {subheading.replace(/\\n/g, "\n")}
          </p>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -16, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 16, scale: 0.95 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.08,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                >
                  <div className="group relative flex items-start gap-3 rounded-lg border border-muted/20 bg-muted/10 py-2.5 transition-all duration-300 backdrop-blur">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          delay: index * 0.08 + 0.18
                        }}
                        className="text-[0.78rem] leading-tight text-foreground/90 font-medium whitespace-pre-line break-words"
                      >
                        {message.replace(/\\n/g, "\n")}
                      </motion.p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
