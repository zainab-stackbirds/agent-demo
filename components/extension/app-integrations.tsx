"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Circle } from "lucide-react";

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
      className="mb-4"
    >
      <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Required Apps
            </h3>
            <AnimatePresence mode="popLayout">
              {apps.map((app, index) => {
                const metadata = APP_METADATA[app.app_id];
                if (!metadata) return null;

                return (
                  <motion.div
                    key={app.app_id}
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.15,
                      ease: [0.23, 1, 0.32, 1], // Custom easing for smooth animation
                    }}
                    className="relative"
                  >
                    <div
                      className={`
                        flex items-center gap-4 p-4 rounded-lg
                        transition-all duration-300
                        ${app.enabled
                          ? 'bg-primary/10 border-2 border-primary/30 shadow-sm'
                          : 'bg-muted/50 border-2 border-muted/50'
                        }
                      `}
                    >
                      {/* App Logo with animation */}
                      <motion.div
                        initial={{ rotate: -10, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: index * 0.15 + 0.2,
                          type: "spring",
                          stiffness: 200,
                          damping: 15
                        }}
                        className="relative"
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-md"
                          style={{
                            borderColor: metadata.color,
                            borderWidth: app.enabled ? '2px' : '0px'
                          }}
                        >
                          <img
                            src={metadata.logo}
                            alt={metadata.name}
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                              // Fallback to first letter if logo fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = document.createElement('div');
                              fallback.textContent = metadata.name.charAt(0);
                              fallback.className = 'w-full h-full flex items-center justify-center text-xl font-bold';
                              fallback.style.color = metadata.color;
                              target.parentElement?.appendChild(fallback);
                            }}
                          />
                        </div>

                        {/* Animated ring on enabled */}
                        {app.enabled && (
                          <motion.div
                            initial={{ scale: 1, opacity: 0.8 }}
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.8, 0.3, 0]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeOut"
                            }}
                            className="absolute inset-0 rounded-xl"
                            style={{
                              border: `2px solid ${metadata.color}`,
                            }}
                          />
                        )}
                      </motion.div>

                      {/* App Name */}
                      <div className="flex-1">
                        <motion.h4
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.15 + 0.3
                          }}
                          className="font-semibold text-foreground"
                        >
                          {metadata.name}
                        </motion.h4>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{
                            duration: 0.3,
                            delay: index * 0.15 + 0.4
                          }}
                          className={`text-sm ${app.enabled ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                          {app.enabled ? 'Connected' : 'Not connected'}
                        </motion.p>
                      </div>

                      {/* Status Icon with animation */}
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          duration: 0.5,
                          delay: index * 0.15 + 0.3,
                          type: "spring",
                          stiffness: 200,
                          damping: 15
                        }}
                      >
                        {app.enabled ? (
                          <CheckCircle2
                            className="w-6 h-6 text-primary"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <Circle
                            className="w-6 h-6 text-muted-foreground"
                            strokeWidth={2}
                          />
                        )}
                      </motion.div>
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
