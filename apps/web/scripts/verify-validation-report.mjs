// Verifies the real rejection reasons (bias/grammar/duplicate breakdown from
// AIValidationReport) are actually visible in the frontend — not just
// present in the /status API response. Reuses whatever REJECTED question
// already exists in the DB from earlier testing rather than spending real
// 0G Compute credits on a fresh submission just to check a UI.
// Usage: node apps/web/scripts/verify-validation-report.mjs [outDir]
import WebSocket from "ws";
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2] ?? "./verify-shots";
mkdirSync(OUT, { recursive: true });
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
const consoleErrors = [];
const failedRequests = [];
page.on("Runtime.exceptionThrown", (p) =>
  consoleErrors.push(`EXCEPTION ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`),
);
page.on("Runtime.consoleAPICalled", (p) => {
  if (p.type === "error") consoleErrors.push(`ERROR ${p.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
});
page.on("Network.responseReceived", (p) => {
  if (p.response.status >= 400) failedRequests.push(`${p.response.status} ${p.response.url}`);
});
await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Network.enable");
await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });

async function goto(url) {
  await page.send("Page.navigate", { url });
  await sleep(1200);
  for (let i = 0; i < 25; i++) {
    if (await evalJs("document.getElementById('root')?.childElementCount > 0")) break;
    await sleep(400);
  }
  await sleep(1200);
}
async function evalJs(expression) {
  const r = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function shot(name) {
  const { data } = await page.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

await goto(`${BASE}/`);
await evalJs(`localStorage.clear()`);
await goto(`${BASE}/login`);
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const inputs = document.querySelectorAll('input');
  set(inputs[0], "teacher@example.dev"); set(inputs[1], "dev-password-only");
  document.querySelector('form').requestSubmit(); return true;
})()`);
await sleep(2000);
await goto(`${BASE}/teacher/history`);
await sleep(1000);
await shot("history-01-list");

const rejectedRow = await evalJs(`(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  const idx = rows.findIndex(r => r.textContent.includes('REJECTED'));
  if (idx === -1) return null;
  const r = rows[idx].getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
check("a REJECTED row exists in history to test against", !!rejectedRow);

if (rejectedRow) {
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rejectedRow.x, y: rejectedRow.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rejectedRow.x, y: rejectedRow.y, button: "left", clickCount: 1 });
  await sleep(1200);
  await shot("history-02-detail-open");

  const detailText = await evalJs(`(() => {
    const headers = [...document.querySelectorAll('h3')];
    const h = headers.find(x => x.textContent.includes('Validation report'));
    return h ? h.closest('.rounded-lg').innerText : null;
  })()`);
  check("detail panel opened on row click", !!detailText);
  check("shows the real Duplicate similarity threshold row", detailText?.includes("Duplicate similarity") ?? false);
  check("shows the real Bias flags threshold row", detailText?.includes("Bias flags") ?? false);
  check("shows the real Grammar issues threshold row", detailText?.includes("Grammar issues") ?? false);
  check("shows the real limit values (35% duplicate)", detailText?.includes("limit 35%") ?? false);
  check("shows the real model name", detailText?.includes("glm-5.2") ?? false, detailText?.match(/Model[\s\S]{0,20}/)?.[0]);
  console.log("\n--- full detail panel text ---\n" + detailText);
}

console.log("\n=== CONSOLE ERRORS ===");
console.log([...new Set(consoleErrors)].join("\n") || "(none)");
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
