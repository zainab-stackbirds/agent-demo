// content.js
let sidebarVisible = false;
let sidebarContainer = null;

// Listen for extension icon click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "toggleSidebar") {
		toggleSidebar();
		sendResponse({ success: true });
	}
	return true; // Required for async sendResponse
});

// Check if current domain should auto-open sidebar
function isAutoOpenDomain() {
	const hostname = window.location.hostname;
	return (
		hostname.includes("thumbtack.com") ||
		hostname.includes("openphone.com") ||
		hostname.includes("docs.google.com")
	);
}

// Save state to chrome.storage (only for auto-open domains)
function saveSidebarState(isVisible) {
	if (isAutoOpenDomain()) {
		chrome.storage.local.set({ sidebarVisible: isVisible });
	}
}

// Initialize sidebar on page load
chrome.storage.local.get(["sidebarVisible"], (result) => {
	if (isAutoOpenDomain()) {
		// On auto-open domains
		if (result.sidebarVisible === true) {
			// User explicitly wants it open
			showSidebar();
		} else if (result.sidebarVisible === false) {
			// User explicitly closed it, don't auto-open
			return;
		} else {
			// First visit, auto-open after 1 second
			setTimeout(showSidebar, 1000);
		}
	}
	// On non-auto-open domains, don't auto-open
});

function toggleSidebar() {
	if (sidebarVisible) {
		hideSidebar();
	} else {
		showSidebar();
	}
}

function showSidebar() {
	if (sidebarContainer) {
		sidebarContainer.style.display = "flex";
		sidebarVisible = true;
		saveSidebarState(true);
		return;
	}

	// Create sidebar container
	sidebarContainer = document.createElement("div");
	sidebarContainer.id = "stackbirds-sidebar";
	sidebarContainer.innerHTML = `
    <div class="stackbirds-sidebar-header">
      <span class="stackbirds-title">Stackbirds Agent</span>
      <button class="stackbirds-close" id="stackbirds-close-btn">✕</button>
    </div>
    <iframe 
      id="stackbirds-iframe"
      src="https://agent-demo-eight.vercel.app" 
      frameborder="0"
      allow="clipboard-write; microphone"
    ></iframe>
  `;

	document.body.appendChild(sidebarContainer);

	// Add close button listener
	document
		.getElementById("stackbirds-close-btn")
		.addEventListener("click", hideSidebar);

	sidebarVisible = true;
	saveSidebarState(true);

	// Optional: Add draggable functionality
	makeResizable();
}

function hideSidebar() {
	if (sidebarContainer) {
		sidebarContainer.style.display = "none";
		sidebarVisible = false;
		saveSidebarState(false);
	}
}

// Optional: Make sidebar resizable
function makeResizable() {
	const sidebar = sidebarContainer;
	let isResizing = false;
	let lastDownX = 0;

	const resizeHandle = document.createElement("div");
	resizeHandle.className = "stackbirds-resize-handle";
	sidebar.insertBefore(resizeHandle, sidebar.firstChild);

	resizeHandle.addEventListener("mousedown", (e) => {
		isResizing = true;
		lastDownX = e.clientX;
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", stopResize);
	});

	function handleMouseMove(e) {
		if (!isResizing) return;
		const offsetRight =
			document.body.offsetWidth - (e.clientX - document.body.offsetLeft);
		const minWidth = 300;
		const maxWidth = 800;
		const newWidth = Math.min(Math.max(offsetRight, minWidth), maxWidth);
		sidebar.style.width = newWidth + "px";
	}

	function stopResize() {
		isResizing = false;
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", stopResize);
	}
}

// Optional: Keyboard shortcut (Ctrl+Shift+S)
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.shiftKey && e.key === "S") {
		toggleSidebar();
	}
});
