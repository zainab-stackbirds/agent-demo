import { CustomUIMessage } from "@/app/page";

export const openPhoneConversation: Array<CustomUIMessage> = [
    {
        id: "msg-openphone-1",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Got it. Lets connect with Openphone"
            },
            {
                type: "button",
                text: "Connect OpenPhone",
                action: "connect_openphone"
            }
        ],
    },
    {
        id: "msg-openphone-2",
        role: "ai-agent",
        parts: [
            {
                type: "app-event",
                apps: [
                    { app_id: "thumbtack", enabled: true },
                    { app_id: "openphone", enabled: true },
                ]
            },
        ],
    },
    {
        id: "msg-openphone-3",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Now that I can access Openphone, lets walk through how you manage your leads there. Can you go to Openphone and show me how you do things?"
            },
        ],
    },
    {
        id: "msg-openphone-4",
        role: "ai-agent",
        parts: [
            {
                type: "button",
                text: "Start capture",
                action: "start_capture"
            }
        ],
    }, {
        id: "msg-openphone-5",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Click on Send a message"
            },
        ],
    },
    {
        id: "msg-openphone-6",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Click on Commands"
            },
        ],
    },
    {
        id: "msg-openphone-7",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Click on /snippets"
            },
        ],
    },
    {
        id: "msg-openphone-8",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Click on Post Thumbtack Outreach For Meal Prep…"
            },
        ],
    }, {
        id: "msg-openphone-9",
        role: "ai-agent",
        parts: [
            {
                type: "reasoning",
                text: "Analyzing steps\nSteps stored in memory",
                status: "streaming",
            }
        ],
    },
    {
        id: "msg-openphone-10",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: " Great. I have studied how you use an Openphone, I will follow these steps. Would you like me to follow up with the client in 24 hours if I don't hear back?"
            },
        ],
    },
    {
        id: "msg-openphone-11",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "Yes please do",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-12",
        role: "ai-agent",
        parts: [
            {
                type: "agent-interrupt",
                message: " Okay. And would you like me to keep track of the leads and follows up somewhere?"
            },
            {
                type: "recording-state",
                state: "pause"
            }
        ],
    },
    {
        id: "msg-openphone-13",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "Not right now. I don’t do that. For now all I do is message on Openphone and then wait to get a response. Once the user responds you can let me handle it. ",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-14",
        role: "ai-agent",
        parts: [
            {
                type: "reasoning",
                text: "Analyzing steps\nSteps stored in memory",
                status: "streaming",
            }
        ],
    },
    {
        id: "msg-openphone-15",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "To summarize:\n\nYou first go to Thumbtack. Then you msg leads with your template\nYou then switch to Openphone. Then you create contact and send them the template. \nI will now manage your lead responses and update you. Where would you like to be updated? I will be recording my tasks in Stackbirds, but I can text you if you want? "
            },
        ],
    },
    {
        id: "msg-openphone-16",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "Ok great, just send me a text when you respond.",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-17",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Ok got it. Stackbirds Sales Agent is ready to go. "
            },
            {
                type: "button",
                text: "Deploy Now",
                action: "deploy_agent"
            }
        ],
    }
]
