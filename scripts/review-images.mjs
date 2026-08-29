/**
 * Review vehicle photography by eye, quickly.
 *
 *   npm run images:review        then open http://127.0.0.1:4180
 *
 * Shows one photograph at a time. Keep it or reject it, and when you have
 * judged a batch, hit Apply: the rejects are recorded permanently in
 * scripts/image-exclusions.json, the affected vehicles are re-fetched from
 * Commons, and the replacements come back into the queue for review. Repeat
 * until the queue is empty, which is the definition of every photograph
 * approved.
 *
 * Approvals are keyed by Commons file title, never by local filename. A
 * re-fetch reuses the same filenames for different photographs, so a
 * filename-keyed approval would silently bless a photograph nobody looked at.
 * An entry whose source URL carries no title falls back to a vehicle-and-file
 * key: a weaker guarantee, but it keeps such an entry judgeable rather than
 * stuck in the queue forever.
 *
 * Plain node with no dependencies, and it binds to loopback only: this is a
 * local review tool, not a service.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 4180);
const MANIFEST = 'src/data/generated/images.json';
const APPROVALS = 'scripts/image-approvals.json';
const REJECTS = 'scripts/image-rejects.txt';
const CATALOG = 'src/data/generated/catalog.slim.json';
const DIR = 'public/vehicles';

const readJson = (path, fallback) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;

/** Commons titles are the stable identity of a photograph. */
const titleOf = (sourceUrl) => {
  const at = sourceUrl.indexOf('/wiki/');
  if (at < 0) return null;
  try {
    return decodeURIComponent(sourceUrl.slice(at + 6));
  } catch {
    return sourceUrl.slice(at + 6);
  }
};

/** Vehicle names, so a card says what the photograph is meant to be of. */
function vehicleNames() {
  const names = new Map();
  const slim = readJson(CATALOG, null);
  if (!slim?.d || !Array.isArray(slim.r)) return names;
  for (const row of slim.r) {
    const [id, makeIdx, modelIdx, genIdx, y0, y1] = row;
    names.set(id, {
      name: `${slim.d.make[makeIdx]} ${slim.d.model[modelIdx]}`,
      detail: `${slim.d.generation[genIdx]}, ${y0}-${y1}`,
    });
  }
  return names;
}

/** Everything in the manifest that has not been judged yet. */
function buildQueue() {
  const manifest = readJson(MANIFEST, {});
  const approved = new Set(readJson(APPROVALS, []));
  const pending = new Set(
    readFileSync(existsSync(REJECTS) ? REJECTS : '/dev/null', 'utf8')
      .split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean),
  );
  const names = vehicleNames();

  const queue = [];
  let approvedCount = 0;
  for (const [vehicleId, images] of Object.entries(manifest)) {
    for (const image of images) {
      const title = titleOf(image.sourceUrl);
      const key = title ?? `${vehicleId}::${image.file}`;
      if (approved.has(key)) { approvedCount++; continue; }
      if (pending.has(image.file)) continue;         // already rejected, awaiting Apply
      queue.push({
        vehicleId,
        file: image.file,
        key,
        licence: image.licence,
        author: image.author,
        sourceUrl: image.sourceUrl,
        hero: images[0]?.file === image.file,
        ...(names.get(vehicleId) ?? { name: vehicleId, detail: '' }),
      });
    }
  }
  return { queue, approvedCount, pendingRejects: pending.size };
}

function recordApproval(key) {
  if (!key) return;
  const approved = readJson(APPROVALS, []);
  if (approved.includes(key)) return;
  approved.push(key);
  approved.sort();
  writeFileSync(APPROVALS, JSON.stringify(approved, null, 2) + '\n');
}

function recordRejection(file) {
  const existing = existsSync(REJECTS) ? readFileSync(REJECTS, 'utf8') : '';
  const lines = existing.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  if (lines.includes(file)) return;
  writeFileSync(REJECTS, existing.replace(/\s*$/, '') + `\n${file}\n`);
}

