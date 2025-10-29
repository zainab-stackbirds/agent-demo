"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "motion/react";

interface ExtensionSummaryProps {
  heading: string;
  subheading: string;
  messages: string[];
}

export const ExtensionSummary = ({ heading, subheading, messages }: ExtensionSummaryProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-4"
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold whitespace-pre-line">
            {heading.replace(/\\n/g, "\n")}
          </CardTitle>
          <CardDescription className="text-sm whitespace-pre-line">
            {subheading.replace(/\\n/g, "\n")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.1,
                    ease: "easeOut"
                  }}
                  className="flex items-start gap-2 rounded-md bg-background/50 p-2"
                >
                  <div className="mt-1.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line break-words">
                    {message.replace(/\\n/g, "\n")}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
