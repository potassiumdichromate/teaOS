const fs = require('fs');
const path = require('path');
const A = path.join(__dirname, '..', 'assets', 'opt');
const uri = (f, m) => `data:${m};base64,` + fs.readFileSync(path.join(A, f)).toString('base64');

let body = fs.readFileSync(path.join(__dirname, 'teaos-onepager.template.html'), 'utf8');
const map = {
  '{{LOGO_DARK}}':  uri('logo-dark.png', 'image/png'),
  '{{LOGO_LIGHT}}': uri('logo-light.png', 'image/png'),
  '{{HEX}}':        uri('hex.png', 'image/png'),
  '{{SIDHANTH}}':   uri('founder-sidhanth.jpg', 'image/jpeg'),
  '{{RAY}}':        uri('founder-ray.jpg', 'image/jpeg'),
  '{{FLOW}}':       uri('flow.png', 'image/png'),
};
for (const [k, v] of Object.entries(map)) body = body.split(k).join(v);
const left = body.match(/\{\{[A-Z_]+\}\}/g);
if (left) { console.error('unreplaced placeholders:', left); process.exit(1); }

// artifact.html is a fragment: the Artifact runtime supplies its own
// <head>, so emitting our own would nest documents.
fs.writeFileSync(path.join(__dirname, 'artifact.html'), body);

// index.html is the standalone document served by Vercel, and therefore
// must declare its own viewport. Without the meta tag mobile browsers lay
// the page out at ~980px and scale it down, which silently defeats every
// mobile breakpoint in the stylesheet.
const DESC = 'teaOS is the operating system for high-stakes assessment — a kernel that makes '
  + 'assessment integrity a property of the system rather than a promise from the institution.';
const titleMatch = body.match(/<title>([\s\S]*?)<\/title>\s*/);
const TITLE = titleMatch ? titleMatch[1].trim() : 'teaOS';
const rest = titleMatch ? body.replace(titleMatch[0], '') : body;
const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${TITLE}</title>
<meta name="description" content="${DESC}" />
<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#F8F9FA" media="(prefers-color-scheme: light)" />
<meta property="og:type" content="website" />
<meta property="og:title" content="teaOS — The operating system for high-stakes assessment" />
<meta property="og:description" content="${DESC}" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body>
${rest}
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'index.html'), doc);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log('built index.html (standalone, viewport meta) —', kb(doc));
console.log('built artifact.html (fragment) —', kb(body));
