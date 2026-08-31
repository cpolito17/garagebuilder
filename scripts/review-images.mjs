/** Local, resumable candidate-library reviewer. Run: npm run images:review */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname } from 'node:path';
import { confinedPath } from './lib/confined-path.ts';
import { approvalKey, sourceIdentity } from './lib/source-identity.ts';
import {
  REVIEW_ROLES, assignRole, completeVehicle, emptyReviewProgress,
  normaliseReviewProgress, roleFor, selectedImages, selectionCount,
} from './lib/review-state.ts';

const PORT = Number(process.env.PORT ?? 4180);
const MANIFEST = 'src/data/generated/images.json';
const CANDIDATES = 'scripts/image-candidates.json';
const PROGRESS = 'scripts/image-review-progress.json';
const APPROVALS = 'scripts/image-approvals.json';
const CATALOG = 'src/data/generated/catalog.slim.json';
const DIR = 'public/vehicles';

const readJson = (path, fallback) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const readProgress = () => normaliseReviewProgress(readJson(PROGRESS, emptyReviewProgress()));
const saveProgress = (progress) => writeJson(PROGRESS, progress);

function vehicleCatalog() {
  const slim = readJson(CATALOG, null);
  if (!slim?.d || !Array.isArray(slim.r)) return [];
  return slim.r.map((row) => {
    const [id, makeIdx, modelIdx, genIdx, y0, y1] = row;
    return {
      vehicleId: id,
      name: `${slim.d.make[makeIdx]} ${slim.d.model[modelIdx]}`,
      detail: `${slim.d.generation[genIdx]}, ${y0}-${y1}`,
    };
  });
}

function candidatesFor(vehicleId, candidateManifest, manifest) {
  const out = [];
  const identities = new Set();
  for (const image of [...(candidateManifest[vehicleId] ?? []), ...(manifest[vehicleId] ?? [])]) {
    const identity = sourceIdentity(image.sourceUrl);
    if (identities.has(identity)) continue;
    identities.add(identity);
    out.push(image);
  }
  return out;
}

function fallbacksFor(vehicleId, manifest) {
  const roles = ['hero', 'extra1', 'extra2', 'interior'];
  return new Map((manifest[vehicleId] ?? []).slice(0, 4).map((image, index) => [
    sourceIdentity(image.sourceUrl), roles[index],
  ]));
}

function buildReview() {
  const manifest = readJson(MANIFEST, {});
  const candidateManifest = readJson(CANDIDATES, {});
  const progress = readProgress();
  const vehicles = vehicleCatalog().map((vehicle) => {
    const images = candidatesFor(vehicle.vehicleId, candidateManifest, manifest);
    const fallbacks = fallbacksFor(vehicle.vehicleId, manifest);
    const selected = selectionCount(images, progress, vehicle.vehicleId, fallbacks);
    return {
      ...vehicle,
      selected,
      completed: Boolean(progress.vehicles[vehicle.vehicleId]?.completed) && selected === 4,
      images: images.map((image) => {
        const identity = sourceIdentity(image.sourceUrl);
        return {
          ...image,
          identity,
          candidateKind: image.reviewRole ?? null,
          decision: roleFor(progress, vehicle.vehicleId, image, fallbacks.get(identity) ?? 'unselected'),
        };
      }),
    };
  });
  return {
    vehicles,
    stats: {
      completedVehicles: vehicles.filter((vehicle) => vehicle.completed).length,
      totalVehicles: vehicles.length,
      selectedImages: vehicles.reduce((sum, vehicle) => sum + vehicle.selected, 0),
    },
  };
}

