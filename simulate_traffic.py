"""
LaunchDarkly Traffic & Experimentation Simulator
Generates realistic user sessions, flag evaluations, and conversion metric events
to populate LaunchDarkly Experimentation dashboards.
"""
import os
import time
import random
import ldclient
from ldclient.config import Config
from ldclient.context import Context
from dotenv import load_dotenv

load_dotenv()

def run_simulation(num_users=30):
    sdk_key = os.environ.get("LD_SDK_KEY")
    if not sdk_key or "YOUR_SERVER" in sdk_key:
        print("❌ Error: Please set a valid LD_SDK_KEY in your .env file.")
        return

    ldclient.set_config(Config(sdk_key))
    client = ldclient.get()

    if not client.is_initialized():
        print("Connecting to LaunchDarkly...")
        time.sleep(3)

    print(f"🚀 Generating experiment traffic for {num_users} users...\n")

    stats = {
        "gpt-4": {"exposures": 0, "conversions": 0},
        "gpt-3.5-turbo": {"exposures": 0, "conversions": 0}
    }

    for i in range(1, num_users + 1):
        user_key = f"visitor-{random.randint(100, 999)}-{i}"
        plan = random.choice(["free", "enterprise", "standard"])
        ctx = Context.builder(user_key).kind("user").set("plan", plan).build()

        # 1. Evaluate Flag (Exposure)
        config = client.variation("chatbot-ai-config", ctx, {"model": "gpt-3.5-turbo"})
        model = config.get("model", "gpt-3.5-turbo")

        matched_model = "gpt-4" if "gpt-4" in model else "gpt-3.5-turbo"
        stats[matched_model]["exposures"] += 1

        # Conversion behavior: strong positive lift for GPT-4 (90% vs 30%)
        conv_threshold = 0.90 if matched_model == "gpt-4" else 0.30
        if random.random() < conv_threshold:
            stats[matched_model]["conversions"] += 1
            client.track("bot-thumbs-up", ctx)


    print("--- Simulation Results ---")
    for m, d in stats.items():
        exp = d["exposures"]
        conv = d["conversions"]
        rate = (conv / exp * 100) if exp > 0 else 0
        print(f"• {m}: {exp} Exposures | {conv} Thumbs Up ({rate:.1f}% conversion rate)")

    print("\nFlushing events to LaunchDarkly...")
    client.flush()
    time.sleep(3)
    client.close()
    print("✅ Done! Check your LaunchDarkly Experiments & Live Events dashboards.")

if __name__ == "__main__":
    run_simulation(30)
