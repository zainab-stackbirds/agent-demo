import { CustomUIMessage } from "@/app/page";

export const thumbtackConversation: CustomUIMessage[] = [
	{
		id: "msg-1",
		role: "assistant",
		parts: [
			{
				type: "text",
				text: "How can I help you?",
			},
			{
				type: "options",
				options: [
					{ label: "Sales", action: "select_sales" },
					{ label: "Marketing", action: "select_marketing" },
					{ label: "Operations", action: "select_operations" },
					{ label: "Analyst", action: "select_analyst" },
				],
			},
		],
	},
	{
		id: "msg-2",
		role: "assistant",
		parts: [
			{
				type: "text",
				text: "Great, I can help you with that. Switching to Sales agent mode.",
			},
		],
	},
	{
		id: "msg-3",
		role: "assistant",
		parts: [
			{
				type: "system-event",
				event: "agent-switching",
				metadata: { targetAgent: "Sales Agent" },
			},
		],
	},
	{
		id: "msg-4",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Hi! I’m the Sales Agent, pre-trained for sales and lead management, so I will first need to understand your business and then understand your sales workflows. \n\nTell me about your business. For e.g. do you have a website, facebook, instagram or google business profile?",
			},
		],
	},
	{
		id: "msg-5",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText:
					"Great. I am the founder of Eat Cook Joy. I am a solo entrepreneur and run the business in texas. My goal is to help every chef in the country get help to start and run their business. Our key value prop is helping chefs provide convenience, affordability and personalization all together. My website is www.eatcookjoy.com. Let me know if you need anything else.",
				recordingDuration: 4000,
			},
		],
	},
	{
		id: "msg-6",
		role: "ai-agent",
		parts: [
			{
				type: "reasoning",
				text: "Browsing the website \nBuilding a summary of Eat Cook Joy \nSearching for social profiles \nAnalyzing available reviews",
				status: "streaming",
			},
		],
	},
	{
		id: "msg-6-1",
		role: "ai-agent",
		parts: [
			{
				type: "text-image",
				text: "After searching I found this website",
				url: "/www_eatcookjoy_com.png",
				link: "https://www.eatcookjoy.com",
			},
		],
	},
	{
		id: "msg-6-1-1",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Does this look yours?",
			},
		],
	},
	{
		id: "msg-6-2",
		role: "user",
		parts: [
			{
				type: "text",
				text: "Yes, this is mine",
			},
		],
	},
	{
		id: "msg-7",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Okay great. Here is what I understand about your business:\n\n**Business Name**: Eat Cook Joy\n**Value Prop**: Chef tool providing personalization + convenience + affordability\n**Location**: Texas\n**Services**: Meal Prep, Events\n**Competitors**: Dinner Elf\n\nAm I missing anything?",
			},
		],
	},
	{
		id: "msg-8",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "No",
				recordingDuration: 1000,
			},
		],
	},
	{
		id: "msg-9",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Got it. I will store this information and share with your other agents in the future so you don't have to go through this step again. You can find and update this information anytime from the sidebar.",
			},
			{ type: "open-sidebar" },
			{
				type: "summary-added",
				heading: "Business Profile",
				subheading: "Your business information for all agents",
				id: "business_profile",
			},
		],
	},
	{
		id: "msg-10",
		role: "ai-agent",
		parts: [
			{
				type: "summary-updated",
				messages: [
					"Business Name: Eat Cook Joy\nValue Prop: Chef tool providing personalization + convenience + affordability\nLocation: Texas\nServices: Meal Prep, Events\nCompetitors: Dinner Elf",
				],
				id: "business_profile",
			},
		],
	},
	{
		id: "msg-11",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Got it. I have recorded your business details and I will share this with other agents when you need help with other roles. Ok, let's continue. \n\nWhere do you manage your leads? Feel free to share in chat or over voice.",
			},
		],
	},
	{
		id: "msg-12",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "I manage my leads on Thumbtack",
				recordingDuration: 2000,
			},
		],
	},
	{
		id: "msg-13",
		role: "ai-agent",
		parts: [
			{
				type: "app-event",
				apps: [{ app_id: "thumbtack", enabled: false }],
			},
		],
	},
	{
		id: "msg-14",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Got it. Lets connect with Thumbtack",
			},
			{
				type: "button",
				text: "Connect Thumbtack",
				action: "connect_thumbtack",
			},
		],
	},
	// {
	//   id: "msg-12",
	//   role: "ai-agent",
	//   parts: [
	//     {
	//       type: "app-event",
	//       apps: [
	//         { app_id: "thumbtack", enabled: true },
	//       ]
	//     },
	//   ],
	// },
	{
		id: "msg-15",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Now that I can access Thumbtack, lets walk through how you manage your leads there. Can you go to Thumbtack and show me how you do things?",
			},
			{
				type: "button",
				text: "Start capture",
				action: "start_capture",
			},
		],
	},
	{
		id: "msg-17",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Jobs",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-18",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Views",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-19",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Leads",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-20",
		role: "ai-agent",
		parts: [
			{
				type: "recording-state",
				state: "pause",
			},
		],
	},
	{
		id: "msg-21",
		role: "ai-agent",
		parts: [
			{
				type: "agent-interrupt",
				message: "Do you respond to all leads?",
			},
		],
	},
	{
		id: "msg-22",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "Yes",
				recordingDuration: 2000,
			},
		],
	},
	{
		id: "msg-23",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Thanks, please continue",
			},
		],
	},
	{
		id: "msg-23-1",
		role: "ai-agent",
		parts: [
			{
				type: "recording-state",
				state: "start",
			},
		],
	},
	{
		id: "msg-24",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on View details",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-25",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "View Contacted Pros",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-26",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Go back",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-27",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Messages",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-28",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on highlight",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-29",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Use your quick reply",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-29-1",
		role: "ai-agent",
		parts: [
			{
				type: "recording-state",
				state: "pause",
			},
		],
	},
	{
		id: "msg-30",
		role: "ai-agent",
		parts: [
			{
				type: "agent-interrupt",
				message: "is this where you store all your templates?",
			},
		],
	},
	{
		id: "msg-31",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "Yes",
				recordingDuration: 2000,
			},
		],
	},
	{
		id: "msg-32",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Thanks, please continue",
			},
			{
				type: "recording-state",
				state: "start",
			},
		],
	},
	{
		id: "msg-33",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Thank you for your inquiry…",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-34",
		role: "ai-agent",
		parts: [
			{
				type: "reasoning",
				text: " Analyzing steps\nSteps stored in memory",
				status: "streaming",
			},
		],
	},
	{
		id: "msg-34-1",
		role: "ai-agent",
		parts: [
			{
				type: "recording-state",
				state: "stop",
			},
		],
	},
	{
		id: "msg-35",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Cool. I have saved your workflow. Do you have a weekly budget set for your leads? Most private chef companies choose to set a weekly budget and pay for opportunities additionally. Is that how you do this? ",
			},
		],
	},
	{
		id: "msg-36",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "yes",
				recordingDuration: 3000,
			},
		],
	},
	{
		id: "msg-37",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Can you show me your setup?",
			},
		],
	},
	{
		id: "msg-38",
		role: "ai-agent",
		parts: [
			{
				type: "button",
				text: "Start capture",
				action: "start_capture",
			},
		],
	},
	{
		id: "msg-39",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Settings",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-40",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on navigation sidebar",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-41",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Weekly budget",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-37-1",
		role: "ai-agent",
		parts: [
			{
				type: "recording-state",
				state: "pause",
			},
		],
	},
	{
		id: "msg-42",
		role: "ai-agent",
		parts: [
			{
				type: "reasoning",
				text: "Analyzing steps\nSteps stored in memory",
				status: "streaming",
			},
		],
	},
	{
		id: "msg-42-1",
		role: "ai-agent",
		parts: [
			{
				type: "recording-state",
				state: "stop",
			},
		],
	},
	{
		id: "msg-43",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Got it. I will make sure to watch out for incoming leads and send them a templated message as long as it meets your weekly budget. Would you like me to get your approval or just send the message?",
			},
		],
	},
	{
		id: "msg-44",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "Get my approval and then we can adjust over time?",
				recordingDuration: 4000,
			},
		],
	},
	{
		id: "msg-45",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Sure. Your preference has been recorded",
			},
		],
	},
	{
		id: "msg-46",
		role: "ai-agent",
		parts: [
			{
				type: "new-workflow",
				workflow: "Manage leads on Thumbtack",
				category: "communication",
			},
			{
				type: "new-workflow",
				workflow: "Respond to all leads via template",
				category: "communication",
			},
			{
				type: "new-workflow",
				workflow: "Approval required",
				category: "automation",
			},
		],
	},
	{
		id: "msg-47",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText:
					"Next, I go to Openphone and continue the conversation there. This way I have the details of the client and the SMS feature keeps things easy.",
				recordingDuration: 4000,
			},
		],
	},
];

