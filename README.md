# ChatOps AI - LaunchDarkly Technical Exercise

This repository is a demonstration of LaunchDarkly's capabilities, fulfilling all requirements of the LaunchDarkly SE Technical Exercise. 

The application is a GenAI Chatbot interface ("ChatOps AI") built with **Python (Flask)** on the backend and **JavaScript (HTML/CSS)** on the frontend.

---

## 📋 Requirements Fulfilled

| Requirement | Implementation Detail |
| :--- | :--- |
| **Part 1: Release and Remediate** | `enable-typing-indicator` toggles UI elements reactively via the JavaScript SDK event listeners (`.on('change')`) with **zero page reload**. Includes an automated remediation kill switch using LaunchDarkly's Semantic Patch REST API. |
| **Part 2: Target** | `enable-premium-features` gates features using custom context attributes (`plan: premium` vs `plan: free`) and individual user targeting (`jane-doe`). |
| **Extra Credit: AI Configs** | `chatbot-ai-config` dynamically controls the AI model (`gpt-3.5-turbo` vs `gpt-4`) and system prompts server-side without redeploying code. |
| **Extra Credit: Experimentation** | Custom telemetry metric (`bot-thumbs-up`) tracks user feedback on AI responses, powering an active A/B Experiment comparing model satisfaction. |

---

## 🛠 Prerequisites & Environment Assumptions

1. **Python 3.9+** installed.
2. A **LaunchDarkly Account** (Free Trial or Enterprise).
3. `curl` installed (for running the kill-switch API command).

---

## 🚀 Setup & Execution Guide

Choose the path that best matches your evaluation preference:

| Path | When to Choose | Time Required |
| :--- | :--- | :--- |
| **Option A: Fast-Track (Recommended)** | Choose this if you want to test the live app **immediately** without spending time configuring flags. Uses the candidate's active LaunchDarkly tenant. | **~2 minutes** |
| **Option B: Recreate from Scratch** | Choose this if you want to test clean-room deployment by creating fresh flags in your own LaunchDarkly account. | **~10 minutes** |

---

### Option A: Fast-Track Evaluation (Recommended)
> **Goal:** Run the application immediately using the candidate's pre-configured LaunchDarkly environment. All 3 flags, targeting rules, and the active A/B experiment are already live and collecting data!

1. Clone this repository:
   ```bash
   git clone <REPO_URL>
   cd launchdarkly_chatbot
   ```
2. Create your `.env` file from the template:
   ```bash
   cp .env.example .env
   ```
3. Populate `.env` with the demo credentials (provided via email / submission form, or request invite access to the tenant):
   ```bash
   LD_SDK_KEY="<provided-demo-server-key>"
   LD_CLIENT_ID="<provided-demo-client-id>"
   ```
4. Install dependencies and start the app:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```
5. Navigate to `http://localhost:5000` to begin the demo walkthrough!

---

### Option B: Recreate in Your Own LaunchDarkly Tenant

If you prefer to recreate the environment from scratch in your own LaunchDarkly account, follow these steps:

#### 1. Create Feature Flags
Create the following three flags in your environment (e.g., `Test`):

1. **`enable-typing-indicator`**
   * **Kind**: Boolean
   * **Client-side availability**: Check **"Available on client-side SDKs"** (under Settings/Advanced controls).
   * **Default variation**: `false`

2. **`enable-premium-features`**
   * **Kind**: Boolean
   * **Client-side availability**: Check **"Available on client-side SDKs"**.
   * **Targeting Rules**:
     * Add rule: If `user.plan` is `premium` -> Serve `true`.
     * Individual target: Add context `jane-doe` -> Serve `true`.
     * Default rule: Serve `false`.

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

## 🎬 3-Minute Interview Demo Walkthrough

### 1. Part 1: Instant Releases & Rollbacks (No Reload)
1. Open `http://localhost:5000`.
2. In LaunchDarkly, toggle **`enable-typing-indicator`** to **ON**.
3. Send a message in the chat. Note the "Bot is typing..." indicator appears for 1.2s before the response.
4. **Instant Rollback**: Toggle the flag to **OFF** in LaunchDarkly. Send another message. Notice the indicator disappears immediately without refreshing the browser.

### 2. Part 1: Automated Remediation (Kill Switch via curl)
Simulate an incident (e.g., an APM tool detecting high latency or error spikes):
1. Ensure `enable-typing-indicator` is ON.
2. Run this command in your terminal to invoke the LaunchDarkly REST API:
   ```bash
   curl -s -X PATCH \
     -H "Authorization: <YOUR_API_TOKEN>" \
     -H "Content-Type: application/json; domain-model=launchdarkly.semanticpatch" \
     -d '{
       "environmentKey": "test",
       "comment": "Automated incident remediation kill switch",
       "instructions": [{"kind": "turnFlagOff"}]
     }' \
     https://app.launchdarkly.com/api/v2/flags/default/enable-typing-indicator
   ```
3. Refresh LaunchDarkly or send a message—the feature was turned off in milliseconds.

### 3. Part 2: Context Targeting (Entitlements)
1. In the chatbot header, observe the **"Login as:"** selector.
2. While logged in as **Free User (Anonymous)**, notice only standard chat is accessible.
3. Switch the dropdown to **Premium User (Jane Doe)**.
4. The client immediately evaluates the new context (`user.plan = premium` and `key = jane-doe`).
5. The gold **"🌟 Premium Feature: Summarize Chat"** button appears instantly! Click it to generate an AI summary card.

### 4. Extra Credit: AI Configs & Experimentation
1. Explain how `chatbot-ai-config` manages the LLM system prompt and model type on the backend without code redeploys.
2. Send a message and click the **👍 Helpful** feedback button.
3. Point the interviewer to the **Experiments > AI Prompt & Model Optimization** dashboard in LaunchDarkly to show live exposures and conversions being recorded.
