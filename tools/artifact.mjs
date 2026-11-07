// Build a preview copy of RestroBar that can be published as a claude.ai artifact.
// Usage: node tools/artifact.mjs <outDir>
// The artifact host wraps the page in its own <html>/<head>/<body> and blocks service workers,
// WebRTC, camera, share and downloads, so live link and QR scanning do not work in the preview.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-artifact'));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const css = head.match(/<link rel="stylesheet"[^>]+>/)[0];
let page = [
  '<title>RestroBar</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  css,
  // The host already pads :root top/bottom by the safe-area insets.
  '<style>:root{--sat:0px;--sab:0px}</style>',
  // The artifact frame blocks WebRTC; hide it so the app shows its "not available here" message.
  '<script>window.RESTROBAR_PREVIEW = true; try { window.RTCPeerConnection = undefined; } catch (e) {}</script>',
  body.trim()
].join('\n');
page = page.replace(/\?v=[\w.-]+/g, '');
fs.writeFileSync(path.join(out, 'index.html'), page);

const copy = (rel) => {
  const src = path.join(root, rel); const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel); else { copy(rel); files.push(rel); }
  }
};
['css', 'js', 'lib', 'fonts'].forEach(walk);
copy('icons/icon.svg'); files.push('icons/icon.svg');
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(Object.fromEntries(files.map((f) => [f, f])), null, 2));
console.log(out, files.length + ' files');
