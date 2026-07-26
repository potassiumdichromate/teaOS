const fs = require('fs');
const path = require('path');
const A = path.join(__dirname, '..', 'assets', 'opt');
const uri = (f, m) => `data:${m};base64,` + fs.readFileSync(path.join(A, f)).toString('base64');
let html = fs.readFileSync(path.join(__dirname, 'teaos-onepager.template.html'), 'utf8');
const map = {
  '{{LOGO_DARK}}':  uri('logo-dark.png', 'image/png'),
  '{{LOGO_LIGHT}}': uri('logo-light.png', 'image/png'),
  '{{HEX}}':        uri('hex.png', 'image/png'),
  '{{FOUNDER}}':    uri('founder.jpg', 'image/jpeg'),
  '{{FLOW}}':       uri('flow.png', 'image/png'),
};
for (const [k, v] of Object.entries(map)) html = html.split(k).join(v);
const left = html.match(/\{\{[A-Z_]+\}\}/g);
if (left) { console.error('unreplaced placeholders:', left); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('built index.html —', (Buffer.byteLength(html)/1024).toFixed(0), 'KB');
