# ChatOps AI - LD Exercise

This repository is a demonstration of LaunchDarkly's basic capabilities, fulfilling all requirements of the SE Technical Exercise. 

The application is a GenAI Chatbot interface ("ChatOps AI") built with **Python (Flask)** on the backend and **JavaScript (HTML/CSS)** on the frontend.

---

## 📋 Requirements Fulfilled

| **Part 1: Release and Remediate** | `enable-typing-indicator` toggles UI elements reactively via the JavaScript SDK event listeners (`.on('change')`) with **zero page reload**. Includes an automated remediation kill switch using **LaunchDarkly Flag Triggers (Webhooks)**, in-app APM incident simulation, and Semantic Patch REST API support. |
| **Part 2: Target** | `enable-premium-features` gates features using custom context attributes (`plan: enterprise` vs `free`) and individual targeting (`charlie-beta`). Features a live **Targeting & Evaluation Inspector** displaying LaunchDarkly `variationDetail()` evaluation reasons (`RULE_MATCH`, `TARGET_MATCH`, `FALLTHROUGH`). |
| **Extra Credit: AI Configs** | `chatbot-ai-config` dynamically controls the AI model (`gpt-3.5-turbo` vs `gpt-4`) and system prompts server-side without redeploying code. |
| **Extra Credit: Experimentation** | Custom telemetry metric (`bot-thumbs-up`) tracks user feedback on AI responses, powering an active A/B Experiment comparing model satisfaction. |

---

## 🛠 Prerequisites & Environment Assumptions

1. **Python 3.9+** installed.
2. A **LaunchDarkly Account** (Free Trial or Enterprise).
3. `curl` installed (for testing the kill-switch Flag Trigger).

---

## 🚀 Setup & Execution Guide

Choose the path that best matches your evaluation preference:

| Path | When to Choose | Time Required |
| :--- | :--- | :--- |
| **Option A: Fast-Track (Recommended)** | Choose this if you want to test the live app **immediately** without spending time configuring flags. Uses the jspiikkila's active LaunchDarkly tenant. | **~2 minutes** |
| **Option B: Recreate from Scratch** | Choose this if you want to test clean-room deployment by creating fresh flags in your own LaunchDarkly account. | **~10 minutes** |

---

### Option A: Fast-Track Evaluation (Recommended)
> **Goal:** Run the application immediately using the jspiikkila's pre-configured LaunchDarkly environment. All 3 flags, targeting rules, and the active A/B experiment are already live and collecting data!
>
> 🔑 **Demo Keys & Workspace Access:**
> * To request the live demo keys or to receive an instant member invite to my LaunchDarkly trial dashboard, please email me directly at **[jspiikkila@gmail.com](mailto:jspiikkila@gmail.com)**.
> * Alternatively, follow **Option B** below to spin up fresh flags in your own tenant.

1. Clone this repository:
   ```bash
   git clone https://github.com/jspiikkila/piikkila-LD-chatbot.git
   cd piikkila-LD-chatbot
   ```
2. Create your `.env` file from the template:
   ```bash
   cp .env.example .env
   ```
3. Populate `.env` with the demo credentials (from your submission email):
   ```bash
   LD_SDK_KEY="<provided-demo-server-key>"
   LD_CLIENT_ID="<provided-demo-client-id>"
   LD_TRIGGER_URL="<provided-demo-trigger-url>"
   ```
4. Install dependencies and start the app:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```
5. Navigate to `http://localhost:5001` to begin the demo walkthrough!

---

### Option B: Recreate in Your Own LaunchDarkly Tenant

If you prefer to recreate the environment from scratch in your own LaunchDarkly account, follow these steps:

#### 1. Create Feature Flags
Create the following three flags in your environment (e.g., `Test`):

1. **`enable-typing-indicator`**
   * **Kind**: Boolean
   * **Client-side availability**: Check **"Available on client-side SDKs"** (under Settings/Advanced controls).
   * **Default variation**: `false`
   * **Automated Remediation Trigger**:
     * Navigate to the flag's **Configuration in environment** (or **Triggers** tab).
     * Click **"Add trigger"** -> Select **"Generic trigger"**.
     * Set action to: **"Turn flag off"** (in your `Test` environment).
     * Click **Save trigger** and copy the webhook URL.

2. **`enable-premium-features`**
   * **Kind**: Boolean
   * **Client-side availability**: Check **"Available on client-side SDKs"**.
   * **Targeting Rules (Demo-Optimized)**:
     * **Individual Target:** Add context key `charlie-beta` -> Serve `true` *(Demonstrates early-access/beta whitelisting for a user on a free plan)*.
     * **Rule-based Target:** Add rule: If `user.plan` is `enterprise` -> Serve `true` *(Demonstrates custom attribute entitlement gating)*.
     * **Default Rule:** Serve `false` *(Fallthrough for standard free-tier users)*.