export const openPhoneConversation: Array<CustomUIMessage> = [
	{
		id: "msg-openphone-1",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Got it. Lets connect with Openphone",
			},
		],
	},
	{
		id: "msg-openphone-1-1",
		role: "ai-agent",
		parts: [
			{
				type: "button",
				text: "Connect OpenPhone",
				action: "connect_openphone",
			},
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
				],
			},
		],
	},
	{
		id: "msg-openphone-3",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Now that I can access Openphone, lets walk through how you manage your leads there. Can you go to Openphone and show me how you do things?",
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
				action: "start_capture",
			},
		],
	},
	{
		id: "msg-openphone-5",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Send a message",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-openphone-6",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Commands",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-openphone-7",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on /snippets",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-openphone-8",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Click on Post Thumbtack Outreach For Meal Prep…",
				displayAvatar: false,
			},
		],
	},
	{
		id: "msg-openphone-9",
		role: "ai-agent",
		parts: [
			{
				type: "reasoning",
				text: "Analyzing steps\nSteps stored in memory",
				status: "streaming",
			},
		],
	},
	{
		id: "msg-openphone-10",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: " Great. I have studied how you use an Openphone, I will follow these steps. Would you like me to follow up with the client in 24 hours if I don't hear back?",
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
				recordingDuration: 2000,
			},
		],
	},
	{
		id: "msg-openphone-12",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: " Okay. And would you like me to keep track of the leads and follows up somewhere?",
			},
		],
	},
	{
		id: "msg-openphone-13",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText:
					"Not right now. I don’t do that. For now all I do is message on Openphone and then wait to get a response. Once the user responds you can let me handle it. ",
				recordingDuration: 2000,
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
			},
		],
	},
	{
		id: "msg-openphone-15",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Great. To summarize:\n\nYou first go to Thumbtack. \n\nThen you msg leads with your template\n\nYou then switch to Openphone. \n\nThen you create contact and send them the template. \n\nI will now manage your lead responses and update you. \n\nWhere would you like to be updated? I will be recording my tasks in Stackbirds, but I can text you if you want? ",
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
				recordingDuration: 2000,
			},
		],
	},
	{
		id: "msg-openphone-17",
		role: "ai-agent",
		parts: [
			{
				type: "text",
				text: "Ok got it. Stackbirds Sales Agent is ready to go. ",
			},
			{
				type: "button",
				text: "Deploy Now",
				action: "deploy_agent",
			},
		],
	},
	{
		id: "msg-openphone-18",
		role: "user",
		parts: [
			{
				type: "voice",
				dummyText: "Yes please do",
				recordingDuration: 2000,
			},
		],
	},
];
