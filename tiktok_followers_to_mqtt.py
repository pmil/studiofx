#!/usr/bin/env python3
import json
import os
import re
import time
from pathlib import Path
from typing import Optional, Tuple

import paho.mqtt.client as mqtt


FILENAME_RE = re.compile(r"tiktok-followers-(\d+)\.json$")


def newest_file(dir_path: Path) -> Optional[Path]:
    files = list(dir_path.glob("tiktok-followers-*.json"))
    if not files:
        return None

    # Prefer numeric suffix in filename
    scored: list[Tuple[int, Path]] = []
    fallback: list[Path] = []

    for f in files:
        m = FILENAME_RE.search(f.name)
        if m:
            scored.append((int(m.group(1)), f))
        else:
            fallback.append(f)

    if scored:
        scored.sort(key=lambda x: x[0])
        return scored[-1][1]

    # Fallback: newest by mtime
    fallback.sort(key=lambda p: p.stat().st_mtime)
    return fallback[-1]


def load_state(state_path: Path) -> int:
    try:
        data = json.loads(state_path.read_text(encoding="utf-8"))
        return int(data.get("last_ts", 0))
    except FileNotFoundError:
        return 0
    except Exception:
        return 0


def save_state(state_path: Path, last_ts: int) -> None:
    tmp = state_path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"last_ts": last_ts}, ensure_ascii=False), encoding="utf-8")
    tmp.replace(state_path)


def read_json(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def main():
    watch_dir = Path(os.environ.get("WATCH_DIR", "workingfiles")).expanduser().resolve()
    state_file = Path(os.environ.get("STATE_FILE", str(watch_dir / ".tiktok_followers_state.json"))).expanduser().resolve()

    mqtt_host = os.environ.get("MQTT_HOST", "127.0.0.1")
    mqtt_port = int(os.environ.get("MQTT_PORT", "1883"))
    mqtt_topic = os.environ.get("MQTT_TOPIC", "tiktok/followers")
    mqtt_user = os.environ.get("MQTT_USER")
    mqtt_pass = os.environ.get("MQTT_PASS")
    mqtt_client_id = os.environ.get("MQTT_CLIENT_ID", "tiktok-followers-watcher")

    poll_sec = float(os.environ.get("POLL_SEC", "1.0"))

    if not watch_dir.exists():
        raise SystemExit(f"WATCH_DIR does not exist: {watch_dir}")

    last_ts = load_state(state_file)

    client = mqtt.Client(client_id=mqtt_client_id, clean_session=True)
    if mqtt_user:
        client.username_pw_set(mqtt_user, mqtt_pass)

    # connect once and keep loop running
    client.connect(mqtt_host, mqtt_port, keepalive=30)
    client.loop_start()

    try:
        while True:
            f = newest_file(watch_dir)
            if f is None:
                time.sleep(poll_sec)
                continue

            obj = read_json(f)
            if not obj:
                time.sleep(poll_sec)
                continue
            
            # print(obj)

            for record in obj:
                ts = int(record.get("ts", 0))
                text = str(record.get("text", "")).strip()
                username = str(record.get("username", "")).strip()

                # Only publish "started following" (optional, bet logiška)
                if ts > last_ts and username and text:
                    if text.lower() == "started following":
                        payload = json.dumps(record, ensure_ascii=False)
                        info = client.publish(mqtt_topic, payload=payload, qos=1, retain=False)
                        info.wait_for_publish()

                        last_ts = ts
                        save_state(state_file, last_ts)

            time.sleep(poll_sec)

    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
