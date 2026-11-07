// Load the app's plain browser scripts into a Node sandbox so pure logic can be tested.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

export function load(files) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, Intl, Date, Math, JSON, crypto: globalThis.crypto, structuredClone });
  // Top-level const/let in classic scripts share one scope, like the browser.
  const src = files.map((f) => read(f)).join('\n;\n') + '\n;({ ' + exportsOf(files).join(', ') + ' })';
  return vm.runInContext(src, ctx, { filename: 'app-bundle.js' });
}

// Top-level `const Name =` declarations in a file.
export function topNames(file) {
  return [...read(file).matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
}
function exportsOf(files) { return files.flatMap(topNames); }

// Script src list from index.html, in order, without ?v=.
export function indexScripts() {
  return [...read('index.html').matchAll(/<script src="([^"?]+)\?v=([^"]+)"/g)].map((m) => ({ file: m[1], v: m[2] }));
}
