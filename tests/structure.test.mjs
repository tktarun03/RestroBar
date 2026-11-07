// Structure: versions agree, every file exists, load order is sane, global names never clash.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, read, topNames, indexScripts, load } from './helpers.mjs';

const { APP_VERSION, RELEASES } = load(['js/core/version.js']);

test('APP_VERSION, ?v= links, service worker and changelog all match', () => {
  const html = read('index.html');
  const vs = [...html.matchAll(/\?v=([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(vs.length > 10, 'expected versioned links in index.html');
  for (const v of vs) assert.equal(v, APP_VERSION, `index.html has ?v=${v}`);
  const sw = read('sw.js').match(/const VERSION = '([^']+)'/)[1];
  assert.equal(sw, APP_VERSION, 'sw.js VERSION');
  assert.equal(JSON.parse(read('package.json')).version, APP_VERSION, 'package.json version');
  assert.match(read('CHANGELOG.md'), new RegExp('^## ' + APP_VERSION.replace(/\./g, '\\.') + ' ', 'm'), 'CHANGELOG.md entry');
  assert.equal(RELEASES[0].version, APP_VERSION, 'RELEASES[0] is the current version');
});

test('every script and cached asset exists', () => {
  for (const s of indexScripts()) assert.ok(fs.existsSync(path.join(ROOT, s.file)), s.file);
  const assets = [...read('sw.js').matchAll(/'([^']+\.(?:js|css|woff2|png|svg|ico|webmanifest|html))'/g)].map((m) => m[1]);
  for (const a of assets) assert.ok(fs.existsSync(path.join(ROOT, a)), 'sw.js asset ' + a);
});

test('service worker caches every script the page loads', () => {
  const sw = read('sw.js');
  for (const s of indexScripts()) assert.ok(sw.includes(`'${s.file}' + V`), 'sw.js is missing ' + s.file);
});

test('load order: libraries, core, ui, features, app last', () => {
  const files = indexScripts().map((s) => s.file);
  const rank = (f) => f.startsWith('lib/') ? 0 : f.startsWith('js/core/') ? 1 : f.startsWith('js/ui/') ? 2 : f.startsWith('js/features/') ? 3 : 4;
  const ranks = files.map(rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), files.join('\n'));
  assert.equal(files.at(-1), 'js/app.js');
  assert.equal(files.indexOf('js/core/version.js'), files.findIndex((f) => f.startsWith('js/')), 'version.js loads first');
});

test('top-level names are unique across all app scripts (one shared global scope)', () => {
  const seen = new Map();
  for (const { file } of indexScripts().filter((s) => s.file.startsWith('js/'))) {
    for (const n of topNames(file)) {
      assert.ok(!seen.has(n), `"${n}" is declared in both ${seen.get(n)} and ${file}`);
      seen.set(n, file);
    }
  }
});

test('no alert/confirm/prompt (blocked in some hosts) and no innerHTML from raw user text helpers missing', () => {
  for (const { file } of indexScripts().filter((s) => s.file.startsWith('js/'))) {
    const src = read(file);
    assert.ok(!/\b(window\.)?(alert|confirm|prompt)\(/.test(src.replace(/UI\.confirm\(/g, '').replace(/const confirm =/g, '')), `${file} uses a native dialog`);
  }
});
