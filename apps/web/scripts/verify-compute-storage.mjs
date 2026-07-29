// Focused verification for the newly-wired Confidential Compute Dashboard
// and 0G Storage Explorer pages. Same CDP approach as ui-smoke.mjs.
// Usage: node apps/web/scripts/verify-compute-storage.mjs [outDir]
import WebSocket from "ws";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "./verify-shots";
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:5173";

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
  if (p.type === "error" || p.type === "warning") {
    consoleErrors.push(`${p.type.toUpperCase()} ${p.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
  }
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
  await sleep(1000);
  for (let i = 0; i < 25; i++) {
    if (await evalJs("document.getElementById('root')?.childElementCount > 0")) break;
    await sleep(400);
  }
  await sleep(1500);
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
async function login(email) {
  await evalJs(`localStorage.clear()`);
  await goto(`${BASE}/login`);
  await evalJs(`
    (() => {
      const set = (el, v) => {
        const proto = Object.getPrototypeOf(el);
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = document.querySelectorAll('input');
      set(inputs[0], ${JSON.stringify(email)});
      set(inputs[1], "dev-password-only");
      document.querySelector('form').requestSubmit();
      return true;
    })()
  `);
  await sleep(2500);
  return evalJs("location.pathname");
}

await goto(`${BASE}/`); // land on the app's origin first — localStorage is inaccessible from about:blank
console.log("admin ->", await login("admin@example.dev"));

// ---------- Compute Dashboard ----------
await goto(`${BASE}/admin/compute`);
await shot("compute-01-initial");
console.log("compute page text (first 1500):\n", (await evalJs("document.body.innerText.slice(0,1500)")));

// Click the first row of the pending-queue table if one exists, to exercise
// the row-click -> report lookup flow.
const clickedPending = await evalJs(`
  (() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (rows.length === 0) return false;
    rows[0].click();
    return true;
  })()
`);
console.log("clicked a pending-queue row:", clickedPending);
await sleep(1500);
await shot("compute-02-after-row-click");
console.log("attestation panel text:\n", await evalJs(`
  (() => {
    const headers = [...document.querySelectorAll('h3')];
    const h = headers.find(x => x.textContent.includes('Attestation detail'));
    return h ? h.closest('.rounded-lg')?.innerText.slice(0, 800) : 'not found';
  })()
`));

// Now click an AI-validation-audit-trail row (a *completed* validation, unlike
// the pending queue) to exercise the success path of the same lookup.
const clickedAudit = await evalJs(`
  (() => {
    const headers = [...document.querySelectorAll('h3')];
    const card = headers.find(h => h.textContent.includes('AI validation audit trail'))?.closest('.rounded-lg');
    const row = card?.querySelector('table tbody tr');
    if (!row) return false;
    row.click();
    return true;
  })()
`);
console.log("clicked an audit-trail row:", clickedAudit);
await sleep(1500);
console.log("attestation panel after audit-row click:\n", await evalJs(`
  (() => {
    const headers = [...document.querySelectorAll('h3')];
    const h = headers.find(x => x.textContent.includes('Attestation detail'));
    return h ? h.closest('.rounded-lg')?.innerText : 'not found';
  })()
`));
await shot("compute-03-attestation-detail");

// ---------- Storage Explorer ----------
await goto(`${BASE}/admin/storage`);
await shot("storage-01-initial");
console.log("\nstorage page text (first 1500):\n", await evalJs("document.body.innerText.slice(0,1500)"));

// Click "Verify" on the first row's Proof column to exercise a real Merkle
// proof check against the live 0G Storage indexer.
const clickedVerify = await evalJs(`
  (() => {
    const btns = [...document.querySelectorAll('table tbody button')];
    const b = btns.find(x => x.textContent.trim() === 'Verify');
    if (!b) return false;
    b.click();
    return true;
  })()
`);
console.log("clicked a Verify button:", clickedVerify);
await shot("storage-02-verifying");
await sleep(5000); // real network round-trip to the 0G mainnet indexer
await shot("storage-03-verified");
console.log("storage table text after verify:\n", await evalJs("document.querySelector('table')?.innerText.slice(0, 1200)"));

writeFileSync(`${OUT}/report.json`, JSON.stringify({ consoleErrors, failedRequests }, null, 2));
console.log("\n=== CONSOLE ERRORS/WARNINGS ===");
console.log([...new Set(consoleErrors)].join("\n") || "(none)");
console.log("\n=== FAILED / 4xx-5xx REQUESTS ===");
console.log([...new Set(failedRequests)].join("\n") || "(none)");
process.exit(0);

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