function undo(entry) {
  if (entry.verdict === 'keep' && entry.key) {
    const approved = readJson(APPROVALS, []).filter((t) => t !== entry.key);
    writeFileSync(APPROVALS, JSON.stringify(approved, null, 2) + '\n');
  }
  if (entry.verdict === 'reject') {
    const kept = readFileSync(REJECTS, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.replace(/#.*$/, '').trim() !== entry.file);
    writeFileSync(REJECTS, kept.join('\n'));
  }
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');

  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }

  if (url.pathname === '/api/queue') return send(res, 200, buildQueue());

  if (url.pathname === '/api/verdict' && req.method === 'POST') {
    const { file, key, verdict } = await readBody(req);
    if (verdict === 'keep') recordApproval(key);
    else if (verdict === 'reject') recordRejection(file);
    else return send(res, 400, { error: 'verdict must be keep or reject' });
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/undo' && req.method === 'POST') {
    undo(await readBody(req));
    return send(res, 200, { ok: true });
  }

  // Apply hands off to the reject tool, which owns exclusions and re-fetching.
  if (url.pathname === '/api/apply' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    const child = spawn('npm', ['run', 'images:reject'], { shell: process.platform === 'win32' });
    child.stdout.on('data', (d) => res.write(d));
    child.stderr.on('data', (d) => res.write(d));
    child.on('close', (code) => {
      // The list is spent once its rejections are permanent in the exclusions.
      if (code === 0 && existsSync(REJECTS)) {
        const header = readFileSync(REJECTS, 'utf8').split(/\r?\n/)
          .filter((l) => l.trim().startsWith('#') || l.trim() === '');
        writeFileSync(REJECTS, header.join('\n').replace(/\n+$/, '\n'));
      }
      res.end(`\n--- re-fetch finished with code ${code} ---\n`);
    });
    child.on('error', (e) => res.end(`\nCould not run npm: ${e.message}\n`));
    return;
  }

  if (url.pathname.startsWith('/vehicles/')) {
    // Confined to the image directory: a review tool should not be a way to
    // read the rest of the disk, however local it is.
    const name = decodeURIComponent(url.pathname.slice('/vehicles/'.length));
    const path = join(DIR, normalize(name).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(DIR) || !existsSync(path) || !statSync(path).isFile()) {
      return send(res, 404, { error: 'not found' });
    }
    const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[extname(path).toLowerCase()];
    if (!type) return send(res, 415, { error: 'not an image' });
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    return createReadStream(path).pipe(res);
  }

  send(res, 404, { error: 'not found' });
});

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Photo review</title>
<style>
  :root { color-scheme: dark; --bg:#0b0b0d; --card:#161619; --line:#2a2a30; --text:#fafafa; --dim:#8b8b93; --keep:#3fbf7f; --reject:#f97066; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 system-ui, sans-serif;
         min-height:100vh; display:flex; flex-direction:column; align-items:center; gap:12px; padding:16px; }
  header { display:flex; gap:16px; align-items:baseline; width:min(900px,100%); }
  h1 { font-size:15px; margin:0; font-weight:600; }
  .count { color:var(--dim); font-variant-numeric:tabular-nums; margin-left:auto; }
  .card { width:min(900px,100%); background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .frame { position:relative; background:#000; aspect-ratio:16/10; display:grid; place-items:center; }
  .frame img { width:100%; height:100%; object-fit:contain; touch-action:pan-y; user-select:none; -webkit-user-drag:none; }
  .stamp { position:absolute; top:14px; padding:6px 14px; border-radius:999px; font-weight:700; font-size:20px;
           border:3px solid; opacity:0; transition:opacity .08s; pointer-events:none; }
  .stamp.keep { right:14px; color:var(--keep); border-color:var(--keep); transform:rotate(8deg); }
  .stamp.reject { left:14px; color:var(--reject); border-color:var(--reject); transform:rotate(-8deg); }
  .meta { padding:12px 14px; display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
  .name { font-weight:600; }
  .dim { color:var(--dim); font-size:13px; }
  .dim a { color:var(--dim); }
  .row { display:flex; gap:10px; width:min(900px,100%); }
  button { flex:1; min-height:52px; border-radius:12px; border:1px solid var(--line); background:#1e1e24;
           color:var(--text); font-size:15px; font-weight:600; cursor:pointer; }
  button.reject { border-color:var(--reject); color:var(--reject); }
  button.keep { border-color:var(--keep); color:var(--keep); }
  button.ghost { flex:0 0 auto; padding:0 16px; font-weight:400; color:var(--dim); }
  button:disabled { opacity:.4; cursor:default; }
  pre { width:min(900px,100%); background:#000; border:1px solid var(--line); border-radius:12px; padding:12px;
        white-space:pre-wrap; font-size:12px; max-height:40vh; overflow:auto; margin:0; }
  .done { text-align:center; padding:40px 20px; }
</style></head>
<body>
<header>
  <h1>Photo review</h1>
  <span class="dim">&larr; reject &nbsp; &rarr; keep &nbsp; backspace undo</span>
  <span class="count" id="count"></span>
</header>
<div id="app"></div>
<pre id="log" hidden></pre>
<script>
const app = document.getElementById('app');
const countEl = document.getElementById('count');
const logEl = document.getElementById('log');
let queue = [], i = 0, history = [], approved = 0, pending = 0, busy = false;

async function load() {
  const r = await fetch('/api/queue').then((r) => r.json());
  queue = r.queue; approved = r.approvedCount; pending = r.pendingRejects; i = 0; history = [];
  render();
}

function render() {
  countEl.textContent = queue.length
    ? (i + 1) + ' of ' + queue.length + ' to judge \\u00b7 ' + approved + ' approved \\u00b7 ' + pending + ' to replace'
    : approved + ' approved \\u00b7 ' + pending + ' to replace';

  if (i >= queue.length) {
    app.innerHTML = '<div class="card done">' +
      (pending > 0
        ? '<p><b>' + pending + ' photograph(s) to replace.</b></p><p class="dim">Applying records them permanently and re-fetches from Commons. Takes a moment per vehicle.</p>'
        : '<p><b>Nothing left to judge.</b></p><p class="dim">Every photograph in the manifest is approved.</p>') +
      '</div>' +
      '<div class="row" style="margin-top:10px">' +
        (pending > 0 ? '<button class="keep" id="apply">Apply ' + pending + ' rejection(s) and re-fetch</button>' : '') +
        '<button class="ghost" id="reload">Reload</button>' +
      '</div>';
    const apply = document.getElementById('apply');
    if (apply) apply.onclick = doApply;
    document.getElementById('reload').onclick = load;
    return;
  }

  const i0 = queue[i];
  app.innerHTML =
    '<div class="card">' +
      '<div class="frame">' +
        '<img id="shot" src="/vehicles/' + encodeURIComponent(i0.file) + '" alt="">' +
        '<span class="stamp keep" id="sk">KEEP</span><span class="stamp reject" id="sr">REPLACE</span>' +
      '</div>' +
      '<div class="meta">' +
        '<span class="name">' + esc(i0.name) + '</span>' +
        '<span class="dim">' + esc(i0.detail) + (i0.hero ? ' \\u00b7 hero' : '') + '</span>' +
        '<span class="dim" style="margin-left:auto">' + esc(i0.file) + ' \\u00b7 ' + esc(i0.licence) +
          (i0.sourceUrl ? ' \\u00b7 <a href="' + esc(i0.sourceUrl) + '" target="_blank" rel="noreferrer">source</a>' : '') +
        '</span>' +
      '</div>' +
    '</div>' +
    '<div class="row" style="margin-top:10px">' +
      '<button class="reject" id="no">&larr; Replace</button>' +
      '<button class="ghost" id="undo"' + (history.length ? '' : ' disabled') + '>Undo</button>' +
      '<button class="keep" id="yes">Keep &rarr;</button>' +
    '</div>';

  document.getElementById('no').onclick = () => judge('reject');
  document.getElementById('yes').onclick = () => judge('keep');
  document.getElementById('undo').onclick = undo;
  swipe(document.getElementById('shot'));
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

async function judge(verdict) {
  if (busy || i >= queue.length) return;
  busy = true;
  const item = queue[i];
  await fetch('/api/verdict', { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ file:item.file, key:item.key, verdict }) });
  history.push({ ...item, verdict });
  if (verdict === 'keep') approved++; else pending++;
  i++; busy = false; render();
}

async function undo() {
  const last = history.pop();
  if (!last) return;
  await fetch('/api/undo', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(last) });
  if (last.verdict === 'keep') approved--; else pending--;
  i--; render();
}

async function doApply() {
  logEl.hidden = false; logEl.textContent = 'Re-fetching...\\n';
  const res = await fetch('/api/apply', { method: 'POST' });
  const reader = res.body.getReader(); const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    logEl.textContent += dec.decode(value, { stream: true });
    logEl.scrollTop = logEl.scrollHeight;
  }
  await load();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') judge('reject');
  else if (e.key === 'ArrowRight') judge('keep');
  else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
});

