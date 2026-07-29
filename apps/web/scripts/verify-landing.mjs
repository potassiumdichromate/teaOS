// Verifies the public landing page (knowledge_base.md §11w — supersedes the
// §11v version of this script, same CDP plumbing).
//
// Asserts, against a real browser: the rebranded hero copy renders, the
// DecryptedText effect genuinely scrambles then settles, SpotlightCard tracks
// the pointer, the ShapeGrid canvas paints and does NOT swallow clicks on the
// hero CTAs, TrueFocus cycles, and no banned string ("National Verifiable
// Examination Infrastructure" / "NVEI" / "knowledge_base" / "Miden") survives
// anywhere in the rendered text. Only dependency is `ws`.
// Usage: node apps/web/scripts/verify-landing.mjs [outDir]
import WebSocket from "ws";
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2] ?? "./landing-shots";
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
const consoleErrors = []; const failedRequests = [];
page.on("Runtime.exceptionThrown", (p) => consoleErrors.push(`EXCEPTION ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`));
page.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error" || p.type === "warning") consoleErrors.push(`${p.type.toUpperCase()} ${p.args.map(a=>a.value??a.description??"").join(" ")}`); });
page.on("Network.responseReceived", (p) => { if (p.response.status >= 400) failedRequests.push(`${p.response.status} ${p.response.url}`); });
await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Network.enable");
await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });

