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
    # Pass the Client-side ID to the frontend template so it can initialize the JS SDK
    client_id = os.environ.get("LD_CLIENT_ID", "YOUR_CLIENT_SIDE_ID")
    return render_template('index.html', ld_client_id=client_id)

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_key = data.get('user_key', 'anonymous')
    user_plan = data.get('plan', 'free')
    user_msg = data.get('message', '')
    
    # --------------------------------------------------------------------------
    # PART 2 REQUIREMENT: Context & Attributes
    # We build a strongly-typed Context with kind='user' and custom attributes
    # (e.g. plan: 'premium' vs 'free') used for LaunchDarkly rule-based targeting.
    # --------------------------------------------------------------------------
    context = Context.builder(user_key).kind('user').set("plan", user_plan).build()
    
    # --------------------------------------------------------------------------
    # EXTRA CREDIT REQUIREMENT: AI Configs
    # Flag to re-create in LaunchDarkly: 'chatbot-ai-config' (Type: JSON)
    # Allows AI PMs to dynamically update models and prompts without code deploys.
    # --------------------------------------------------------------------------
    default_ai_config = {
        "model": "gpt-3.5-turbo",
        "system_prompt": "You are a helpful and concise assistant."
    }
    ai_config = ldclient.get().variation("chatbot-ai-config", context, default_ai_config)
    
    # Flush events to LaunchDarkly so exposures register immediately in Experimentation
    ldclient.get().flush()

    response_text = (
        f"🤖 [Mock AI Response]\n"
        f"Model used: {ai_config.get('model', 'unknown')}\n"
        f"Active Prompt: '{ai_config.get('system_prompt', 'none')}'\n\n"
        f"I received your message: '{user_msg}'"
    )
    
    time.sleep(1.2)
    return jsonify({"response": response_text})

@app.route('/api/feedback', methods=['POST'])
def feedback():
    data = request.json or {}
    user_key = data.get('user_key', 'anonymous')
    context = Context.builder(user_key).kind('user').build()
    
    # Track metric on server side as well to ensure exposure correlation
    ldclient.get().track("bot-thumbs-up", context)
    ldclient.get().flush()
    return jsonify({"status": "ok"})

def close_ld_client():
    if ldclient.get().is_initialized():
        ldclient.get().close()

atexit.register(close_ld_client)

if __name__ == '__main__':
    # Run the Flask app
    app.run(debug=True, port=5000)
