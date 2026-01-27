# Install flask
python -m pip install flask
python -m pip install paho-mqtt

# run server
python studiofx.py

# convert sound
ffmpeg -i radio_scan_fx.wav sound.mp3


cp ./systemd/*.* ~/.config/systemd/user/

systemctl --user daemon-reload
systemctl --user enable --now copy-tiktok-json.timer

systemctl --user status copy-tiktok-json.timer

# source venv
source ./venv/bin/activate

# Environment variables
export WATCH_DIR="./workingfiles"
export MQTT_HOST="127.0.0.1"
export MQTT_PORT="1883"
export MQTT_TOPIC="tiktok/followers"
export POLL_SEC="0.5"

python tiktok_followers_to_mqtt.py

# mqqt read topic
mosquitto_sub -t tiktok/follow -v
