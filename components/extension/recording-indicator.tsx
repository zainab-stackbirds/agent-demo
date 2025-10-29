import { AnimatePresence, motion, LayoutGroup } from "motion/react";
const RecordingIndicator = ({ recordingState }: { recordingState: string }) => {
    if (recordingState === "not_started") {
        return null
    }

    if (recordingState === "paused") {
        return <div className="z-50 flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-100">
                Paused
            </span>
        </div>
    }

    return <div>
        <AnimatePresence>
            {recordingState === "recording" && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="z-50 flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 mb-4"
                >
                    <motion.div
                        className="w-3 h-3 bg-red-500 rounded-full"
                        animate={{
                            opacity: [1, 0.3, 1],
                            scale: [1, 0.9, 1]
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Recording
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
}

export default RecordingIndicator