3. **`chatbot-ai-config`**
   * **Kind**: JSON (Server-side only)
   * **Variations**:
     * Variation 1 (`GPT-4 Detailed Expert`):
       ```json
       {
         "model": "gpt-4",
         "system_prompt": "You are a highly detailed and articulate enterprise AI expert."
       }
       ```
     * Variation 2 (`GPT-3.5 Concise Assistant`):
       ```json
       {
         "model": "gpt-3.5-turbo",
         "system_prompt": "You are a concise, ultra-fast support assistant."
       }
       ```

#### 2. Configure Metric & Experiment (Extra Credit)
1. **Create Metric**:
   * Name: `Bot Thumbs Up` | Key: `bot-thumbs-up` | Kind: Custom | Definition: Count per user.
2. **Create Experiment**:
   * Name: `AI Prompt & Model Optimization`
   * Target Flag: `chatbot-ai-config`
   * Split: 50% Control (`GPT-3.5`) / 50% Treatment (`GPT-4`)
   * Primary Metric: `Bot Thumbs Up`
   * Click **Start experiment**.

#### 3. Run the App
Configure your new `.env` file with your SDK keys and run `python app.py`.

---

## 🎬 3-Minute Demo Walkthrough

### 1. Part 1: Instant Releases & Rollbacks (No Reload)
1. Open `http://localhost:5001`.
2. In LaunchDarkly, toggle **`enable-typing-indicator`** to **ON**.
3. Send a message in the chat. Note the "Bot is typing..." indicator appears for 1.2s before the response, and the demo status badge shows **"Flag: ON (Released)"**.
4. **Instant Rollback**: Toggle the flag to **OFF** in LaunchDarkly. Send another message. Notice the indicator disappears immediately without refreshing the browser.

### 2. Part 1: Automated Remediation (APM Incident & Flag Trigger Kill Switch)
Demonstrate how an APM monitoring tool (Datadog, Dynatrace, New Relic) automatically heals a release regression:
1. Ensure `enable-typing-indicator` is **ON**.
2. Click the **"🛠️ Demo Guide & Tools"** button in the header, then check **"Simulate Latency Spike (APM Alert)"**.
3. Send a message in the chat.
4. **Observe the regression:** Response latency spikes to 4.0s, and the APM monitor flags an active incident:  
   `⚠️ APM Alert: High Latency Detected (>3500ms) on feature 'enable-typing-indicator'`.
5. **Remediate instantly via LaunchDarkly Webhook Trigger**:
   * **Via In-App Demo Tools:** Click the **⚡ Fire Kill Switch Trigger** button.
   * **Or via Terminal:** Click **📋 Copy curl** and run it directly in your terminal:
     ```bash
     curl -X POST <YOUR_LD_TRIGGER_URL>
     ```
6. **Watch the Recovery in Real Time:**
   * LaunchDarkly executes the webhook trigger and turns `enable-typing-indicator` **OFF**.
   * The client SDK's streaming listener immediately catches the flag change: the typing indicator is unmounted, the APM alert clears, and latency immediately drops back to normal—**zero downtime, zero code redeploy, zero page refresh!**

> **Enterprise Architecture Note:** In enterprise production, LaunchDarkly **Release Guardrails** and native APM integrations (Datadog/New Relic) monitor metric thresholds directly and invoke this rollback automatically without any manual intervention. For scripted CI/CD pipelines, LaunchDarkly also supports the Semantic Patch REST API (`PATCH /api/v2/flags/...`).

### 3. Part 2: Context Targeting & Evaluation Inspector
The app features three distinct personas that cleanly demonstrate LaunchDarkly's targeting hierarchy, coupled with a live **Evaluation Reason Inspector** powered by `variationDetail()`:

1. **Default Fallthrough (Bob):**
   * Select **"Bob (Free - Standard)"** in the persona dropdown.
   * Look at the **Live Feature Flag Status** inside the Demo Tools drawer:
     * Active Context: `key: bob-standard`, `plan: free`, `role: viewer`.
     * Flag Evaluation: `false (Blocked)`.
     * Reason: `FALLTHROUGH (Default Rule: false)`.
     * The premium button is hidden.
2. **Rule-Based Custom Attribute Target (Alice):**
   * Switch the dropdown to **"Alice (Enterprise - Rule Match)"**.
   * LaunchDarkly dynamically re-evaluates the context:
     * Active Context: `key: alice-corp`, `plan: enterprise`, `role: admin`.
     * Flag Evaluation: `true (Served)`.
     * Reason: `RULE_MATCH (Rule #1: plan = enterprise)`.
     * The gold **"✨ Premium Entitlement Unlocked: Summarize Conversation"** appears immediately above the input bar!
