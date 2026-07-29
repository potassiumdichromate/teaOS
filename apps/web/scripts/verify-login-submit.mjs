// Verifies (1) the Login page's ShapeGrid background + the plain demo-
// account list (the Dock variant was tried and reverted 2026-07-29 — see
// knowledge_base.md — this now checks the list that replaced it), and (2)
// SubmitQuestion's post-completion toast + form-clear fix. Same CDP pattern
// as the other verify-*.mjs scripts in this directory.
// Usage: node apps/web/scripts/verify-login-submit.mjs [outDir]
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
async function mouse(type, x, y) {
  await page.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" ? "none" : "left",
    buttons: 0,
    clickCount: type === "mouseMoved" ? 0 : 1,
  });
}

console.log("\n=== LOGIN PAGE: background + demo-account list ===");
await goto(`${BASE}/login`);
await shot("login-01-initial");
check("hero-style ShapeGrid canvas present on login", await evalJs("!!document.querySelector('canvas')"));
check(
  "canvas is pointer-events:none (doesn't block anything)",
  (await evalJs("getComputedStyle(document.querySelector('canvas')).pointerEvents")) === "none",
);
const rowCount = await evalJs(
  `(() => { const h = [...document.querySelectorAll('p')].find(p => p.textContent === 'Demo accounts'); const list = h?.closest('.rounded-lg')?.querySelector('ul'); return list ? list.querySelectorAll('li button').length : 0; })()`,
);
check("demo-account list renders 5 rows", rowCount === 5, `found ${rowCount}`);

const rowBox = await evalJs(
  `(() => { const h = [...document.querySelectorAll('p')].find(p => p.textContent === 'Demo accounts'); const btns = h.closest('.rounded-lg').querySelectorAll('ul li button'); const r = btns[2].getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`,
);
await mouse("mousePressed", rowBox.x, rowBox.y);
await mouse("mouseReleased", rowBox.x, rowBox.y);
await sleep(400);
const filledEmail = await evalJs("document.querySelector('input[type=email]').value");
check("clicking a demo-account row fills the email field", filledEmail.length > 0, filledEmail);
await shot("login-02-list-filled");

console.log("\n=== SUBMIT QUESTION: toast + form-clear after real completion ===");
await evalJs(`localStorage.clear()`);
await goto(`${BASE}/login`);
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const inputs = document.querySelectorAll('input');
  set(inputs[0], "teacher@example.dev"); set(inputs[1], "dev-password-only");
  document.querySelector('form').requestSubmit(); return true;
})()`);
await sleep(2000);
await goto(`${BASE}/teacher/submit`);
await sleep(1000);

const uniqueText = `Verify UX fix — a ball of mass 2kg dropped from 5m, ${Date.now()} (test item, expected to be rejected for low effort, that's fine)`;
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const selects = document.querySelectorAll('select');
  if (selects[0] && selects[0].options.length > 1) set(selects[0], selects[0].options[1].value);
})()`);
await sleep(600);
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const selects = document.querySelectorAll('select');
  if (selects[1] && selects[1].options.length > 1) set(selects[1], selects[1].options[1].value);
})()`);
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(document.querySelector('textarea'), ${JSON.stringify(uniqueText)});
})()`);
await evalJs(`(() => {
  const set = (el, v) => { const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const optInputs = [...document.querySelectorAll('input[placeholder^="Option "]')];
  const vals = ['10 m/s', '5 m/s', '0 m/s', '15 m/s'];
  optInputs.forEach((el, i) => set(el, vals[i]));
  const textareas = document.querySelectorAll('textarea');
  if (textareas[1]) set(textareas[1], 'v = sqrt(2gh) — approximately 10 m/s for this drop height.');
})()`);
await sleep(500);
await shot("submit-01-filled");

const canSubmit = await evalJs(
  `(() => { const btns = [...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent.includes('Submit for validation')); return b ? !b.disabled : false; })()`,
);
check("submit button enabled once the form is genuinely filled", canSubmit);

if (canSubmit) {
  await evalJs(
    `(() => { const btns = [...document.querySelectorAll('button')]; btns.find(x => x.textContent.includes('Submit for validation')).click(); })()`,
  );
  await sleep(800);
  const disabledDuring = await evalJs(
    `(() => { const btns = [...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent.includes('Working')); return !!b; })()`,
  );
  check("button shows 'Working…' and is disabled while the real pipeline runs", disabledDuring);
  await shot("submit-02-pipeline-running");

  let toastSeen = false;
  let finalText = "";
  for (let i = 0; i < 50; i++) {
    const toast = await evalJs(`(() => { const t = document.querySelector('[role="status"]'); return t ? t.textContent : null; })()`);
    if (toast) {
      toastSeen = true;
      finalText = toast;
      break;
    }
    await sleep(2000);
  }
  check("a toast notification appeared once the real pipeline finished", toastSeen, finalText);
  await shot("submit-03-toast");

  const clearedText = await evalJs("document.querySelector('textarea').value");
  const clearedSubject = await evalJs("document.querySelectorAll('select')[0].value");
  check("question text field cleared after completion", clearedText === "", JSON.stringify(clearedText));
  check("subject select cleared after completion", clearedSubject === "", JSON.stringify(clearedSubject));

  const submitDisabledNow = await evalJs(
    `(() => { const btns = [...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent.includes('Submit for validation')); return b ? b.disabled : null; })()`,
  );
  check("submit button is disabled again (blank form, can't accidentally resubmit)", submitDisabledNow === true);

  const outcomeShown = await evalJs("document.body.innerText.includes('Final status')");
  check("the pipeline panel still shows the real final outcome after clearing the form", outcomeShown);
  await sleep(1500);
  await shot("submit-04-cleared-form");
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