/** Drag or swipe the image itself, which is what a phone expects. */
function swipe(el) {
  if (!el) return;
  let x0 = null;
  const sk = document.getElementById('sk'), sr = document.getElementById('sr');
  const start = (x) => { x0 = x; };
  const move = (x) => {
    if (x0 === null) return;
    const dx = x - x0;
    el.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 40 + 'deg)';
    sk.style.opacity = dx > 40 ? Math.min(1, dx / 120) : 0;
    sr.style.opacity = dx < -40 ? Math.min(1, -dx / 120) : 0;
  };
  const end = (x) => {
    if (x0 === null) return;
    const dx = x - x0; x0 = null;
    el.style.transform = ''; sk.style.opacity = 0; sr.style.opacity = 0;
    if (dx > 90) judge('keep'); else if (dx < -90) judge('reject');
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); start(e.clientX); });
  el.addEventListener('pointermove', (e) => move(e.clientX));
  el.addEventListener('pointerup', (e) => end(e.clientX));
  el.addEventListener('pointercancel', () => { x0 = null; el.style.transform = ''; });
}

load();
</script>
</body></html>`;

server.listen(PORT, '127.0.0.1', () => {
  const { queue, approvedCount } = buildQueue();
  console.log(`Photo review on http://127.0.0.1:${PORT}`);
  console.log(`${queue.length} to judge, ${approvedCount} already approved.`);
  if (queue.length === 0 && approvedCount === 0) {
    console.log(`\nNothing in ${MANIFEST}. Run "npm run images" first.`);
  }
});
