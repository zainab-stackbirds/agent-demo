// content.js
let sidebarVisible = false;
let sidebarContainer = null;
let defaultTab = "chat"; // Default tab for sidebar iframe
const debug = false;

const RECORDING_OVERLAY_ID = "stackbirds-recording-overlay";
let recordingOverlayTimeoutId = null;
let recordingOverlayRemovalTimeoutId = null;

const PAUSE_OVERLAY_ID = "stackbirds-pause-overlay";
let pauseOverlayTimeoutId = null;
let pauseOverlayRemovalTimeoutId = null;

function getPageContentCenterX() {
	const computedStyles = window.getComputedStyle(document.body);
	const marginRightValue = parseFloat(computedStyles.marginRight || "0") || 0;
	const contentWidth = Math.max(window.innerWidth - marginRightValue, 0);
	return contentWidth / 2;
}

function showRecordingOverlay(duration = 2000) {
	if (!document || !document.body) {
		return;
	}

	const existingOverlay = document.getElementById(RECORDING_OVERLAY_ID);
	const overlay = existingOverlay || document.createElement("div");

	if (!existingOverlay) {
		overlay.id = RECORDING_OVERLAY_ID;
		overlay.className = "stackbirds-recording-overlay";
		overlay.textContent = "recording";
		document.body.appendChild(overlay);
	} else {
		overlay.classList.remove("stackbirds-recording-overlay-fade");
		overlay.classList.remove("stackbirds-recording-overlay-visible");
	}

	const centerX = getPageContentCenterX();
	overlay.style.left = `${centerX}px`;
	overlay.style.right = "auto";
	overlay.style.top = "50%";

	if (recordingOverlayRemovalTimeoutId) {
		clearTimeout(recordingOverlayRemovalTimeoutId);
		recordingOverlayRemovalTimeoutId = null;
	}

	requestAnimationFrame(() => {
		overlay.classList.add("stackbirds-recording-overlay-visible");
	});

	if (recordingOverlayTimeoutId) {
		clearTimeout(recordingOverlayTimeoutId);
	}

	recordingOverlayTimeoutId = window.setTimeout(() => {
		hideRecordingOverlay();
	}, duration);
}

function hideRecordingOverlay() {
	if (recordingOverlayTimeoutId) {
		clearTimeout(recordingOverlayTimeoutId);
		recordingOverlayTimeoutId = null;
	}

	const overlay = document.getElementById(RECORDING_OVERLAY_ID);
	if (!overlay) {
		return;
	}

	overlay.classList.remove("stackbirds-recording-overlay-visible");
	overlay.classList.add("stackbirds-recording-overlay-fade");

	if (recordingOverlayRemovalTimeoutId) {
		clearTimeout(recordingOverlayRemovalTimeoutId);
	}

	recordingOverlayRemovalTimeoutId = setTimeout(() => {
		if (overlay.parentElement) {
			overlay.remove();
		}
		recordingOverlayRemovalTimeoutId = null;
	}, 250);
}

function showPauseOverlay(duration = 2000) {
	if (!document || !document.body) {
		return;
	}

	const existingOverlay = document.getElementById(PAUSE_OVERLAY_ID);
	const overlay = existingOverlay || document.createElement("div");

	if (!existingOverlay) {
		overlay.id = PAUSE_OVERLAY_ID;
		overlay.className = "stackbirds-pause-overlay";
		overlay.textContent = "paused";
		document.body.appendChild(overlay);
	} else {
		overlay.classList.remove("stackbirds-pause-overlay-fade");
		overlay.classList.remove("stackbirds-pause-overlay-visible");
	}

	const centerX = getPageContentCenterX();
	overlay.style.left = `${centerX}px`;
	overlay.style.right = "auto";
	overlay.style.top = "50%";

	if (pauseOverlayRemovalTimeoutId) {
		clearTimeout(pauseOverlayRemovalTimeoutId);
		pauseOverlayRemovalTimeoutId = null;
	}

	requestAnimationFrame(() => {
		overlay.classList.add("stackbirds-pause-overlay-visible");
	});

	if (pauseOverlayTimeoutId) {
		clearTimeout(pauseOverlayTimeoutId);
	}

	pauseOverlayTimeoutId = window.setTimeout(() => {
		hidePauseOverlay();
	}, duration);
}

