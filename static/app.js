// -------------------------------------------------------------
// USER CONTEXT CONFIGURATION
// -------------------------------------------------------------
const users = {
    free: { kind: "user", key: "anonymous-123", plan: "free" },
    premium: { kind: "user", key: "jane-doe", plan: "premium", email: "jane@example.com" }
};
let currentUser = users.free;

// ==============================================================================
// LAUNCHDARKLY CLIENT-SIDE SDK INITIALIZATION
// ==============================================================================
// NOTE FOR REVIEWERS:
// The Client-Side ID is injected securely from Flask via window.LD_CLIENT_ID
// (originating from your .env file or environment variable LD_CLIENT_ID).
//
// The JS Client SDK uses Server-Sent Events (SSE) to maintain a live streaming
// connection. When a flag state changes in the LaunchDarkly dashboard, the client
// emits a 'change' event to update the DOM immediately without a page refresh.
// ==============================================================================
let ldClient;

async function initLaunchDarkly() {
    if (window.LD_CLIENT_ID === 'YOUR_CLIENT_SIDE_ID' || window.LD_CLIENT_ID === '') {
        console.warn("No LaunchDarkly Client ID found. Please set LD_CLIENT_ID.");
        return;
    }

    console.log("Initializing LaunchDarkly client...");
    ldClient = LDClient.initialize(window.LD_CLIENT_ID, currentUser);
    
    ldClient.on('ready', () => {
        console.log("LaunchDarkly Client ready.");
        applyFlags();
    });

    // Part 1: Instant Releases/Rollbacks
    // When the flag changes in LD, this listener instantly updates the UI (no reload)
    ldClient.on('change', (settings) => {
        console.log("Flag changed instantly!", settings);
        applyFlags();
    });
}

function applyFlags() {
    // --------------------------------------------------------------------------
    // PART 1 REQUIREMENT: Release and Remediate
    // Flag to re-create in LaunchDarkly: 'enable-typing-indicator' (Type: Boolean)
    // Client-side availability MUST be checked in LaunchDarkly settings.
    // Demonstrates instant release/rollback via SDK listeners without page reload.
    // --------------------------------------------------------------------------
    const showTypingIndicator = ldClient.variation('enable-typing-indicator', false);
    const typingDiv = document.getElementById('typing-indicator');
    
    document.body.dataset.typingEnabled = showTypingIndicator;
    if (!showTypingIndicator) {
        typingDiv.classList.add('hidden');
    }

    // --------------------------------------------------------------------------
    // PART 2 REQUIREMENT: Target (Entitlements & Components)
    // Flag to re-create in LaunchDarkly: 'enable-premium-features' (Type: Boolean)
    // Demonstrates individual targeting ('jane-doe') and rule targeting (plan: 'premium').
    // --------------------------------------------------------------------------
    const showPremiumFeatures = ldClient.variation('enable-premium-features', false);
    const premiumDiv = document.getElementById('premium-features');
    if (showPremiumFeatures) {
        premiumDiv.classList.remove('hidden');
    } else {
        premiumDiv.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// UI INTERACTIONS
// -------------------------------------------------------------

// Summarize Feature Click Handler (Part 2 Demonstration)
const summarizeBtn = document.getElementById('summarize-btn');
if (summarizeBtn) {
    summarizeBtn.addEventListener('click', () => {
        const messages = Array.from(document.querySelectorAll('.message'))
            .map(m => m.innerText.replace('👍', '').trim())
            .filter(t => t.length > 0);
        
        appendMessage(`📋 [AI Summary of ${messages.length} messages]: Conversation reviewed successfully. User plan: Premium.`, 'bot');
        showToast("Chat summary generated!");
    });
}

// Context Switcher (Part 2: Targeting)
document.getElementById('user-select').addEventListener('change', (e) => {
    const selected = e.target.value;
    currentUser = users[selected];
    
    // Identity change causes LD to re-evaluate flags for the new context
    if (ldClient) {
        console.log("Identifying as new user:", currentUser);
        ldClient.identify(currentUser).then(() => {
            applyFlags();
            showToast(`Switched to ${currentUser.plan.toUpperCase()} user context`);
        });
    }
});

// Chat Logic
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function appendMessage(text, sender, messageId = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.innerText = text;
    
    // Add Thumbs Up for Bot messages (Experimentation)
    if (sender === 'bot') {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'feedback-controls';
        
        const thumbsUp = document.createElement('button');
        thumbsUp.className = 'feedback-btn';
        thumbsUp.innerText = '👍 Helpful';
        thumbsUp.onclick = () => {
            // Track on Client-Side SDK
            if (ldClient) {
                console.log("Tracking custom metric 'bot-thumbs-up' on client");
                ldClient.track('bot-thumbs-up');
                ldClient.flush();
            }
            // Track on Server-Side SDK
            fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_key: currentUser.key })
            });
            showToast("Feedback sent! Recorded in LaunchDarkly Experimentation.");
            thumbsUp.disabled = true;
            thumbsUp.style.opacity = '0.5';
        };
        
        feedbackDiv.appendChild(thumbsUp);
        msgDiv.appendChild(feedbackDiv);
    }
    
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    appendMessage(text, 'user');
    chatInput.value = '';
    
    // Check if typing indicator feature is enabled
    if (document.body.dataset.typingEnabled === 'true') {
        typingIndicator.classList.remove('hidden');
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    
    // Send to backend
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                user_key: currentUser.key,
                plan: currentUser.plan
            })
        });
        
        const data = await response.json();
        typingIndicator.classList.add('hidden');
        appendMessage(data.response, 'bot');
        
    } catch (e) {
        typingIndicator.classList.add('hidden');
        appendMessage("Error communicating with server.", 'bot');
    }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Start initialization
initLaunchDarkly();