async function evalJs(expression){ const r=await page.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function shot(name){ const {data}=await page.send("Page.captureScreenshot",{format:"png"}); writeFileSync(`${OUT}/${name}.png`, Buffer.from(data,"base64")); }
async function mouse(type, x, y){ await page.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", buttons: 0, clickCount: type === "mouseMoved" ? 0 : 1 }); }

// --- load, sampling the h1 while the decrypt effect is still running --------
await page.send("Page.navigate", { url: `${BASE}/` });
// Sample the *aria-hidden* animated layer continuously across the whole
// reveal window — never break early, or a sample taken before the effect
// starts looks identical to one taken after it finishes.
const h1Samples = [];
let srOnlyDuringAnimation = null;
for (let i = 0; i < 90; i++) {
  if (srOnlyDuringAnimation === null) {
    srOnlyDuringAnimation = await evalJs("document.querySelector('h1 .sr-only')?.textContent ?? null");
  }
  const t = await evalJs(`(() => { const h = document.querySelector('h1'); if (!h) return null;
    const a = h.querySelector('[aria-hidden="true"]'); return (a ? a.innerText : h.innerText).trim(); })()`);
  if (t !== null) h1Samples.push(t);
  await sleep(40);
}
await sleep(2000);

console.log("\n=== 1. copy / branding ===");
check("document.title", (await evalJs("document.title")) === "teaOS — Trusted Evaluation Architecture", await evalJs("document.title"));
const h1Final = await evalJs("document.querySelector('h1').innerText.trim()");
check("hero <h1> settles to exactly the new headline", h1Final === "Trusted Verifiable Assessment Layer", JSON.stringify(h1Final));
check("sr-only duplicate is dropped once settled", (await evalJs("document.querySelectorAll('h1 .sr-only').length")) === 0);
check("hero paragraph broadened (mentions 'assessments')", (await evalJs("document.body.innerText")).includes("infrastructure layer for trusted digital assessments"));

console.log("\n=== 2. DecryptedText actually animates ===");
const scrambled = h1Samples.filter((s) => s && s !== "Trusted Verifiable Assessment Layer");
check(
  "h1 passed through scrambled intermediate frames then settled",
  scrambled.length > 0 && h1Samples.at(-1) === "Trusted Verifiable Assessment Layer",
  `${scrambled.length}/${h1Samples.length} scrambled frame(s), e.g. ${JSON.stringify(scrambled[Math.floor(scrambled.length / 2)] ?? "")}`,
);
check(
  "scrambled frames preserved length + word breaks (no layout thrash)",
  scrambled.every((s) => s.length === "Trusted Verifiable Assessment Layer".length),
);
check(
  "an sr-only copy of the real string existed while scrambling (a11y safe)",
  srOnlyDuringAnimation === "Trusted Verifiable Assessment Layer",
  JSON.stringify(srOnlyDuringAnimation),
);

console.log("\n=== 3. ShapeGrid canvas: paints, does not block clicks ===");
check("hero canvas present", (await evalJs("!!document.querySelector('section canvas')")));
check(
  "canvas pointer-events: none",
  (await evalJs("getComputedStyle(document.querySelector('section canvas')).pointerEvents")) === "none",
);
check(
  "canvas has painted (non-empty pixel data)",
  await evalJs(`(() => { const c = document.querySelector('section canvas');
    const d = c.getContext('2d').getImageData(0, 0, Math.min(300, c.width), Math.min(300, c.height)).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; })()`),
);
const btnHit = await evalJs(`(() => { const b = [...document.querySelectorAll('a[href="#solution"] button')][0];
  const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return { tag: el.tagName, inside: b.contains(el) || el === b }; })()`);
check("hero CTA is the topmost element at its own centre (canvas not on top)", btnHit.inside, JSON.stringify(btnHit));
{
  const r = await evalJs(`(() => { const b = document.querySelector('a[href="#solution"] button').getBoundingClientRect();
    return { x: b.left + b.width/2, y: b.top + b.height/2 }; })()`);
  await mouse("mousePressed", r.x, r.y); await mouse("mouseReleased", r.x, r.y);
  await sleep(900);
  check("clicking 'See how it works' through the canvas layer navigates", (await evalJs("location.hash")) === "#solution", await evalJs("location.hash"));
}

console.log("\n=== 4. SpotlightCard tracks the pointer ===");
await evalJs("document.getElementById('problem').scrollIntoView()");
await sleep(900);
const cardBox = await evalJs(`(() => { const c = document.querySelector('#problem .group\\\\/spot');
  const r = c.getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.4 }; })()`);
await mouse("mouseMoved", cardBox.x, cardBox.y);
await sleep(400);
const spot1 = await evalJs(`(() => { const c = document.querySelector('#problem .group\\\\/spot');
  return { x: c.style.getPropertyValue('--spot-x'), y: c.style.getPropertyValue('--spot-y'),
           glow: getComputedStyle(c.querySelector('span[aria-hidden]')).opacity }; })()`);
await mouse("mouseMoved", cardBox.x + 80, cardBox.y + 20);
await sleep(400);
const spot2 = await evalJs(`(() => { const c = document.querySelector('#problem .group\\\\/spot');
  return { x: c.style.getPropertyValue('--spot-x'), y: c.style.getPropertyValue('--spot-y'),
           glow: getComputedStyle(c.querySelector('span[aria-hidden]')).opacity }; })()`);
check("--spot-x/--spot-y follow the cursor", spot1.x !== "" && spot1.x !== spot2.x, `${JSON.stringify(spot1)} -> ${JSON.stringify(spot2)}`);
check("glow layer opacity goes to 1 on hover", Number(spot2.glow) > 0.9, `opacity=${spot2.glow}`);
check(
  "every landing Card replaced (>=17 spotlight surfaces on the page)",
  (await evalJs("document.querySelectorAll('.group\\\\/spot').length")) >= 17,
  `${await evalJs("document.querySelectorAll('.group\\\\/spot').length")} found`,
);
await shot("01-problem-spotlight");

console.log("\n=== 5. status tags + TrueFocus ===");
await evalJs("document.getElementById('solution').scrollIntoView()");
await sleep(1200);
const tag = await evalJs(`(() => { const e = [...document.querySelectorAll('#solution .font-mono')]
  .find(n => /^\\[\\s*built\\s*\\]$/i.test(n.innerText.replace(/\\s+/g,' ').trim()));
  if (!e) return null; const s = getComputedStyle(e);
  return { text: e.innerText.replace(/\\s+/g,' ').trim(), radius: s.borderRadius, borderWidth: s.borderTopWidth,
           family: s.fontFamily.split(',')[0], count: [...document.querySelectorAll('#solution .font-mono')]
             .filter(n => /^\\[\\s*built\\s*\\]$/i.test(n.innerText.replace(/\\s+/g,' ').trim())).length }; })()`);
check("pipeline stages use a bracketed mono tag, not a rounded-full green pill",
  Boolean(tag) && tag.count === 6 && tag.borderWidth === "1px" && !tag.radius.startsWith("9999"),
  JSON.stringify(tag));
await shot("02-solution");
await evalJs("window.scrollTo(0,0)");
await sleep(600);
const focusA = await evalJs(`[...document.querySelectorAll('h1 ~ div span')].filter(e => e.style.filter).map(e => e.style.filter).join('|')`);
await sleep(1900);
const focusB = await evalJs(`[...document.querySelectorAll('h1 ~ div span')].filter(e => e.style.filter).map(e => e.style.filter).join('|')`);
check("TrueFocus advances its focused word over time", focusA !== "" && focusA !== focusB, `${focusA} -> ${focusB}`);
await shot("00-hero");

console.log("\n=== 6. 0G logo + remaining sections ===");
await evalJs("document.getElementById('stack').scrollIntoView()");
await sleep(1200);
check("0G logo rendered and decoded", await evalJs(`(() => { const i = document.querySelector('#stack img'); return !!i && i.naturalWidth > 0; })()`));
await shot("03-stack");
for (const id of ["architecture", "flows", "benefits", "faq"]) {
  await evalJs(`document.getElementById('${id}').scrollIntoView()`);
  await sleep(1100);
  await shot(`04-${id}`);
}

console.log("\n=== 7. banned strings ===");
const fullText = await evalJs("document.body.innerText");
for (const banned of ["National Verifiable Examination Infrastructure", "NVEI", "knowledge_base", "Miden", "Admin (NTA)"]) {
  check(`no "${banned}" in rendered text`, !fullText.includes(banned));
}

console.log("\n=== 8. narrow viewport (390px) ===");
await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await evalJs("window.scrollTo(0,0)"); await sleep(1200);
check("no horizontal overflow at 390px", await evalJs("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"),
  `scrollWidth=${await evalJs("document.documentElement.scrollWidth")}`);
await shot("05-mobile-hero");

console.log("\n=== CONSOLE ERRORS/WARNINGS ===");
console.log([...new Set(consoleErrors)].join("\n") || "(none)");
console.log("\n=== FAILED / 4xx-5xx REQUESTS ===");
console.log([...new Set(failedRequests)].join("\n") || "(none)");
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function pageWsUrl(targetId){const list=await(await fetch("http://127.0.0.1:9222/json/list")).json();return list.find(t=>t.id===targetId).webSocketDebuggerUrl;}
async function connect(url){const ws=new WebSocket(url);await new Promise((res,rej)=>{ws.once("open",res);ws.once("error",rej);});let id=0;const pending=new Map();const listeners=new Map();
  ws.on("message",(raw)=>{const msg=JSON.parse(raw.toString());if(msg.id&&pending.has(msg.id)){const{resolve,reject}=pending.get(msg.id);pending.delete(msg.id);if(msg.error)reject(new Error(JSON.stringify(msg.error)));else resolve(msg.result);}else if(msg.method&&listeners.has(msg.method)){listeners.get(msg.method)(msg.params);}});
  return {send:(method,params={})=>new Promise((resolve,reject)=>{const myId=++id;pending.set(myId,{resolve,reject});ws.send(JSON.stringify({id:myId,method,params}));}),on:(method,cb)=>listeners.set(method,cb)};}
