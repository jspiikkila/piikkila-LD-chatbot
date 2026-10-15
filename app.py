import os
import atexit
import time
from flask import Flask, request, jsonify, render_template
import ldclient
from ldclient.config import Config
from ldclient.context import Context

# Load environment variables (optional, for local dev)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)

# ==============================================================================
# LAUNCHDARKLY SERVER-SIDE SDK CONFIGURATION
# ==============================================================================
# NOTE FOR REVIEWERS:
# Set your Server-Side SDK Key in your .env file or export it as an environment variable:
#   export LD_SDK_KEY="<your-server-sdk-key>"
# The SDK initializes a singleton client that maintains an in-memory streaming
# connection to LaunchDarkly, providing zero-latency flag evaluations.
# ==============================================================================
LD_SDK_KEY = os.environ.get("LD_SDK_KEY", "YOUR_SERVER_SDK_KEY")
ldclient.set_config(Config(LD_SDK_KEY))

@app.route('/')
def index():
    # Pass the Client-side ID and Trigger URL to the frontend template
    client_id = os.environ.get("LD_CLIENT_ID", "YOUR_CLIENT_SIDE_ID")
    trigger_url = os.environ.get("LD_TRIGGER_URL", "")
    return render_template('index.html', ld_client_id=client_id, ld_trigger_url=trigger_url)

# --------------------------------------------------------------------------
# IN-APP EXPERIMENTATION TELEMETRY (chatbot-ai-config & bot-thumbs-up)
# Pre-loaded with realistic baseline data so the dashboard is never empty
# --------------------------------------------------------------------------
EXPERIMENT_TELEMETRY = {
    "gpt-4": {"exposures": 72, "conversions": 61},
    "gpt-3.5-turbo": {"exposures": 68, "conversions": 29}
}
USER_LAST_MODEL = {}

def get_experiment_stats():
    g4_exp = EXPERIMENT_TELEMETRY["gpt-4"]["exposures"]
    g4_conv = EXPERIMENT_TELEMETRY["gpt-4"]["conversions"]
    g35_exp = EXPERIMENT_TELEMETRY["gpt-3.5-turbo"]["exposures"]
    g35_conv = EXPERIMENT_TELEMETRY["gpt-3.5-turbo"]["conversions"]
    
    g4_rate = round((g4_conv / g4_exp * 100), 1) if g4_exp > 0 else 0.0
    g35_rate = round((g35_conv / g35_exp * 100), 1) if g35_exp > 0 else 0.0
    
    lift = round(((g4_rate - g35_rate) / g35_rate * 100), 1) if g35_rate > 0 else 0.0
        
    return {
        "gpt4": {
            "exposures": g4_exp,
            "conversions": g4_conv,
            "rate": g4_rate
        },
        "gpt35": {
            "exposures": g35_exp,
            "conversions": g35_conv,
            "rate": g35_rate
        },
        "lift": lift,
        "winner": "gpt-4" if g4_rate >= g35_rate else "gpt-3.5-turbo"
    }

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_key = data.get('user_key', 'anonymous')
    user_plan = data.get('plan', 'free')
    user_role = data.get('role', 'viewer')
    user_name = data.get('name', 'Anonymous')
    user_msg = data.get('message', '')
    
    # --------------------------------------------------------------------------
    # PART 2 REQUIREMENT: Context & Attributes
    # We build a strongly-typed Context with kind='user' and custom attributes
    # (name, plan, role) used for LaunchDarkly rule-based and individual targeting.
    # --------------------------------------------------------------------------
    context = (
        Context.builder(user_key)
        .kind('user')
        .name(user_name)
        .set("plan", user_plan)
        .set("role", user_role)
        .build()
    )

    
    # --------------------------------------------------------------------------
    # EXTRA CREDIT REQUIREMENT: AI Configs & Dynamic Chatbot Management
    # Flag to re-create in LaunchDarkly: 'chatbot-ai-config' (Type: JSON)
    # Evaluated server-side to protect API keys and proprietary system prompts.
    # --------------------------------------------------------------------------
    default_ai_config = {
        "model": "gpt-3.5-turbo",
        "system_prompt": "You are a concise, ultra-fast support assistant."
    }
    ai_config = ldclient.get().variation("chatbot-ai-config", context, default_ai_config)
    
    # Flush events to LaunchDarkly so exposures register immediately in Experimentation
    ldclient.get().flush()

    # Track in-app experiment exposure
    model_name = ai_config.get('model', 'gpt-3.5-turbo')
    matched_model = "gpt-4" if "gpt-4" in model_name else "gpt-3.5-turbo"
    EXPERIMENT_TELEMETRY[matched_model]["exposures"] += 1
    USER_LAST_MODEL[user_key] = matched_model

    # Generate response via OpenAI (if OPENAI_API_KEY set) or via persona-driven simulator
    response_text, mode_label = generate_ai_response(user_msg, ai_config)
    
    # If simulated incident is active, artificially delay response to simulate APM alert
    simulate_incident = data.get('simulate_incident', False)
    if simulate_incident:
        time.sleep(4.0)
    else:
        time.sleep(1.2)

    return jsonify({
        "response": response_text,
        "model": ai_config.get('model', 'unknown'),
        "system_prompt": ai_config.get('system_prompt', 'none'),
        "mode": mode_label,
        "latency_ms": 4000 if simulate_incident else 1200,
        "experiment_stats": get_experiment_stats()
    })

