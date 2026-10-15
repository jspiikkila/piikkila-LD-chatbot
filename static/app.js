// -------------------------------------------------------------
// USER CONTEXT CONFIGURATION (Part 2: 3 Distinct Demo Personas)
// -------------------------------------------------------------
const users = {
    standard: { kind: "user", key: "bob-standard", name: "Bob (Standard)", plan: "free", role: "viewer" },
    enterprise: { kind: "user", key: "alice-corp", name: "Alice (Enterprise)", plan: "enterprise", role: "admin", email: "alice@acme.corp" },
    beta: { kind: "user", key: "charlie-beta", name: "Charlie (Beta Tester)", plan: "free", role: "tester", email: "charlie@beta.org" }
};
let currentUser = users.standard;


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

let previousTypingIndicatorState = null;

function applyFlags() {
    // --------------------------------------------------------------------------
    // PART 1 REQUIREMENT: Release and Remediate
    // Flag to re-create in LaunchDarkly: 'enable-typing-indicator' (Type: Boolean)
    // Client-side availability MUST be checked in LaunchDarkly settings.
    // Demonstrates instant release/rollback via SDK listeners without page reload.
    // --------------------------------------------------------------------------
    const showTypingIndicator = ldClient.variation('enable-typing-indicator', false);
    const typingDiv = document.getElementById('typing-indicator');
    const flagPill = document.getElementById('flag-status-pill');
    const apmAlert = document.getElementById('apm-alert-banner');
    const apmResolved = document.getElementById('apm-resolved-banner');
    const incidentToggle = document.getElementById('simulate-incident-toggle');
    
    document.body.dataset.typingEnabled = showTypingIndicator;
    if (!showTypingIndicator) {
        typingDiv.classList.add('hidden');
    }

    // Update status badge in Part 1 panel
    if (flagPill) {
        if (showTypingIndicator) {
            flagPill.className = "panel-status-tag active";
            flagPill.innerText = "Flag: ON (Released)";
        } else {
            flagPill.className = "panel-status-tag inactive";
            flagPill.innerText = "Flag: OFF (Disabled)";
        }
    }

    // Check if an automated remediation just occurred (flag flipped from true to false)
    if (previousTypingIndicatorState === true && showTypingIndicator === false) {
        console.log("Automated remediation detected via LaunchDarkly stream!");
        if (apmAlert) apmAlert.classList.add('hidden');
        if (apmResolved) apmResolved.classList.remove('hidden');
        if (incidentToggle) incidentToggle.checked = false;
        
        showToast("⚡ Automated Remediation: LD turned flag OFF. App restored!");
        setTimeout(() => {
            if (apmResolved) apmResolved.classList.add('hidden');
        }, 8000);
    }
    previousTypingIndicatorState = showTypingIndicator;

    // --------------------------------------------------------------------------
    // PART 2 REQUIREMENT: Target (Entitlements & Evaluation Reasons)
    // Flag to re-create in LaunchDarkly: 'enable-premium-features' (Type: Boolean)
    // Demonstrates:
    // 1. Default Rule (Fallthrough) -> Bob (false)
    // 2. Custom Attribute Rule Targeting -> Alice (plan: enterprise -> true)
    // 3. Individual Target Whitelisting -> Charlie (key: charlie-beta -> true)
    // --------------------------------------------------------------------------
    const premiumDetail = ldClient.variationDetail('enable-premium-features', false);
    const showPremiumFeatures = Boolean(premiumDetail.value);
    const premiumDiv = document.getElementById('premium-features');
    if (showPremiumFeatures) {
        premiumDiv.classList.remove('hidden');
    } else {
        premiumDiv.classList.add('hidden');
    }

    // Update the live Targeting & Context Inspector
    updateTargetingInspector(premiumDetail);
}

