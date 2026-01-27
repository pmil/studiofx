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

      if (!text.includes("followed the host")) continue;
      
      const username = text.split("followed the host")[0].trim();


      window.__seenFollowers.add(text);
      window.__followersLog.push({ ts: Date.now(),username , text: "started following" });
      console.log("follower:", username, " text:", " started following");
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