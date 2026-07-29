// Visual smoke check for the authenticated portals — drives a real browser
// rather than asserting on markup, so a broken layout is actually seen. Used
// to verify the 2026-07-28 frontend redesign (knowledge_base.md §11s).
//
// It logs in as each of the five seeded demo accounts, screenshots every
// portal page at desktop and mobile widths, and reports console exceptions,
// >=400 responses, and any horizontal overflow.
//
// Only dependency is `ws`, already in the repo's node_modules — this
// deliberately does not add Playwright/Puppeteer to the project.
//
// Prerequisites:
//   1. docker compose -f docker-compose.dev.yml up -d   (Postgres + Redis)
//   2. npm run dev -w apps/api                          (:4000)
//   3. npm run dev -w apps/web                          (:5173)
//   4. chrome --headless=new --remote-debugging-port=9222 \
//        --user-data-dir=<some temp dir> about:blank
//
// Usage: node apps/web/scripts/ui-smoke.mjs [outDir]
import WebSocket from "ws";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "./ui-smoke-shots";
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:5173";
const PASSWORD = "dev-password-only";

const { webSocketDebuggerUrl } = await (
  await fetch("http://127.0.0.1:9222/json/version")
).json();

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
page.on("Network.loadingFailed", (p) => failedRequests.push(`${p.type} ${p.errorText}`));
page.on("Network.responseReceived", (p) => {
  if (p.response.status >= 400) failedRequests.push(`${p.response.status} ${p.response.url}`);
});

await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Network.enable");
await page.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 960,
  deviceScaleFactor: 1,
  mobile: false,
});

const results = [];

async function goto(url) {
  await page.send("Page.navigate", { url });
  await sleep(1200);
  // Wait for React to actually paint something before screenshotting.
  for (let i = 0; i < 25; i++) {
    const ready = await evalJs("document.getElementById('root')?.childElementCount > 0");
    if (ready) break;
    await sleep(400);
  }
  await sleep(2000);
}

async function evalJs(expression) {
  const r = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

async function shot(name, fullPage = false) {
  const opts = { format: "png" };
  if (fullPage) opts.captureBeyondViewport = true;
  const { data } = await page.send("Page.captureScreenshot", opts);
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

async function login(email) {
  await evalJs(`localStorage.clear()`);
  await goto(`${BASE}/login`);
  // Drive the real React form: set values through the native setter so React's
  // onChange fires, then submit — same path a user takes.
  await evalJs(`
    (() => {
      const set = (el, v) => {
        const proto = Object.getPrototypeOf(el);
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = document.querySelectorAll('input');
      set(inputs[0], ${JSON.stringify(email)});
      set(inputs[1], ${JSON.stringify(PASSWORD)});
      document.querySelector('form').requestSubmit();
      return true;
    })()
  `);
  await sleep(3000);
  return evalJs("location.pathname");
}

async function record(name, note) {
  const text = await evalJs("document.body.innerText.slice(0, 2500)");
  const path = await shot(name);
  const overflow = await evalJs(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  results.push({ name, note, path, url: await evalJs("location.href"), horizontalOverflowPx: overflow, text });
}

// ---------- Landing + login ----------
await goto(`${BASE}/`);
await record("00-landing", "public landing (out of scope, regression check on shared tokens)");

await goto(`${BASE}/login`);
await record("01-login", "redesigned login");

// Demo-account quick select
await evalJs(`
  (() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => x.textContent.includes('Control plane'));
    b.click(); return b.textContent;
  })()
`);
await sleep(400);
await record("02-login-demo-selected", "demo account quick-select filled the form");

// ---------- Admin ----------
console.log("admin ->", await login("admin@example.dev"));
await record("10-admin-overview", "admin control plane");
await evalJs("window.scrollTo(0, 900)");
await sleep(1200);
await record("11-admin-overview-scrolled", "admin, scrolled");
await evalJs("window.scrollTo(0, 2000)");
await sleep(1000);
await record("12-admin-overview-bottom", "admin, bottom");
await goto(`${BASE}/admin/blueprints`);
await record("13-admin-blueprints", "blueprint generator");
await goto(`${BASE}/admin/papers`);
await record("14-admin-papers", "paper generation");
await goto(`${BASE}/admin/evaluation`);
await record("15-admin-evaluation", "evaluation & AIR");

// ---------- Teacher ----------
console.log("teacher ->", await login("teacher@example.dev"));
await record("20-teacher-dashboard", "teacher dashboard");
await goto(`${BASE}/teacher/submit`);
await record("21-teacher-submit", "submit question");
await goto(`${BASE}/teacher/history`);
await record("22-teacher-history", "question history");

// ---------- Center ----------
console.log("center ->", await login("center@example.dev"));
await record("30-center", "examination center");

// ---------- Observer ----------
console.log("observer ->", await login("observer@example.dev"));
await record("40-observer", "independent oversight");
await evalJs("window.scrollTo(0, 900)");
await sleep(900);
await record("41-observer-scrolled", "observer, scrolled");
await evalJs("window.scrollTo(0, 1900)");
await sleep(900);
await record("42-observer-bottom", "observer, bottom");

// ---------- Student ----------
console.log("student ->", await login("student@example.dev"));
await record("50-student", "candidate client");

// ---------- Mobile check ----------
await page.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await goto(`${BASE}/login`);
await record("60-login-mobile", "login at 390px");
console.log("admin mobile ->", await login("admin@example.dev"));
await record("61-admin-mobile", "admin at 390px");

writeFileSync(`${OUT}/report.json`, JSON.stringify({ results, consoleErrors, failedRequests }, null, 2));
console.log("\n=== CONSOLE ERRORS/WARNINGS ===");
console.log([...new Set(consoleErrors)].join("\n") || "(none)");
console.log("\n=== FAILED / 4xx-5xx REQUESTS ===");
console.log([...new Set(failedRequests)].join("\n") || "(none)");
console.log("\n=== PAGES ===");
for (const r of results) {
  console.log(`\n--- ${r.name} (${r.url}) overflowPx=${r.horizontalOverflowPx}`);
  console.log(r.text.replace(/\n{2,}/g, "\n").slice(0, 900));
}
process.exit(0);

// ---------- tiny CDP client ----------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function pageWsUrl(targetId) {
  const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
  return list.find((t) => t.id === targetId).webSocketDebuggerUrl;
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { maxPayload: 256 * 1024 * 1024 });
    let id = 0;
    const pending = new Map();
    const handlers = new Map();
    ws.on("open", () =>
      resolve({
        send(method, params = {}) {
          const msgId = ++id;
          ws.send(JSON.stringify({ id: msgId, method, params }));
          return new Promise((res, rej) => pending.set(msgId, { res, rej }));
        },
        on(event, fn) {
          handlers.set(event, fn);
        },
      }),
    );
    ws.on("error", reject);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method && handlers.has(msg.method)) {
        handlers.get(msg.method)(msg.params);
      }
    });
  });
}
