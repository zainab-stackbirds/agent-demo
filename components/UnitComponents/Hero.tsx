"use client";

import { motion } from "motion/react";

const Hero = () => {
    return <motion.div
        initial={{ opacity: 1, y: 0 }}
        exit={{
            opacity: 0,
            y: -30,
            scale: 0.98,
            transition: {
                duration: 0.8,
                ease: [0.43, 0.13, 0.23, 0.96] // Custom cubic-bezier for smooth exit
            }
        }}
        className="flex items-center justify-center h-[50vh] bg-gradient-to-b from-background to-muted/20"
    >
        <motion.div
            className="text-center max-w-2xl px-6"
            exit={{
                y: -20,
                opacity: 0,
                transition: { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] }
            }}
        >
            <div className="text-6xl mb-8 font-bold text-primary animate-pulse">{">"}</div>
            <h1 className="text-5xl font-bold text-foreground mb-4 tracking-tight">
                StackBirds
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
                Speak and, There will be an AI-agent
            </p>
        </motion.div>
    </motion.div>

}

export default Hero;