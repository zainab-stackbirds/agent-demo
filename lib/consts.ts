import { CustomUIMessage } from "@/app/page";

export const openPhoneConversation: Array<CustomUIMessage> = [
    {
        id: "msg-openphone-1",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Great, now lets go to Openphone"
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
                text: "Please walk me through how you communicate with leads over openphone"
            },
        ],
    },
    {
        id: "msg-openphone-4",
        role: "ai-agent",
        parts: [
            {
                type: "button",
                text: "Go To OpenPhone",
                action: "navigate_openphone",
                url: "https://openphone.com"
            }
        ],
    },
    {
        id: "msg-openphone-5",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "I come to openphone and start a new converstaion with a new client",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-6",
        role: "ai-agent",
        parts: [
            {
                type: "agent-interrupt",
                message: "Do you use the number from thumbtack lead here"
            },
        ],
    },
    {
        id: "msg-openphone-7",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "Yes",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-8",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Got it. I'll remember this"
            },
        ],
    },
    {
        id: "msg-openphone-9",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "Next I select a template and send it over",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-10",
        role: "ai-agent",
        parts: [
            {
                type: "agent-interrupt",
                message: "Which template should I use?"
            },
        ],
    },
    {
        id: "msg-openphone-11",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "I have named all my templates pick one that suits the best for a lead",
                recordingDuration: 2000
            },
        ],
    },
    {
        id: "msg-openphone-12",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Sure! I'll do this when picking a template"
            },
        ],
    },

    {
        id: "msg-openphone-13",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "After a lead is contacted how often do i need to Follow-up"
            },
        ],
    },
    {
        id: "msg-openphone-14",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "I don't have a follow up schedule right now",
                recordingDuration: 2000
            },
        ],
    },


    {
        id: "msg-openphone-15",
        role: "ai-agent",
        parts: [
            {
                type: "text",
                text: "Can i suggest to follow up after 24 hours of no response from when client last responded?"
            },
        ],
    },

    {
        id: "msg-openphone-16",
        role: "user",
        parts: [
            {
                type: "voice",
                dummyText: "I like this idea, also can you help me get a brief of all the leads as well on regular basis",
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
                text: "How about I generate a brief summary of all the leads of last week on every monday morning?"
            },
        ],
    },



]
