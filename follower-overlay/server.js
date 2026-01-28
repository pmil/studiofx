// server.js
// Private follower overlay server (API push -> on-screen overlay)
// Run: node server.js
require("dotenv").config();

const express = require("express");

const app = express();
app.use(express.json({ limit: "100kb" }));

// ====== CONFIG ======
const PORT = process.env.PORT || 5005;
const API_TOKEN = process.env.API_TOKEN || "change-me"; // set env in production
if (!API_TOKEN) throw new Error("API_TOKEN missing");
const MAX_LIST = 5; // how many followers to keep
const BANNER_MS = 4500; // banner display duration on client

// ====== STATE ======
let followers = []; // newest first: { username, ts }
let clients = new Set(); // SSE connections

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(res);
    }
  }
}

function requireToken(req, res, next) {
  const token = req.header("x-api-token");
  if (!token || token !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// ====== API ======
app.post("/api/follow", requireToken, (req, res) => {
  const username = String(req.body?.username || "").trim();
  if (!username) return res.status(400).json({ ok: false, error: "missing username" });

  const item = { username, ts: Date.now() };
  followers.unshift(item);
  followers = followers.slice(0, MAX_LIST);

  broadcast({ type: "follow", item, followers });

  res.json({ ok: true });
});

// Optional: bulk push
app.post("/api/follows", requireToken, (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(arr)) return res.status(400).json({ ok: false, error: "expected array" });

  const added = [];
  for (const x of arr) {
    const username = String(x?.username || "").trim();
    if (!username) continue;
    added.push({ username, ts: Date.now() });
  }

  if (!added.length) return res.status(400).json({ ok: false, error: "no valid usernames" });

  followers = [...added.reverse(), ...followers].slice(0, MAX_LIST); // keep newest first
  broadcast({ type: "bulk", added, followers });

  res.json({ ok: true, added: added.length });
});

// ====== SSE STREAM ======
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: "init", followers })}\n\n`);

  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
  });
});

// ====== OVERLAY PAGE ======
app.get("/", (req, res) => {
  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Follower Overlay</title>
  <style>
    html, body { margin:0; padding:0; background:transparent; overflow:hidden; font-family: Arial, sans-serif; }

    /* Top banner */
    #banner {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 16px;
      border-radius: 14px;
      background: rgba(0,0,0,0.70);
      color: #fff;
      font-size: 34px;
      display: none;
      white-space: nowrap;
    }

    /* Bottom list */
    #panel {
      position: fixed;
      left: 18px;
      right: 18px;
      bottom: 18px;
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(0,0,0,0.55);
      color: #fff;
    }

    #title { font-size: 18px; opacity: 0.9; margin-bottom: 8px; }
    #list { margin: 0; padding-left: 18px; font-size: 20px; }
    #list li { margin: 4px 0; }

    .muted { opacity: 0.75; font-size: 14px; margin-top: 8px; }
    code { background: rgba(255,255,255,0.10); padding: 2px 6px; border-radius: 8px; }
  </style>
</head>
<body>
  <div id="banner"></div>

  <div id="panel">
    <div id="title">Recent followers</div>
    <ol id="list"></ol>
    <div class="muted">Overlay: <code>/</code> • Events: <code>/events</code> • Push API: <code>POST /api/follow</code></div>
  </div>

<script>
  const banner = document.getElementById("banner");
  const list = document.getElementById("list");
  let hideTimer = null;

  function renderList(followers) {
    list.innerHTML = "";
    for (const f of followers) {
      const li = document.createElement("li");
      li.textContent = f.username;
      list.appendChild(li);
    }
  }

  function showBanner(username) {
    banner.textContent = "New follower " + username;
    banner.style.display = "block";
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      banner.style.display = "none";
    }, ${BANNER_MS});
  }

  const es = new EventSource("/events");
  es.onmessage = (msg) => {
    const ev = JSON.parse(msg.data);

    if (ev.type === "init") {
      renderList(ev.followers || []);
      return;
    }

    if (ev.type === "follow") {
      showBanner(ev.item.username);
      renderList(ev.followers || []);
      return;
    }

    if (ev.type === "bulk") {
      // show last added as banner
      const last = ev.added && ev.added.length ? ev.added[ev.added.length - 1] : null;
      if (last) showBanner(last.username);
      renderList(ev.followers || []);
      return;
    }
  };

  es.onerror = () => {
    // keep quiet; EventSource auto-reconnects
  };
</script>
</body>
</html>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔐 API token header: x-api-token = ${API_TOKEN}`);
});