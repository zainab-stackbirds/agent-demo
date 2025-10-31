"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "motion/react";

interface WorkflowsProps {
  workflows: Array<{
    id: string;
    workflow: string;
    category?: string;
    isNew?: boolean;
    isPretrained?: boolean;
  }>;
}

// Predefined workflow categories with colors and icons
const WORKFLOW_CATEGORIES: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  "lead-management": {
    color: "#10b981",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m22 2-5 10-7-5" />
      </svg>
    ),
    label: "Lead Management"
  },
  "communication": {
    color: "#3b82f6",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "Communication"
  },
  "automation": {
    color: "#8b5cf6",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
      </svg>
    ),
    label: "Automation"
  },
  "analysis": {
    color: "#f59e0b",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" x2="18" y1="20" y2="4" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="16" />
      </svg>
    ),
    label: "Analysis"
  },
  "default": {
    color: "#6b7280",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    label: "General"
  }
};

export const Workflows = ({ workflows }: WorkflowsProps) => {
  if (workflows.length === 0) return null;

  // Sort workflows: newly learned first, then previously learned, then pre-trained
  const sortedWorkflows = [...workflows].sort((a, b) => {
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    if (!a.isPretrained && b.isPretrained) return -1;
    if (a.isPretrained && !b.isPretrained) return 1;
    return 0;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mb-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em]">
        Learned Workflows
      </h3>
      <Card className="bg-transparent border-none shadow-none mt-0 py-2">
        <CardContent className="p-0">
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {sortedWorkflows.map((workflow, index) => {
                const shouldAnimateIn = workflow.isNew === true;

                const category = WORKFLOW_CATEGORIES[workflow.category || "default"];
                const isRecent = workflow.isNew === true;
                const isPretrained = workflow.isPretrained === true;

                return (
                  <motion.div
                    className="w-full"
                    key={workflow.id}
                    initial={shouldAnimateIn ? { opacity: 0, x: -16, scale: 0.95 } : false}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 16, scale: 0.95 }}
                    transition={shouldAnimateIn
                      ? {
                        duration: 0.35,
                        delay: index * 0.08,
                        ease: [0.23, 1, 0.32, 1],
                      }
                      : undefined
                    }
                  >
                    <div
                      className={`group relative flex items-start gap-3 rounded-lg border px-3 py-2.5 pt-4 transition-all duration-300 bg-white min-h-[70px]
                        ${isRecent
                          ? 'border-primary/50 bg-gradient-to-r from-primary/12 to-primary/8 shadow-md ring-1 ring-primary/20'
                          : isPretrained
                            ? 'border-muted/30 bg-muted/20'
                            : 'border-muted/20 bg-muted/10'
                        }
                      `}
                      style={{
                        boxShadow: isRecent ? `0 6px 16px -8px ${category.color}40` : undefined,
                        borderColor: isRecent ? `${category.color}50` : undefined
                      }}
                    >
                      {/* Category Icon */}
                      <motion.div
                        initial={shouldAnimateIn ? { scale: 0.8, rotate: -8 } : false}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={shouldAnimateIn
                          ? {
                            duration: 0.45,
                            delay: index * 0.08 + 0.12,
                            type: "spring",
                            stiffness: 200,
                            damping: 16
                          }
                          : undefined
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-sm shadow-sm ring-1 ring-black/5"
                        style={{
                          backgroundColor: isRecent ? `${category.color}20` : undefined,
                          borderColor: isRecent ? `${category.color}40` : undefined,
                          color: isRecent ? category.color : isPretrained ? '#6b7280' : category.color
                        }}
                      >
                        {category.icon}
                      </motion.div>

                      {/* Workflow Text */}
                      <div className="flex-1 min-w-0">
                        <motion.p
                          initial={shouldAnimateIn ? { opacity: 0, y: 4 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={shouldAnimateIn
                            ? {
                              duration: 0.25,
                              delay: index * 0.08 + 0.18
                            }
                            : undefined
                          }
                          className="text-[0.78rem] leading-tight text-foreground/90 font-medium"
                        >
                          {workflow.workflow}
                        </motion.p>

                        {/* Category label */}
                        <motion.div
                          initial={shouldAnimateIn ? { opacity: 0 } : false}
                          animate={{ opacity: 1 }}
                          transition={shouldAnimateIn
                            ? {
                              duration: 0.2,
                              delay: index * 0.08 + 0.24
                            }
                            : undefined
                          }
                          className="text-[0.65rem] text-muted-foreground/70 font-medium mt-0.5 block my-auto"
                        >
                          {category.label}
                        </motion.div>
                      </div>

                      {/* Status indicators */}
                      <div className="flex items-center gap-1.5">
                        {isRecent && (
                          <motion.div
                            initial={shouldAnimateIn ? { scale: 0, opacity: 0 } : false}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={shouldAnimateIn
                              ? {
                                duration: 0.3,
                                delay: index * 0.08 + 0.3,
                                type: "spring",
                                stiffness: 400,
                                damping: 20
                              }
                              : undefined
                            }
                            className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-primary"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="8"
                              height="8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                            <span className="text-[0.6rem] font-medium">NEW</span>
                          </motion.div>
                        )}

                        {isPretrained && !isRecent && (
                          <motion.div
                            initial={shouldAnimateIn ? { scale: 0, opacity: 0 } : false}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={shouldAnimateIn
                              ? {
                                duration: 0.3,
                                delay: index * 0.08 + 0.3,
                                type: "spring",
                                stiffness: 400,
                                damping: 20
                              }
                              : undefined
                            }
                            className="flex items-center gap-1 rounded-full bg-muted-foreground/10 px-2 py-0.5 text-muted-foreground/60"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="8"
                              height="8"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              stroke="none"
                            >
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span className="text-[0.6rem] font-medium">PRE-TRAINED</span>
                          </motion.div>
                        )}

                        {!isPretrained && !isRecent && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              duration: 0.3,
                              delay: index * 0.08 + 0.3,
                              type: "spring",
                              stiffness: 400,
                              damping: 20
                            }}
                            className="flex items-center gap-1 rounded-full bg-blue-100/60 px-2 py-0.5 text-blue-600/80"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="8"
                              height="8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            </svg>
                            <span className="text-[0.6rem] font-medium">LEARNED</span>
                          </motion.div>
                        )}
                      </div>
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
