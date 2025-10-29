"use client";

import { motion } from "motion/react";

const Header = () => {
    return (
        <motion.header
            initial={{ opacity: 0, y: -40 }}
            animate={{
                opacity: 1,
                y: 0,
                transition: {
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1], // Custom easing for smooth entrance
                    delay: 0.3 // Wait for hero to start fading
                }
            }}
            className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        >
            <div className="container flex h-16 items-center px-6">
                <div className="flex items-center gap-3">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{
                            scale: 1,
                            rotate: 0,
                            transition: {
                                delay: 0.6,
                                duration: 0.6,
                                ease: [0.16, 1, 0.3, 1],
                                type: "spring",
                                stiffness: 150,
                                damping: 15
                            }
                        }}
                        className="text-2xl font-bold text-primary"
                    >
                        {">"}
                    </motion.div>
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{
                            scaleX: 1,
                            transition: {
                                delay: 0.8,
                                duration: 0.4,
                                ease: [0.16, 1, 0.3, 1]
                            }
                        }}
                        className="h-6 w-px bg-border origin-left"
                    />
                    <motion.span
                        initial={{ opacity: 0, x: -20 }}
                        animate={{
                            opacity: 1,
                            x: 0,
                            transition: {
                                delay: 0.9,
                                duration: 0.6,
                                ease: [0.16, 1, 0.3, 1]
                            }
                        }}
                        className="text-lg font-semibold text-foreground"
                    >
                        StackBirds
                    </motion.span>
                </div>
            </div>
        </motion.header>
    );
};

export default Header;