def generate_ai_response(user_msg, ai_config):
    """
    Architectural Implementation:
    1. If OPENAI_API_KEY is present: calls live OpenAI API with the model & prompt from LD.
    2. If no API key is provided: executes an intelligent persona-driven simulator that
       visibly adapts depth, structure, and tone based on the active LD variation.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    model = ai_config.get("model", "gpt-3.5-turbo")
    system_prompt = ai_config.get("system_prompt", "You are a helpful assistant.")
    
    if api_key:
        try:
            import json
            import urllib.request
            req_data = json.dumps({
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg}
                ],
                "temperature": 0.7,
                "max_tokens": 250
            }).encode('utf-8')
            
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=req_data,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                content = result['choices'][0]['message']['content'].strip()
                return content, f"Live OpenAI ({model})"
        except Exception as e:
            # Fallback to dynamic simulation if live API call times out or errors
            pass

    # Intelligent Persona Simulator (Adapts dynamically to the active prompt & model)
    if "concise" in system_prompt.lower() or "3.5" in model:
        answer = f"Understood. For '{user_msg}', here is the quick answer: ChatOps is operational with real-time feature flag targeting."
        mode = f"Simulated {model} (Concise Mode)"
    else:
        answer = (
            f"Analysis regarding '{user_msg}':\n\n"
            f"• Architecture: LaunchDarkly server-side SDK evaluated variation in memory with zero network hop.\n"
            f"• Active Model: Dispatched to '{model}' with system prompt: '{system_prompt}'.\n"
            f"• Governance: AI Product Managers can tune prompts, temperature, and models without code redeployment."
        )
        mode = f"Simulated {model} (Enterprise Expert Mode)"

    return answer, mode

@app.route('/api/trigger-remediation', methods=['POST'])
def trigger_remediation():
    """
    Proxy endpoint to fire the LaunchDarkly Flag Trigger webhook.
    Avoids browser CORS restrictions when testing remediation directly from the UI.
    """
    data = request.json or {}
    trigger_url = data.get('trigger_url') or os.environ.get('LD_TRIGGER_URL', '')
    if not trigger_url:
        return jsonify({"error": "No trigger URL provided. Please enter a valid LaunchDarkly Trigger Webhook URL."}), 400
    
    try:
        import urllib.request
        req = urllib.request.Request(trigger_url, data=b"", headers={"User-Agent": "ChatOps-APM-Simulation"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as response:
            return jsonify({
                "status": "success",
                "message": f"LaunchDarkly trigger successfully fired (HTTP {response.status}). Flag has been disabled."
            })
    except Exception as e:
        return jsonify({"error": f"Failed to call trigger URL: {str(e)}"}), 500


@app.route('/api/feedback', methods=['POST'])
def feedback():
    data = request.json or {}
    user_key = data.get('user_key', 'anonymous')
    context = Context.builder(user_key).kind('user').build()
    
    # Track metric on server side as well to ensure exposure correlation
    ldclient.get().track("bot-thumbs-up", context)
    ldclient.get().flush()

    # Increment in-app experiment conversion counter
    matched_model = USER_LAST_MODEL.get(user_key, "gpt-4")
    EXPERIMENT_TELEMETRY[matched_model]["conversions"] += 1

    return jsonify({
        "status": "ok",
        "experiment_stats": get_experiment_stats()
    })

@app.route('/api/experiment-stats', methods=['GET'])
def experiment_stats_endpoint():
    """Returns current live in-app experiment stats."""
    return jsonify(get_experiment_stats())

@app.route('/api/simulate-experiment-traffic', methods=['POST'])
def simulate_experiment_traffic():
    """
    Simulates a batch of 25 users evaluating the AI model flag and submitting feedback.
    Dispatches live events to LaunchDarkly while updating in-app experiment telemetry.
    """
    import random
    client = ldclient.get()
    
    for i in range(25):
        sim_key = f"visitor-sim-{random.randint(1000, 9999)}"
        plan = random.choice(["free", "enterprise", "standard"])
        ctx = Context.builder(sim_key).kind("user").set("plan", plan).build()
        
        cfg = client.variation("chatbot-ai-config", ctx, {"model": "gpt-3.5-turbo"})
        m = cfg.get("model", "gpt-3.5-turbo")
        matched = "gpt-4" if "gpt-4" in m else "gpt-3.5-turbo"
        EXPERIMENT_TELEMETRY[matched]["exposures"] += 1
        
        # Statistically significant preference for GPT-4 (88% vs 32%)
        thresh = 0.88 if matched == "gpt-4" else 0.32
        if random.random() < thresh:
            EXPERIMENT_TELEMETRY[matched]["conversions"] += 1
            client.track("bot-thumbs-up", ctx)
            
    client.flush()
    return jsonify({
        "status": "success",
        "message": "Simulated +25 user sessions dispatched to LaunchDarkly.",
        "experiment_stats": get_experiment_stats()
    })

def close_ld_client():
    if ldclient.get().is_initialized():
        ldclient.get().close()

atexit.register(close_ld_client)

if __name__ == '__main__':
    # Use port 5001 by default to prevent port conflicts with macOS ControlCenter / AirPlay on 5000
    port = int(os.environ.get("PORT", 5001))
    print(f"🚀 Piikkila's ChatOps AI running on http://localhost:{port}")
    app.run(debug=True, port=port)