3. **Individual Whitelist Target (Charlie - The Beta Tester):**
   * Switch the dropdown to **"Charlie (Free - Individual VIP)"**.
   * **The Key Takeaway for the Evaluator:** Charlie is on the `free` plan, yet the feature is **served** (`true`)!
     * Active Context: `key: charlie-beta`, `plan: free`, `role: tester`.
     * Flag Evaluation: `true (Served)`.
     * Reason: `TARGET_MATCH (Individual Target: charlie-beta)`.
   * This proves that Individual Targets take precedence over rules, enabling targeted canary testing and early access cohorts with zero ambiguity.



### 4. Extra Credit: AI Configs & Experimentation
1. **Dynamic Model & Prompt Serving**:
   * Send a chat message. Notice the bot responds with an active AI metadata badge:  
     `⚡ Simulated gpt-3.5-turbo (Concise Mode)` or `⚡ Simulated gpt-4 (Enterprise Expert Mode)` (or `⚡ Live OpenAI` if an API key is provided).
   * Explain how `chatbot-ai-config` controls the model parameters and system prompt entirely on the backend with zero code redeploys.
2. **Telemetry & Experimentation**:
   * Click the **👍 Helpful** feedback button under a bot response.
   * Both the client and server SDK record the custom metric event:
     * Client: `ldClient.track('bot-thumbs-up')`
     * Server: `ldclient.get().track('bot-thumbs-up', context)`
   * Direct the interviewer to the **Experiments > AI Prompt & Model Optimization** dashboard in LaunchDarkly to show live exposures and conversions being recorded.
   * 💡 **Reviewer Tip (Simulate Batch Traffic):** You can generate realistic A/B experiment traffic anytime by running:
     ```bash
     python simulate_traffic.py
     ```


---

## 🧠 Architectural Deep-Dive: GenAI & LaunchDarkly

During a technical evaluation or client consultation, Solutions Engineers are expected to articulate how LaunchDarkly manages AI workloads in enterprise architectures. Here are the core approaches and trade-offs demonstrated by this repository:

### 1. Client-Side vs. Server-Side AI Evaluation (Design Decision)
* **Why `chatbot-ai-config` is Server-Side**:
  * **IP & Prompt Secrecy:** System prompts contain proprietary instructions, guardrails, and company tone guidelines. Evaluating this flag client-side would expose system prompts in network inspection.
  * **Credential Protection:** LLM provider API keys (OpenAI, Anthropic, Bedrock) remain safely isolated on the backend.
  * **Zero Latency Overhead:** The LaunchDarkly Python server SDK maintains an in-memory streaming cache of flag states. Flag evaluation adds `<0.1ms` of latency, avoiding network round-trips before calling the LLM.

### 2. Alternative Architecture A: Multi-Provider Failover & Redundancy Routing
* **Problem:** Public LLM providers experience periodic outages, rate limits (HTTP 429), and latency spikes.
* **LaunchDarkly Solution:** A multi-variate JSON flag can define provider routing hierarchy:
  ```json
  {
    "primary_provider": "openai",
    "primary_model": "gpt-4o",
    "fallback_provider": "anthropic",
    "fallback_model": "claude-3-5-sonnet",
    "timeout_ms": 3000
  }
  ```
  Combined with LaunchDarkly Flag Triggers or an APM alert (Datadog/New Relic), the system automatically routes traffic to Anthropic or a self-hosted Llama 3 model if OpenAI error rates exceed 2%.

### 3. Alternative Architecture B: Native LaunchDarkly AI Configs
* LaunchDarkly provides a dedicated **AI Configs** product designed for GenAI teams:
  * **Centralized Prompt Engineering:** AI Product Managers and prompt engineers can draft, test, and version prompts directly in the LaunchDarkly dashboard without opening pull requests.
  * **Hyperparameter Control:** Dynamically tunes `temperature`, `top_p`, `max_tokens`, and frequency penalties across user cohorts or subscription tiers.
  * **Model Directory:** Pre-integrated with major foundation models across AWS Bedrock, Azure OpenAI, Google Cloud Vertex AI, and direct APIs.

### 4. Alternative Architecture C: Dynamic RAG & Guardrails Gating
* **Gating Retrieval-Augmented Generation (RAG):**
  * Control vector database lookup depth (e.g. `top_k: 3` for Free users vs `top_k: 10` for Enterprise users) using context-aware flags.
* **Content Moderation & Guardrails:**
  * Toggle strict PII redaction or safety classifiers on/off per geographic region (e.g., GDPR in the EU vs standard US compliance).

