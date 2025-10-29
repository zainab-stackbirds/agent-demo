"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "motion/react";

interface AppIntegrationsProps {
  apps: Array<{ app_id: string; enabled: boolean }>;
}

// App metadata with logos and names
const APP_METADATA: Record<string, { name: string; logo: string; color: string }> = {
  thumbtack: {
    name: "Thumbtack",
    logo: "https://logo.clearbit.com/thumbtack.com",
    color: "#009fd9"
  },
  openphone: {
    name: "OpenPhone",
    logo: "https://logo.clearbit.com/openphone.com",
    color: "#5b47fb"
  },
  "google-docs": {
    name: "Google Docs",
    logo: "https://logo.clearbit.com/docs.google.com",
    color: "#4285f4"
  }
};

export const AppIntegrations = ({ apps }: AppIntegrationsProps) => {
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
            Required Apps
          </h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
            <AnimatePresence mode="popLayout">
              {apps.map((app, index) => {
                const metadata = APP_METADATA[app.app_id];
                if (!metadata) return null;

                const accentColor = metadata.color;
                const isConnected = app.enabled;

                return (
                  <motion.div
                    key={app.app_id}
                    initial={{ opacity: 0, x: -16, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 16, scale: 0.95 }}
                    transition={{
                      duration: 0.35,
                      delay: index * 0.12,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    // className="w-[8.5rem]"
                  >
                    <div
                      aria-disabled={!isConnected}
                      className={`group relative flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-all duration-300 backdrop-blur
                        ${isConnected
                          ? 'border-primary/30 bg-primary/5 opacity-90 hover:opacity-100'
                          : 'border-muted/40 bg-muted/60 opacity-45 cursor-not-allowed'
                        }
                      `}
                      style={{
                        boxShadow: isConnected ? `0 6px 16px -12px ${accentColor}` : undefined,
                        borderColor: isConnected ? `${accentColor}33` : undefined
                      }}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        {/* App Logo with animation */}
                        <motion.div
                          initial={{ rotate: -8, scale: 0.9 }}
                          animate={{ rotate: 0, scale: 1 }}
                          transition={{
                            duration: 0.45,
                            delay: index * 0.12 + 0.18,
                            type: "spring",
                            stiffness: 200,
                            damping: 16
                          }}
                          className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/90 shadow-sm ring-1 ring-black/5"
                          style={{ border: isConnected ? `1px solid ${accentColor}` : undefined }}
                        >
                          <img
                            src={metadata.logo}
                            alt={metadata.name}
                            className="h-6 w-6 object-contain"
                            onError={(e) => {
                              // Fallback to first letter if logo fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = document.createElement('div');
                              fallback.textContent = metadata.name.charAt(0);
                              fallback.className = 'w-full h-full flex items-center justify-center text-lg font-semibold';
                              fallback.style.color = metadata.color;
                              target.parentElement?.appendChild(fallback);
                            }}
                          />
                        </motion.div>

                        <motion.h4
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.25,
                            delay: index * 0.12 + 0.24
                          }}
                          className="max-w-[5.5rem] text-center text-[0.72rem] font-medium leading-tight text-foreground"
                        >
                          {metadata.name}
                        </motion.h4>
                      </div>

                      <span className="sr-only">
                        {isConnected ? `${metadata.name} connected` : `${metadata.name} not connected`}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
