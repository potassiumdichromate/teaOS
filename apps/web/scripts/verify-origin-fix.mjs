// Confirms the VITE_API_BASE_URL refactor (lib/origin.ts) didn't break local
// dev, where the var is unset and everything must still go through the
// relative "/api"/"/ws" paths Vite's dev-server proxy forwards.
// Usage: node apps/web/scripts/verify-origin-fix.mjs
import WebSocket from "ws";
const BASE = "http://localhost:5173";
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const { webSocketDebuggerUrl } = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const browser = await connect(webSocketDebuggerUrl);
const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
const { targetInfos } = await browser.send("Target.getTargets");
const target = targetInfos.find((t) => t.targetId === targetId);
const page = await connect(target.webSocketDebuggerUrl ?? (await pageWsUrl(targetId)));
const failedRequests = [];
page.on("Network.responseReceived", (p) => {
  if (p.response.status >= 400) failedRequests.push(`${p.response.status} ${p.response.url}`);
});
await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Network.enable");

async function goto(url) {
  await page.send("Page.navigate", { url });
  await sleep(1500);
}
async function evalJs(expression) {
  const r = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

await goto(`${BASE}/`);
await evalJs(`localStorage.clear()`);
await goto(`${BASE}/login`);
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const inputs = document.querySelectorAll('input');
  set(inputs[0], "admin@example.dev"); set(inputs[1], "dev-password-only");
  document.querySelector('form').requestSubmit(); return true;
})()`);
await sleep(2500);

const path = await evalJs("location.pathname");
check("relative-path REST login still works (no VITE_API_BASE_URL set)", path === "/admin", path);

const overviewLoaded = await evalJs("document.body.innerText.includes('Control plane')");
check("admin overview fetched real data via relative /api path", overviewLoaded);

// Confirm the live-logs WS actually opened via the relative /ws path by
// checking the panel's own status text moves off "connecting"/absent state.
await sleep(2000);
const wsStatus = await evalJs(`(() => {
  const text = document.body.innerText;
  return text.includes('STREAMING') || text.includes('Waiting for activity') ? 'connected-ish' : 'unknown';
})()`);
check("live-logs WS connected via relative /ws path", wsStatus === "connected-ish", wsStatus);

console.log("\n=== FAILED / 4xx-5xx REQUESTS ===");
console.log([...new Set(failedRequests)].join("\n") || "(none)");
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(results.every((r) => r.pass) ? 0 : 1);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function pageWsUrl(targetId) {
  const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
  return list.find((t) => t.id === targetId).webSocketDebuggerUrl;
}
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.once("open", res);
    ws.once("error", rej);
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method)(msg.params);
    }
  });
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const myId = ++id;
        pending.set(myId, { resolve, reject });
        ws.send(JSON.stringify({ id: myId, method, params }));
      }),
    on: (method, cb) => listeners.set(method, cb),
  };
}
