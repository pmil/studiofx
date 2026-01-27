import json
import time
import threading

from flask import Flask, jsonify, Response
import paho.mqtt.client as mqtt

MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "tiktok/followers"

app = Flask(__name__)

# Shared state (last follower)
state_lock = threading.Lock()
state = {
    "username": None,
    "ts": 0,   # ms
}

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ MQTT connected")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed: {MQTT_TOPIC}")
    else:
        print("❌ MQTT connect failed rc=", rc)

def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8", errors="ignore").strip()
    user = None

    # Accept either JSON or plain text
    try:
        data = json.loads(payload)
        user = (data.get("username") or "").strip()
    except Exception:
        # If payload is like "username followed the host"
        user = payload.split(" followed the host")[0].strip()

    if not user:
        return

    with state_lock:
        state["user"] = user
        state["ts"] = int(time.time() * 1000)

    print("🆕 follower:", user)

def mqtt_loop():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_forever()

@app.route("/state")
def get_state():
    with state_lock:
        return jsonify(state)

@app.route("/overlay")
def overlay():
    # Simple overlay page polling /state
    html = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Follower Overlay</title>
  <style>
    body { margin:0; background:transparent; overflow:hidden; font-family: Arial, sans-serif; }
    #badge {
      position: absolute;
      left: 40px;
      bottom: 60px;
      padding: 14px 18px;
      border-radius: 14px;
      background: rgba(0,0,0,0.70);
      color: white;
      font-size: 34px;
      display: none;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="badge"></div>
<script>
let lastTs = 0;

async function tick() {
  const res = await fetch("/state", { cache: "no-store" });
  const st = await res.json();

  const badge = document.getElementById("badge");

  if (st.ts && st.ts !== lastTs && st.user) {
    lastTs = st.ts;
    badge.textContent = `New follower ${st.user}`;
    badge.style.display = "block";

    // hide after 4s
    setTimeout(() => {
      if (lastTs === st.ts) badge.style.display = "none";
    }, 4000);
  }
}

setInterval(tick, 250);
</script>
</body>
</html>
"""
    return Response(html, mimetype="text/html")

if __name__ == "__main__":
    t = threading.Thread(target=mqtt_loop, daemon=True)
    t.start()

    while True:
        time.sleep(5)

    # Flask server
    # app.run(host="0.0.0.0", port=5005, debug=False)