function updateTargetingInspector(detail) {
    const nameEl = document.getElementById('active-user-name');
    const keyEl = document.getElementById('active-context-key');
    const planEl = document.getElementById('active-context-plan');
    const roleEl = document.getElementById('active-context-role');
    const evalPill = document.getElementById('evaluation-value-pill');
    const reasonPill = document.getElementById('evaluation-reason-pill');

    if (nameEl) nameEl.innerText = currentUser.name || currentUser.key;
    if (keyEl) keyEl.innerText = `key: ${currentUser.key}`;
    if (planEl) planEl.innerText = `plan: ${currentUser.plan}`;
    if (roleEl) roleEl.innerText = `role: ${currentUser.role || 'viewer'}`;

    if (evalPill) {
        if (detail && detail.value) {
            evalPill.className = "eval-pill eval-true";
            evalPill.innerText = "true (Served)";
        } else {
            evalPill.className = "eval-pill eval-false";
            evalPill.innerText = "false (Blocked)";
        }
    }

    if (reasonPill && detail && detail.reason) {
        const r = detail.reason;
        let humanReason = r.kind || "UNKNOWN";
        if (r.kind === 'RULE_MATCH') {
            humanReason = `RULE_MATCH (Rule #${(r.ruleIndex !== undefined ? r.ruleIndex + 1 : 1)}: plan = enterprise)`;
        } else if (r.kind === 'TARGET_MATCH') {
            humanReason = `TARGET_MATCH (Individual Target: ${currentUser.key})`;
        } else if (r.kind === 'FALLTHROUGH') {
            humanReason = `FALLTHROUGH (Default Rule: false)`;
        } else if (r.kind === 'OFF') {
            humanReason = `FLAG OFF (Flag is disabled in LD)`;
        }
        reasonPill.innerText = `Reason: ${humanReason}`;
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
        
        appendMessage(`📋 [AI Summary of ${messages.length} messages]: Conversation reviewed successfully for ${currentUser.name}. Context Entitlement: Verified.`, 'bot');
        showToast("Chat summary generated!");
    });
}

