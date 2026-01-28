import json
import time
import threading
import urllib.request
from dotenv import load_dotenv
import os

import paho.mqtt.client as mqtt

load_dotenv()

MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "tiktok/followers"
API_URL = "http://192.168.0.195:5005/api/follow"
API_TOKEN = os.environ.get("API_TOKEN")
if not API_TOKEN:
    raise RuntimeError("API_TOKEN missing")

# dedupe: nepushinam identiško teksto kelis kartus
seen = set()
seen_lock = threading.Lock()

def post_follow(username: str) -> bool:
    payload = json.dumps({"username": username}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-token": API_TOKEN,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        print("❌ API post failed:", e)
        return False

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ MQTT connected")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed: {MQTT_TOPIC}")
    else:
        print("❌ MQTT connect failed rc=", rc)

def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8", errors="ignore").strip()
    payload = msg.payload.decode("utf-8", errors="ignore").strip()
    username = ""

    # Accept either JSON or plain text
    try:
        data = json.loads(payload)
        username = (data.get("username") or data.get("user") or "").strip()
    except Exception:
        # If payload is like "username followed the host"
        username = payload.split(" followed the host")[0].strip()

    if not username:
        return
    
    # Dedupe
    key = username
    with seen_lock:
        if key in seen:
            return
        seen.add(key)
        # optionally limit memory
        if len(seen) > 5000:
            seen.clear()

    ok = post_follow(username)
    if ok:
        print("🆕 pushed follower:", username)
    else:
        print("⚠️ failed to push follower:", username)

def mqtt_loop():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_forever()

if __name__ == "__main__":
    t = threading.Thread(target=mqtt_loop, daemon=True)
    t.start()

    while True:
        time.sleep(5)
