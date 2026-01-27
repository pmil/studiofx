import json
import time
import threading
from collections import deque

from flask import Flask, jsonify, Response, request, make_response
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

# --- CORS helper ---
@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return resp

@app.route("/ingest/commnet", methods=["POST", "OPTIONS"])
def ingest_comment():
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(force=True, silent=True) or {}
    user = (data.get("user") or "").strip()
    raw = (data.get("raw") or "").strip()
    ts = int(data.get("ts") or 0)

    if not user:
        return make_response({"ok": False, "err": "missing user"}, 400)

    payload = json.dumps({"type": "follow", "user": user, "raw": raw, "ts": ts or int(time.time()*1000)})
    print(f"{payload}")

    # publish į MQTT (rekomenduoju turėti global mqtt client arba atskirą publisher)
    pub = mqtt.Client()
    pub.connect(MQTT_HOST, MQTT_PORT, 60)
    pub.publish(f"{TOPIC}", payload)
    pub.disconnect()

    return {"ok": True}

if __name__ == "__main__":
    # Flask
    app.run(host="0.0.0.0", port=5005, debug=False)
