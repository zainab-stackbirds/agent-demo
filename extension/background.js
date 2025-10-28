// background.js
chrome.action.onClicked.addListener((tab) => {
	chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }).catch(() => {
		// Content script might not be loaded yet or page doesn't support it
		// Silently ignore - this is expected for some pages (chrome://, edge://, etc.)
	});
});