function hidePauseOverlay() {
	if (pauseOverlayTimeoutId) {
		clearTimeout(pauseOverlayTimeoutId);
		pauseOverlayTimeoutId = null;
	}

	const overlay = document.getElementById(PAUSE_OVERLAY_ID);
	if (!overlay) {
		return;
	}

	overlay.classList.remove("stackbirds-pause-overlay-visible");
	overlay.classList.add("stackbirds-pause-overlay-fade");

	if (pauseOverlayRemovalTimeoutId) {
		clearTimeout(pauseOverlayRemovalTimeoutId);
	}

	pauseOverlayRemovalTimeoutId = setTimeout(() => {
		if (overlay.parentElement) {
			overlay.remove();
		}
		pauseOverlayRemovalTimeoutId = null;
	}, 250);
}

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
		"https://agent-demo-pied.vercel.app",
	];

	if (!allowedOrigins.includes(event.origin)) {
		return;
	}

	// Handle open sidebar request
	if (event.data && event.data.action === "openSidebar") {
		// Set default tab if provided
		const previousTab = defaultTab;
		if (event.data.defaultTab) {
			defaultTab = event.data.defaultTab;
		}

		// If sidebar doesn't exist yet, create it first
		if (!sidebarContainer) {
			createSidebarHidden();
		} else if (previousTab !== defaultTab) {
			// Update iframe src if tab changed
			const iframe = sidebarContainer.querySelector("#stackbirds-iframe");
			if (iframe) {
				const hostname = window.location.hostname;
				const iframeUrl =
					hostname.includes("localhost") || debug
						? "http://localhost:3000"
						: "https://agent-demo-pied.vercel.app";
				iframe.src = `${iframeUrl}?isExtension=true&tab=${defaultTab}`;
			}
		}

		// Reveal the sidebar if it's hidden
		if (!sidebarVisible) {
			revealSidebar();
		}
	}

	// Handle recording started event - show border on OpenPhone page
	if (
		event.data &&
		event.data.action === "recordingStarted" &&
		event.data.source === "stackbirds-app"
	) {
		// Add border class to body
		document.body.classList.add("stackbirds-recording-border");
		showRecordingOverlay();

		// Remove border after 2 seconds
		setTimeout(() => {
			document.body.classList.remove("stackbirds-recording-border");
			hideRecordingOverlay();
		}, 2000);
	}

	// Handle recording paused event - show pause overlay
	if (
		event.data &&
		event.data.action === "recordingPaused" &&
		event.data.source === "stackbirds-app"
	) {
		// Add yellow border class to body
		document.body.classList.add("stackbirds-pause-border");
		showPauseOverlay();

		// Remove border after 2 seconds
		setTimeout(() => {
			document.body.classList.remove("stackbirds-pause-border");
			hidePauseOverlay();
		}, 2000);
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
		const isLocalOrDeployed =
			hostname.includes("localhost") ||
			hostname.includes("agent-demo-pied.vercel.app");

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
	const isLocalOrDeployed =
		hostname.includes("localhost") ||
		hostname.includes("agent-demo-pied.vercel.app");

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
	const iframeUrl =
		hostname.includes("localhost") || debug
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
      src="${iframeUrl}?isExtension=true&tab=${defaultTab}"
      frameborder="0"
      allow="clipboard-write; microphone"
    ></iframe>
  `;

	document.body.appendChild(sidebarContainer);

	// Add close button listener
	document
		.getElementById("stackbirds-close-btn")
		.addEventListener("click", hideSidebar);

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

	// Set margin based on sidebar width (1/3 of viewport)
	const currentWidth = sidebarContainer.offsetWidth || window.innerWidth / 3;
	document.body.style.marginRight = currentWidth + "px";
}

function toggleSidebar() {
	if (sidebarVisible) {
		hideSidebar();
	} else {
		// For localhost/deployed domains, sidebar is created hidden with CSS classes
		// so we need to use revealSidebar instead of showSidebar
		const hostname = window.location.hostname;
		const isLocalOrDeployed =
			hostname.includes("localhost") ||
			hostname.includes("agent-demo-pied.vercel.app");

		if (
			isLocalOrDeployed &&
			sidebarContainer &&
			sidebarContainer.classList.contains("stackbirds-hidden")
		) {
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
		// Set initial margin based on current width (1/3 of viewport)
		const currentWidth =
			sidebarContainer.offsetWidth || window.innerWidth / 3;
		document.body.style.marginRight = currentWidth + "px";
		saveSidebarState(true);
		return;
	}

	const hostname = window.location.hostname;
	const iframeUrl =
		hostname.includes("localhost") || debug
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
      src="${iframeUrl}?isExtension=true&tab=${defaultTab}"
      frameborder="0"
      allow="clipboard-write; microphone"
    ></iframe>
  `;

	document.body.appendChild(sidebarContainer);
	document.body.classList.add("stackbirds-sidebar-open");

	// Set initial margin (1/3 of viewport)
	const initialWidth = window.innerWidth / 3;
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
		const minWidth = window.innerWidth * 0.25; // 25% minimum
		const maxWidth = window.innerWidth * 0.5; // 50% maximum
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
