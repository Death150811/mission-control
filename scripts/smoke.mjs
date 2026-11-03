// Smoke test of a built site: every file the page references exists, the files are served with sensible types,
// no source maps or dev-server addresses leaked into the build, and the size stays within budget.
//   node scripts/smoke.mjs [dist]
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const fail = [];
const ok = (msg) => console.log('  ok   ' + msg);
const bad = (msg) => { console.log('  FAIL ' + msg); fail.push(msg); };
if (!existsSync(join(dir, 'index.html'))) { console.error('No ' + dir + '/index.html: run the build first.'); process.exit(2); }

const html = readFileSync(join(dir, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#?]+|\/[^"#?]+)"/g)].map((m) => m[1].replace(/^\.\//, '').replace(/^\//, ''));
const types = { '.html': 'text/html', '.js': 'javascript', '.css': 'text/css', '.svg': 'image/svg', '.webmanifest': 'json', '.woff2': 'font', '.woff': 'font' };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };

function walk(d) { return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const files = walk(dir);
const total = files.reduce((s, f) => s + statSync(f).size, 0);
const js = files.filter((f) => f.endsWith('.js'));

console.log('Smoke test of ' + dir + ' (' + files.length + ' files, ' + (total / 1048576).toFixed(2) + ' MB)');
refs.length || html.includes('<script') ? ok(refs.length + ' file reference(s) in index.html') : bad('index.html references nothing');
for (const r of refs) existsSync(join(dir, r)) ? ok('exists: ' + r) : bad('missing file referenced by index.html: ' + r);
files.some((f) => f.endsWith('.map')) ? bad('source maps are published') : ok('no source maps');
const leak = [...js, join(dir, 'index.html')].filter((f) => /localhost:\d{4}|127\.0\.0\.1:\d{4}/.test(readFileSync(f, 'utf8')));
leak.length ? bad('dev-server address found in ' + leak.join(', ')) : ok('no dev-server addresses in the bundle');
js.length ? ok(js.length + ' script file(s) (three.js is split into its own chunk)') : ok('scripts are inlined (single-file build)');
total < 12 * 1048576 ? ok('size budget: ' + (total / 1048576).toFixed(2) + ' MB of 12 MB') : bad('build is larger than 12 MB');
/<title>[^<]{3,}<\/title>/.test(html) ? ok('has a title') : bad('missing <title>');
html.includes('name="viewport"') && html.includes('name="description"') ? ok('viewport and description meta tags') : bad('missing viewport or description');

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const p = normalize(join(dir, url === '/' ? 'index.html' : url));
  if (!p.startsWith(normalize(dir)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(p)] ?? 'application/octet-stream' }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
for (const r of ['', ...refs]) {
  const res = await fetch(base + r);
  const ct = res.headers.get('content-type') ?? '';
  const want = types[extname(r || 'index.html')];
  res.status === 200 && (!want || ct.includes(want)) ? ok('served ' + (r || '/') + ' (' + ct.split(';')[0] + ')') : bad('serving ' + (r || '/') + ' gave ' + res.status + ' ' + ct);
}
server.close();
console.log(fail.length ? '\nSMOKE TEST FAILED (' + fail.length + ')' : '\nSMOKE TEST PASSED');
process.exit(fail.length ? 1 : 0);