// Context Switcher (Part 2: Targeting)
document.getElementById('user-select').addEventListener('change', (e) => {
    const selected = e.target.value;
    currentUser = users[selected];
    
    // Identity change causes LD to re-evaluate flags for the new context
    if (ldClient) {
        console.log("Identifying as new context:", currentUser);
        ldClient.identify(currentUser).then(() => {
            applyFlags();
            showToast(`Switched context: ${currentUser.name}`);
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

function appendMessage(text, sender, meta = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    // Add AI Model & Persona Metadata Tag for Bot messages (Part 3)
    if (sender === 'bot' && meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'ai-meta-tag';
        metaDiv.innerText = `⚡ ${meta.mode || meta.model || 'Active AI Model'}`;
        msgDiv.appendChild(metaDiv);
    }
    
    const textNode = document.createElement('div');
    textNode.className = 'message-body';
    textNode.innerText = text;
    msgDiv.appendChild(textNode);
    
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

// -------------------------------------------------------------
// PART 1: INCIDENT SIMULATION & REMEDIATION CONTROLS
// -------------------------------------------------------------
const incidentToggle = document.getElementById('simulate-incident-toggle');
const apmAlert = document.getElementById('apm-alert-banner');
const triggerUrlInput = document.getElementById('trigger-url-input');
const fireTriggerBtn = document.getElementById('fire-trigger-btn');
const curlHelperCode = document.getElementById('curl-helper-code');

// Restore saved trigger URL from localStorage or backend env
if (triggerUrlInput) {
    const savedUrl = localStorage.getItem('ld_trigger_url') || window.LD_TRIGGER_URL || '';
    triggerUrlInput.value = savedUrl;
    if (savedUrl && curlHelperCode) {
        curlHelperCode.innerText = `curl -X POST ${savedUrl}`;
    }

    triggerUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        localStorage.setItem('ld_trigger_url', url);
        if (curlHelperCode) {
            curlHelperCode.innerText = url ? `curl -X POST ${url}` : `curl -X POST <TRIGGER_URL>`;
        }
    });
}

// Drawer Toggle Handler
const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
const demoDrawer = document.getElementById('demo-drawer');
const drawerChevron = document.getElementById('drawer-chevron');

if (drawerToggleBtn && demoDrawer) {
    drawerToggleBtn.addEventListener('click', () => {
        const isHidden = demoDrawer.classList.toggle('hidden');
        if (drawerChevron) {
            drawerChevron.innerText = isHidden ? '▼' : '▲';
        }
    });
}

// Copy curl Command Button
const copyCurlBtn = document.getElementById('copy-curl-btn');
if (copyCurlBtn) {
    copyCurlBtn.addEventListener('click', () => {
        const url = (triggerUrlInput ? triggerUrlInput.value.trim() : '') || window.LD_TRIGGER_URL || '';
        if (!url) {
            showToast("⚠️ No LaunchDarkly Trigger Webhook URL found.");
            return;
        }
        const cmd = `curl -X POST ${url}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(cmd).then(() => {
                showToast("📋 curl command copied to clipboard!");
            }).catch(() => {
                showToast("📋 curl command ready!");
            });
        } else {
            showToast("📋 curl command ready!");
        }
    });
}

// Quick Send for onboarding prompt chips
window.quickSend = function(promptText) {
    if (chatInput) {
        chatInput.value = promptText;
        sendMessage();
    }
};

// Incident Toggle handler
if (incidentToggle) {
    incidentToggle.addEventListener('change', () => {
        if (incidentToggle.checked && document.body.dataset.typingEnabled !== 'true') {
            showToast("ℹ️ Tip: Turn 'enable-typing-indicator' ON in LaunchDarkly to simulate this release incident.");
        }
    });
}


// Fire LD Trigger Webhook Button
if (fireTriggerBtn) {
    fireTriggerBtn.addEventListener('click', async () => {
        const url = triggerUrlInput ? triggerUrlInput.value.trim() : '';
        if (!url) {
            showToast("⚠️ Please paste your LaunchDarkly Trigger Webhook URL first.");
            if (triggerUrlInput) triggerUrlInput.focus();
            return;
        }

        fireTriggerBtn.disabled = true;
        fireTriggerBtn.innerText = "Firing Trigger...";

        try {
            const resp = await fetch('/api/trigger-remediation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger_url: url })
            });
            const res = await resp.json();

            if (resp.ok) {
                showToast("🚀 LD Webhook Trigger fired! Disabling flag...");
            } else {
                showToast(`❌ Error: ${res.error || "Failed to fire trigger"}`);
            }
        } catch (err) {
            showToast(`❌ Network error triggering webhook`);
        } finally {
            fireTriggerBtn.disabled = false;
            fireTriggerBtn.innerText = "⚡ Fire LD Trigger";
        }
    });
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    appendMessage(text, 'user');
    chatInput.value = '';
    
    const isIncidentActive = incidentToggle && incidentToggle.checked && (document.body.dataset.typingEnabled === 'true');

    // Check if typing indicator feature is enabled
    if (document.body.dataset.typingEnabled === 'true') {
        typingIndicator.classList.remove('hidden');
        if (isIncidentActive) {
            typingIndicator.innerText = "Bot is typing... (⚠️ latency spike)";
        } else {
            typingIndicator.innerText = "Bot is typing...";
        }
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
                plan: currentUser.plan,
                role: currentUser.role,
                name: currentUser.name,
                simulate_incident: isIncidentActive
            })

        });
        
        const data = await response.json();
        typingIndicator.classList.add('hidden');
        appendMessage(data.response, 'bot', {
            model: data.model,
            mode: data.mode,
            prompt: data.system_prompt
        });


        // If latency incident was simulated, show the APM alert banner
        if (isIncidentActive && apmAlert) {
            apmAlert.classList.remove('hidden');
            showToast("🚨 High latency detected (>3.5s)! APM Incident fired.");
        }
        
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