function applyCompletedSelections() {
  const manifest = readJson(MANIFEST, {});
  const candidateManifest = readJson(CANDIDATES, {});
  const progress = readProgress();
  const approved = new Set(readJson(APPROVALS, []));
  let applied = 0;
  for (const { vehicleId } of vehicleCatalog()) {
    if (!progress.vehicles[vehicleId]?.completed) continue;
    const images = candidatesFor(vehicleId, candidateManifest, manifest);
    const selected = selectedImages(images, progress, vehicleId, fallbacksFor(vehicleId, manifest));
    if (selected.length !== 4) continue;
    manifest[vehicleId] = selected.map(({ reviewRole: _reviewRole, ...image }) => image);
    for (const image of selected) approved.add(approvalKey(vehicleId, image.sourceUrl));
    applied++;
  }
  writeJson(MANIFEST, manifest);
  writeJson(APPROVALS, [...approved].sort());
  return { applied };
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/api/review') return send(res, 200, buildReview());

  if (url.pathname === '/api/decision' && req.method === 'POST') {
    const { vehicleId, sourceUrl, decision } = await readBody(req);
    if (!vehicleId || !sourceUrl || ![...REVIEW_ROLES, 'unselected'].includes(decision)) {
      return send(res, 400, { error: 'invalid role assignment' });
    }
    saveProgress(assignRole(
      readProgress(), vehicleId, sourceUrl, decision,
      fallbacksFor(vehicleId, readJson(MANIFEST, {})),
    ));
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/complete' && req.method === 'POST') {
    const { vehicleId } = await readBody(req);
    const review = buildReview();
    const vehicle = review.vehicles.find((entry) => entry.vehicleId === vehicleId);
    if (!vehicle || vehicle.selected !== 4) return send(res, 400, { error: 'choose all four roles first' });
    saveProgress(completeVehicle(readProgress(), vehicleId));
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/apply' && req.method === 'POST') {
    return send(res, 200, applyCompletedSelections());
  }

  if (url.pathname === '/api/fetch-candidates' && req.method === 'POST') {
    const { vehicleId } = await readBody(req);
    if (!vehicleId) return send(res, 400, { error: 'vehicleId required' });
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    const child = spawn(process.execPath, [
      'node_modules/vite-node/dist/cli.mjs', 'scripts/fetch-images.ts',
      '--candidate-pool', '--only', vehicleId,
    ]);
    child.stdout.on('data', (data) => res.write(data));
    child.stderr.on('data', (data) => res.write(data));
    child.on('close', (code) => res.end(`\n--- candidate fetch finished with code ${code} ---\n`));
    child.on('error', (error) => res.end(`\nCould not start the candidate fetcher: ${error.message}\n`));
    return;
  }

  if (url.pathname.startsWith('/vehicles/')) {
    const name = decodeURIComponent(url.pathname.slice('/vehicles/'.length));
    const path = confinedPath(DIR, name);
    if (!path || !existsSync(path) || !statSync(path).isFile()) return send(res, 404, { error: 'not found' });
    const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[extname(path).toLowerCase()];
    if (!type) return send(res, 415, { error: 'not an image' });
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    return createReadStream(path).pipe(res);
  }
  send(res, 404, { error: 'not found' });
});

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vehicle photo review</title><style>
:root{color-scheme:dark;--bg:#0b0b0d;--panel:#121216;--card:#19191e;--line:#33333b;--text:#fafafa;--dim:#96969f;--hero:#c99a2e;--interior:#777781;--extra1:#397eb8;--extra2:#7257b8;--green:#3c9b6a}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,sans-serif;height:100vh;overflow:hidden}button,input{font:inherit}.layout{display:grid;grid-template-columns:310px 1fr;height:100vh}.sidebar{background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.sidehead{padding:16px;border-bottom:1px solid var(--line)}h1,h2,p{margin:0}.sidehead h1{font-size:16px}.progress{color:var(--dim);margin-top:4px}.search{width:100%;margin-top:12px;padding:10px;border:1px solid var(--line);border-radius:8px;background:#0d0d10;color:var(--text)}.vehicle-menu{overflow:auto;padding:8px;display:grid;gap:4px}.vehicle-item{border:1px solid transparent;background:transparent;color:var(--text);text-align:left;padding:9px 10px;border-radius:8px;cursor:pointer;display:grid;grid-template-columns:10px 1fr auto;gap:8px;align-items:center}.vehicle-item:hover,.vehicle-item.current{background:#222229;border-color:var(--line)}.dot{width:8px;height:8px;border-radius:50%;background:#555}.dot.partial{background:var(--hero)}.dot.done{background:var(--green)}.vehicle-item small{color:var(--dim)}.content{overflow:auto;padding:22px}.topbar{display:flex;gap:12px;align-items:center;position:sticky;top:-22px;background:linear-gradient(var(--bg) 80%,transparent);z-index:3;padding:16px 0}.topbar .spacer{flex:1}.button{border:1px solid var(--line);border-radius:9px;min-height:42px;padding:0 15px;background:#24242b;color:var(--text);font-weight:650;cursor:pointer}.button.primary{background:var(--green);border-color:var(--green)}.button:disabled{opacity:.4;cursor:not-allowed}.vehicle-title{margin:4px 0 18px}.vehicle-title p{color:var(--dim)}.grid{display:grid;grid-template-columns:repeat(4,minmax(210px,1fr));gap:14px}.shot{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}.shot.assigned{box-shadow:0 0 0 2px var(--role)}.frame{aspect-ratio:4/3;background:#000;display:grid;place-items:center}.frame img{width:100%;height:100%;object-fit:contain}.roles{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;padding:9px}.role{border:1px solid var(--line);border-radius:7px;min-height:36px;background:#25252b;color:#eee;cursor:pointer;font-size:12px;font-weight:700}.role.active{background:var(--role);border-color:var(--role)}.meta{padding:0 10px 10px;color:var(--dim);font-size:11px;overflow-wrap:anywhere}.meta a{color:#bbb}.role-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.pill{border:1px solid var(--line);padding:6px 9px;border-radius:99px;color:var(--dim)}.pill.set{color:#fff;border-color:var(--role)}.log{white-space:pre-wrap;background:#000;border:1px solid var(--line);border-radius:10px;padding:12px;max-height:260px;overflow:auto;margin-top:14px}.notice{padding:30px;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--dim)}@media(max-width:1050px){.layout{grid-template-columns:240px 1fr}.grid{grid-template-columns:repeat(2,minmax(190px,1fr))}}@media(max-width:700px){body{overflow:auto}.layout{display:block;height:auto}.sidebar{height:260px;border-right:0;border-bottom:1px solid var(--line)}.content{overflow:visible}.grid{grid-template-columns:1fr}}
</style></head><body><div class="layout"><aside class="sidebar"><div class="sidehead"><h1>Vehicle photo review</h1><div class="progress" id="progress"></div><input class="search" id="search" placeholder="Find a vehicle"></div><nav class="vehicle-menu" id="menu"></nav></aside><main class="content"><div class="topbar"><button class="button" id="prev">Previous</button><button class="button" id="next">Next</button><span class="spacer"></span><button class="button" id="fetch">Fetch more candidates</button><button class="button primary" id="apply">Apply completed selections</button></div><section id="app"></section><pre class="log" id="log" hidden></pre></main></div><script>
const app=document.getElementById('app'),menu=document.getElementById('menu'),progress=document.getElementById('progress'),search=document.getElementById('search'),log=document.getElementById('log');let data,currentId,filter='';const roleNames={hero:'Hero',interior:'Interior',extra1:'Extra 1',extra2:'Extra 2'},roleColors={hero:'var(--hero)',interior:'var(--interior)',extra1:'var(--extra1)',extra2:'var(--extra2)'};const esc=(s)=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
async function load(advance=false){const previous=currentId;data=await fetch('/api/review').then(r=>r.json());if(advance&&!filter){const at=data.vehicles.findIndex(v=>v.vehicleId===previous);currentId=(data.vehicles.slice(at+1).find(v=>!v.completed)||data.vehicles.find(v=>!v.completed)||data.vehicles[Math.min(at+1,data.vehicles.length-1)])?.vehicleId}else if(!currentId||!data.vehicles.some(v=>v.vehicleId===currentId)){currentId=(data.vehicles.find(v=>!v.completed&&v.images.length)||data.vehicles[0])?.vehicleId}render()}
function current(){return data.vehicles.find(v=>v.vehicleId===currentId)}
function render(){renderMenu();const v=current();progress.textContent=data.stats.completedVehicles+' of '+data.stats.totalVehicles+' complete · '+data.stats.selectedImages+' selected';if(!v){app.innerHTML='<div class="notice">No vehicles found.</div>';return}const assigned=Object.fromEntries(v.images.filter(i=>i.decision!=='unselected').map(i=>[i.decision,i]));app.innerHTML='<div class="vehicle-title"><h2>'+esc(v.name)+'</h2><p>'+esc(v.detail)+' · '+v.selected+'/4 slots selected'+(v.completed?' · complete':'')+'</p></div><div class="role-summary">'+Object.keys(roleNames).map(role=>'<span class="pill '+(assigned[role]?'set':'')+'" style="--role:'+roleColors[role]+'">'+roleNames[role]+': '+(assigned[role]?esc(assigned[role].file):'not selected')+'</span>').join('')+'</div>'+(v.images.length?'<div class="grid">'+v.images.map(card).join('')+'</div>':'<div class="notice">No candidate library yet. Run <b>npm run images:candidates</b> or fetch this vehicle below.</div>')+'<div class="topbar" style="position:static"><span class="spacer"></span><button class="button primary" id="save" '+(v.selected===4?'':'disabled')+'>'+(v.completed?'Save changes':'Mark complete and continue')+'</button></div>';document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>assign(b.dataset.identity,b.dataset.role));document.getElementById('save').onclick=saveCurrent;setNav()}
function card(image){const assigned=image.decision!=='unselected';return '<article class="shot '+(assigned?'assigned':'')+'" style="--role:'+(assigned?roleColors[image.decision]:'transparent')+'"><div class="frame"><img src="/vehicles/'+encodeURIComponent(image.file)+'" alt=""></div><div class="roles">'+Object.keys(roleNames).map(role=>'<button class="role '+(image.decision===role?'active':'')+'" style="--role:'+roleColors[role]+'" data-identity="'+esc(image.identity)+'" data-role="'+role+'">'+roleNames[role]+'</button>').join('')+'</div><div class="meta">'+esc(image.file)+(image.candidateKind?' · '+esc(image.candidateKind):'')+(image.sourceUrl?' · <a href="'+esc(image.sourceUrl)+'" target="_blank" rel="noreferrer">source</a>':'')+'</div></article>'}
function visibleVehicles(){const q=filter.toLowerCase();return data.vehicles.filter(v=>!q||v.name.toLowerCase().includes(q)||v.detail.toLowerCase().includes(q))}
function renderMenu(){menu.innerHTML=visibleVehicles().map(v=>'<button class="vehicle-item '+(v.vehicleId===currentId?'current':'')+'" data-id="'+esc(v.vehicleId)+'"><span class="dot '+(v.completed?'done':v.selected?'partial':'')+'"></span><span>'+esc(v.name)+'<br><small>'+esc(v.detail)+'</small></span><small>'+v.selected+'/4</small></button>').join('');menu.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{currentId=b.dataset.id;render()})}
function setNav(){const vehicles=visibleVehicles(),at=vehicles.findIndex(v=>v.vehicleId===currentId);document.getElementById('prev').disabled=at<=0;document.getElementById('next').disabled=at<0||at>=vehicles.length-1}
async function assign(identity,role){const v=current(),image=v.images.find(i=>i.identity===identity);if(!image)return;const decision=image.decision===role?'unselected':role;await fetch('/api/decision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicleId:v.vehicleId,sourceUrl:image.sourceUrl,decision})});await load()}
async function saveCurrent(){const v=current();const res=await fetch('/api/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicleId:v.vehicleId})});if(!res.ok)return;await load(true)}
async function fetchCandidates(){const v=current();log.hidden=false;log.textContent='Fetching candidates for '+v.name+'...\\n';const res=await fetch('/api/fetch-candidates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicleId:v.vehicleId})});const reader=res.body.getReader(),decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;log.textContent+=decoder.decode(part.value,{stream:true});log.scrollTop=log.scrollHeight}await load()}
search.oninput=()=>{filter=search.value;renderMenu();setNav()};document.getElementById('prev').onclick=()=>{const vehicles=visibleVehicles(),at=vehicles.findIndex(v=>v.vehicleId===currentId);if(at>0){currentId=vehicles[at-1].vehicleId;render()}};document.getElementById('next').onclick=()=>{const vehicles=visibleVehicles(),at=vehicles.findIndex(v=>v.vehicleId===currentId);if(at>=0&&at<vehicles.length-1){currentId=vehicles[at+1].vehicleId;render()}};document.getElementById('fetch').onclick=fetchCandidates;document.getElementById('apply').onclick=async()=>{const result=await fetch('/api/apply',{method:'POST'}).then(r=>r.json());document.getElementById('apply').textContent='Applied '+result.applied+' vehicles';setTimeout(()=>document.getElementById('apply').textContent='Apply completed selections',1800)};load();
</script></body></html>`;

server.listen(PORT, '127.0.0.1', () => {
  const review = buildReview();
  console.log(`Vehicle photo review on http://127.0.0.1:${PORT}`);
  console.log(`${review.stats.completedVehicles} of ${review.stats.totalVehicles} vehicles complete.`);
  if (!existsSync(CANDIDATES) || Object.keys(readJson(CANDIDATES, {})).length === 0) {
    console.log('Run "npm run images:candidates" once to prepare the full candidate library.');
  }
});
