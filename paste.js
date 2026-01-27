(async () => {
  // 1) Load Paho MQTT library into the page
  if (!window.Paho) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/paho-mqtt@1.1.0/paho-mqtt-min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // 2) MQTT connect (Mosquitto websockets)
  const host = "localhost";      // jei producer paleistas kitame PC, čia įrašyk brokerio IP
  const port = 9001;
  const clientId = "tiktok-producer-" + Math.random().toString(16).slice(2);

  const client = new Paho.MQTT.Client(host, port, "/mqtt", clientId);

  client.onConnectionLost = (r) => console.warn("MQTT lost:", r?.errorMessage);
  client.connect({
    useSSL: false,
    onSuccess: () => console.log("✅ MQTT connected"),
    onFailure: (e) => console.error("MQTT connect failed:", e),
  });

  // 3) XPath for follow system messages (tu jau turi social-message-text)
  const FOLLOW_XPATH = "//*[contains(@class,'social-message-text')]";

  // 4) helpers
  const seen = new Set();

  function parseFollower(text) {
    // Example: "username followed the host"
    const marker = " followed the host";
    if (!text.includes(marker)) return null;
    const user = text.split(marker)[0].trim();
    if (!user) return null;
    return { user, raw: text };
  }

  function publishFollow(user, raw) {
    const payload = JSON.stringify({
      type: "follow",
      user,
      raw,
      ts: Date.now()
    });

    const msg = new Paho.MQTT.Message(payload);
    msg.destinationName = "tiktok/follow";
    client.send(msg);
  }

  // 5) polling loop (paprasta; galiu perrašyti į MutationObserver jei nori)
  window.__followPoll = setInterval(() => {
    const nodes = $x(FOLLOW_XPATH);
    for (const el of nodes) {
      const text = (el.innerText || el.textContent || "").trim();
      if (!text || seen.has(text)) continue;

      const parsed = parseFollower(text);
      if (!parsed) { seen.add(text); continue; }

      seen.add(text);
      publishFollow(parsed.user, parsed.raw);
      console.log("📤 published follow:", parsed.user);
    }
  }, 500);

  window.stopFollowProducer = () => clearInterval(window.__followPoll);
  console.log("ℹ️ stop: stopFollowProducer()");
})();












window.__seenFollow = window.__seenFollow || new Set();

window.__followInterval = setInterval(() => {
  const nodes = $x("//div[@data-e2e='chat-message']");

  for (const el of nodes) {
    const text = (el.innerText || el.textContent || "").trim();
    if (!text || window.__seenFollow.has(text)) continue;

    window.__seenFollow.add(text);

    if (!text.includes("ENDING")) continue;
    const username = text.split("ENDING")[0].trim();
    if (!username) continue;

    console.log("📨 follow -> http:", username);
  }
}, 500);

window.stopFollowProducer = () => clearInterval(window.__followInterval);
console.log("stop: stopFollowProducer()");


// Print all messages
(() => {
  const CHAT_XPATH = "//div[@data-e2e='chat-message']";
  const INTERVAL_MS = 500;

  const seen = new Set();

  console.log("🟢 Chat tracker started");

  const loop = setInterval(() => {
    const nodes = $x(CHAT_XPATH);

    for (const el of nodes) {
      const text = (el.innerText || el.textContent || "").trim();
      if (!text || seen.has(text)) continue;

      const username = text.split("\n")[0].trim();
      if (!username) continue;

      seen.add(text);

      fetch("http://192.168.0.195:5005/ingest/commnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username, raw: text, ts: Date.now() })
      }).catch(err => console.warn("ingest failed:", err));

      console.log("💬 CHAT:", text);
    }
  }, INTERVAL_MS);

  // expose stop function
  window.stopChatTracker = () => {
    clearInterval(loop);
    console.log("🔴 Chat tracker stopped");
  };
})();

// Write messages to file
(() => {
  const CHAT_XPATH = "//div[@data-e2e='chat-message']";
  const INTERVAL_MS = 500;

  window.__chatLog = window.__chatLog || [];
  window.__seenChat = window.__seenChat || new Set();

  window.__chatInterval = setInterval(() => {
    const nodes = $x(CHAT_XPATH);
    for (const el of nodes) {
      const text = (el.innerText || el.textContent || "").trim();
      if (!text || window.__seenChat.has(text)) continue;

      window.__seenChat.add(text);
      window.__chatLog.push({ ts: Date.now(), text });
      console.log("CHAT:", text);
    }
  }, INTERVAL_MS);

  window.stopChat = () => {
    clearInterval(window.__chatInterval);
    console.log("🔴 Chat tracker stopped");
  };

  window.saveChatTxt = () => {
    const content = window.__chatLog.map(x => `${new Date(x.ts).toISOString()} ${x.text}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tiktok-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.saveChatJson = () => {
    const blob = new Blob([JSON.stringify(window.__chatLog, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tiktok-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  console.log("🟢 logging started. stopChat() / saveChatTxt() / saveChatJson()");
})();


// Followers
(() => {
  const FOLLOWER_XPATH = "//div[@data-e2e='social-message-text']";
  const INTERVAL_MS = 500;

  window.__followersLog = window.__followersLog || [];
  window.__seenFollowers = window.__seenFollowers || new Set();

  window.__followersInterval = setInterval(() => {
    const nodes = $x(FOLLOWER_XPATH);
    for (const el of nodes) {
      const text = (el.innerText || el.textContent || "").trim();
      if (!text || window.__seenFollowers.has(text)) continue;
      
      const username = text.split("\n")[0].trim();


      window.__seenFollowers.add(text);
      window.__followersLog.push({ ts: Date.now(),username , text });
      console.log("follower:", username, " text:", text);
    }
  }, INTERVAL_MS);

  window.stopFollowers = () => {
    clearInterval(window.__followersInterval);
    console.log("🔴 Followers tracker stopped");
  }

  window.saveFollowerTxt = () => {
    const content = window.__followersLog.map(x => `${new Date(x.ts).toISOString()} ${x.text}`).join("\n");   
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tiktok-followers-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.saveFollowersJson = () => {
    const blob = new Blob([JSON.stringify(window.__followersLog, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tiktok-followers-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  console.log("🟢 logging started. stopFollowers() / saveFollowersTxt() / saveFollowersJson()");
})();
