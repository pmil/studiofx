import json
import time
import threading
from collections import deque

from flask import Flask, jsonify, Response
import paho.mqtt.client as mqtt

MQTT_HOST = "localhost"
MQTT_PORT = 1883
TOPIC = "tiktok/follow"

DISPLAY_SECONDS = 4  # 3-5 sec

app = Flask(__name__)

queue = deque()
lock = threading.Lock()

current = {
    "active": False,
    "text": "",
    "until": 0,
}

def next_alert_if_needed():
    now = time.time()
    with lock:
        if current["active"] and now < current["until"]:
            return
        # expired or inactive
        current["active"] = False
        current["text"] = ""
        current["until"] = 0

        if queue:
            item = queue.popleft()
            user = item.get("user", "someone")
            current["text"] = f"Thank you for following {user}"
            current["active"] = True
            current["until"] = now + DISPLAY_SECONDS

def mqtt_on_connect(client, userdata, flags, rc):
    client.subscribe(TOPIC)

#def mqtt_on_message(client, userdata, msg):
#    try:
#        payload = json.loads(msg.payload.decode("utf-8", errors="ignore"))
#    except Exception:
#        return

#    if payload.get("type") != "follow":
#        return

#    with lock:
#        queue.append(payload)

#def mqtt_thread():
#    c = mqtt.Client()
#    c.on_connect = mqtt_on_connect
#    c.on_message = mqtt_on_message
#    c.connect(MQTT_HOST, MQTT_PORT, 60)
#    c.loop_forever()

@app.route("/state")
def state():
    #next_alert_if_needed()
    with lock:
        return jsonify({"name":"test"})

@app.route("/overlay")
def overlay():
    # Simple overlay page: polls /state, shows text, plays sound once per alert
    html = f"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Follow Overlay</title>
  <style>
    body {{
      margin: 0; background: transparent; overflow: hidden;
      font-family: Arial, sans-serif;
    }}
    #box {{
      position: absolute; left: 40px; bottom: 60px;
      padding: 14px 18px;
      border-radius: 14px;
      background: rgba(0,0,0,0.65);
      color: white;
      font-size: 28px;
      display: none;
      white-space: nowrap;
    }}
  </style>
</head>
<body>
  <div id="box"></div>
  <audio id="snd" src="/sound.mp3" preload="auto"></audio>

<script>
let lastText = "";
async function tick() {{
  const res = await fetch("/state", {{ cache: "no-store" }});
  const st = await res.json();

  const box = document.getElementById("box");
  const snd = document.getElementById("snd");

  if (st.active && st.text) {{
    box.textContent = st.text;
    box.style.display = "block";

    if (st.text !== lastText) {{
      lastText = st.text;
      try {{
        snd.currentTime = 0;
        await snd.play();
      }} catch (e) {{
        // browser may block autoplay unless OBS/browser source allows it
        console.log("audio blocked:", e);
      }}
    }}
  }} else {{
    box.style.display = "none";
  }}
}}
setInterval(tick, 200);
</script>
</body>
</html>
"""
    return Response(html, mimetype="text/html")

@app.route("/sound.mp3")
def sound():
    # padėk sound.mp3 šalia server.py
    with open("sound.mp3", "rb") as f:
        return Response(f.read(), mimetype="audio/mpeg")

if __name__ == "__main__":
#    t = threading.Thread(target=mqtt_thread, daemon=True)
#    t.start()
    # Flask
    app.run(host="0.0.0.0", port=5005, debug=False)