// content.js
let sidebarVisible = false;
let sidebarContainer = null;
const debug = false

// Listen for extension icon click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "toggleSidebar") {
		toggleSidebar();
		sendResponse({ success: true });
	}
	return true; // Required for async sendResponse
});

// Listen for postMessage from the app (localhost or deployed)
window.addEventListener("message", (event) => {

	// Verify the origin is from localhost or deployed app
	const allowedOrigins = [
		"http://localhost:3000",
		"https://agent-demo-pied.vercel.app"
	];

	if (!allowedOrigins.includes(event.origin)) {
		return;
	}


	// Handle open sidebar request
	if (event.data && event.data.action === "openSidebar") {

		// If sidebar doesn't exist yet, create it first
		if (!sidebarContainer) {
			createSidebarHidden();
		}

		// Reveal the sidebar if it's hidden
		if (!sidebarVisible) {
			revealSidebar();
		}
	}
});

// Check if current domain should auto-load sidebar (hidden by default, revealed by trigger)
function isAutoOpenDomain() {
	const hostname = window.location.hostname;
	return (
		hostname.includes("localhost") ||
		hostname.includes("agent-demo-pied.vercel.app") ||
		hostname.includes("thumbtack.com") ||
		hostname.includes("openphone.com") ||
		hostname.includes("docs.google.com")
	);
}

// Save state to chrome.storage (per-domain, excluding localhost/deployed app)
function saveSidebarState(isVisible) {
	if (isAutoOpenDomain()) {
		const hostname = window.location.hostname;
		const isLocalOrDeployed = hostname.includes("localhost") || hostname.includes("agent-demo-pied.vercel.app");

		// Don't save state for localhost/deployed app - it should always start hidden
		if (isLocalOrDeployed) {
			return;
		}

		// Save per-domain state
		const storageKey = `sidebarVisible_${hostname}`;
		chrome.storage.local.set({ [storageKey]: isVisible });
	}
}

// Initialize sidebar on page load
(function initializeSidebar() {
	// Don't load extension sidebar if we're already inside an iframe
	// This prevents infinite recursion when the app loads itself in the sidebar
	if (window !== window.top) {
		return;
	}

	if (!isAutoOpenDomain()) {
		return;
	}

	const hostname = window.location.hostname;
	const isLocalOrDeployed = hostname.includes("localhost") || hostname.includes("agent-demo-pied.vercel.app");

	if (isLocalOrDeployed) {
		// For localhost/deployed app: always create sidebar but start hidden
		// It will be revealed by trigger from UI
		createSidebarHidden();
	} else {
		// For other auto-open domains (thumbtack, openphone, etc.): use per-domain storage
		const storageKey = `sidebarVisible_${hostname}`;
		chrome.storage.local.get([storageKey], (result) => {
			const sidebarState = result[storageKey];

			if (sidebarState === true) {
				showSidebar();
			} else if (sidebarState === false) {
				return;
			} else {
				// First visit - show after 1 second
				setTimeout(showSidebar, 1000);
			}
		});
	}
})();

// Create sidebar in hidden state (for localhost/deployed app)
function createSidebarHidden() {
	if (sidebarContainer) return; // Already created

	// Determine iframe URL based on hostname
	const hostname = window.location.hostname;
	const iframeUrl = hostname.includes("localhost") || debug
		? "http://localhost:3000"
		: "https://agent-demo-pied.vercel.app";

	// Create sidebar container
	sidebarContainer = document.createElement("div");
	sidebarContainer.id = "stackbirds-sidebar";
	sidebarContainer.classList.add("stackbirds-hidden"); // Start hidden

	sidebarContainer.innerHTML = `
    <div class="stackbirds-sidebar-header">
      <span class="stackbirds-title">Stackbirds Agent</span>
      <button class="stackbirds-close" id="stackbirds-close-btn">✕</button>
    </div>
    <iframe
      id="stackbirds-iframe"
      src="${iframeUrl}?isExtension=true"
      frameborder="0"
      allow="clipboard-write; microphone"
    ></iframe>
  `;

	document.body.appendChild(sidebarContainer);

	// Add close button listener
	document.getElementById("stackbirds-close-btn").addEventListener("click", hideSidebar);

	// Add draggable functionality
	makeResizable();

	// Note: sidebarVisible is false, sidebar exists but is hidden
}

// Reveal the hidden sidebar (toggle CSS class)
function revealSidebar() {
	if (!sidebarContainer) {
		return;
	}

	sidebarContainer.classList.remove("stackbirds-hidden");
	sidebarContainer.classList.add("stackbirds-visible");
	sidebarVisible = true;
	document.body.classList.add("stackbirds-sidebar-open");

	// Set margin based on sidebar width
	const currentWidth = sidebarContainer.offsetWidth || 400;
	document.body.style.marginRight = currentWidth + "px";

}

function toggleSidebar() {
	if (sidebarVisible) {
		hideSidebar();
	} else {
		// For localhost/deployed domains, sidebar is created hidden with CSS classes
		// so we need to use revealSidebar instead of showSidebar
		const hostname = window.location.hostname;
		const isLocalOrDeployed = hostname.includes("localhost") || hostname.includes("agent-demo-pied.vercel.app");

		if (isLocalOrDeployed && sidebarContainer && sidebarContainer.classList.contains("stackbirds-hidden")) {
			revealSidebar();
		} else {
			showSidebar();
		}
	}
}

function showSidebar() {
	if (sidebarContainer) {
		sidebarContainer.style.display = "flex";
		sidebarVisible = true;
		document.body.classList.add("stackbirds-sidebar-open");
		// Set initial margin based on current width
		const currentWidth = sidebarContainer.offsetWidth || 400;
		document.body.style.marginRight = currentWidth + "px";
		saveSidebarState(true);
		return;
	}

	const hostname = window.location.hostname;
	const iframeUrl = hostname.includes("localhost") || debug
		? "http://localhost:3000"
		: "https://agent-demo-pied.vercel.app";

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
      src="${iframeUrl}?isExtension=true"
      frameborder="0"
      allow="clipboard-write; microphone"
    ></iframe>
  `;

	document.body.appendChild(sidebarContainer);
	document.body.classList.add("stackbirds-sidebar-open");
	
	// Set initial margin
	const initialWidth = 400;
	document.body.style.marginRight = initialWidth + "px";

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
		// Check if using CSS classes or display property
		if (sidebarContainer.classList.contains("stackbirds-visible")) {
			// CSS-based hiding (for localhost/deployed)
			sidebarContainer.classList.remove("stackbirds-visible");
			sidebarContainer.classList.add("stackbirds-hidden");
		} else {
			// Display-based hiding (for other domains)
			sidebarContainer.style.display = "none";
		}

		document.body.classList.remove("stackbirds-sidebar-open");
		document.body.style.marginRight = "";
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
		// Update body margin to match new width
		document.body.style.marginRight = newWidth + "px";
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
