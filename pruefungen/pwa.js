const path = require('path'), fs = require('fs'), http = require('http');
// Installierbare App: Manifest, Symbole, Hintergrund-Helfer, ohne Internet startbar, neue Version kommt an
const { chromium } = require('playwright');
const WURZEL = path.resolve(__dirname, '..');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let ersatz = null; // wenn gesetzt: so wird index.html ausgeliefert (simuliert neue Version)
const server = http.createServer((q, a) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/umleitung') { a.writeHead(302, { Location: '/' }); return a.end(); }
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(WURZEL, path.normalize(u));
  if (!f.startsWith(WURZEL + path.sep) || /node_modules|\.git/.test(f)) { a.writeHead(404); return a.end(); }
  if (u === '/index.html' && ersatz) { a.writeHead(200, { 'Content-Type': TYPEN['.html'] }); return a.end(ersatz); }
  fs.readFile(f, (e, d) => { if (e) { a.writeHead(404); return a.end(); } a.writeHead(200, { 'Content-Type': TYPEN[path.extname(f)] || 'application/octet-stream' }); a.end(d); });
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASIS = 'http://127.0.0.1:' + server.address().port + '/';
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const csp = []; p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  await check('Manifest gültig', () => {
    const m = JSON.parse(fs.readFileSync(path.join(WURZEL, 'manifest.webmanifest'), 'utf8'));
    const groessen = m.icons.map(i => i.sizes + ':' + i.purpose).join(' ');
    return { ok: m.name && m.short_name && m.start_url === './' && m.display === 'standalone' && /192x192:any/.test(groessen) && /512x512:any/.test(groessen) && /512x512:maskable/.test(groessen), info: groessen };
  });
  await check('Alle Symboldateien vorhanden und richtig groß', () => {
    const m = JSON.parse(fs.readFileSync(path.join(WURZEL, 'manifest.webmanifest'), 'utf8'));
    const fehl = [];
    for (const i of m.icons.concat([{ src: 'icons/apple-touch-icon.png', sizes: '180x180' }, { src: 'icons/favicon-32.png', sizes: '32x32' }])) {
      const d = fs.readFileSync(path.join(WURZEL, i.src)); const w = d.readUInt32BE(16), h = d.readUInt32BE(20);
      if (w + 'x' + h !== i.sizes) fehl.push(i.src + ' ' + w + 'x' + h);
    }
    return { ok: !fehl.length, info: fehl.join(', ') };
  });
  await check('Hintergrund-Helfer übernimmt die Seite', async () => {
    // fremder Speicher auf derselben Adresse (alle github.io-Seiten eines Kontos teilen sie sich)
    await p.goto(BASIS + 'manifest.webmanifest'); await p.evaluate(async () => { const c = await caches.open('andere-app'); await c.put('/x', new Response('x')); });
    await p.goto(BASIS); await p.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 5000))]));
    await p.reload(); await p.waitForTimeout(300);
    return { ok: await p.evaluate(() => !!navigator.serviceWorker.controller), info: '' };
  });
  await check('Fremde Speicher derselben Adresse bleiben unberührt', async () => ({ ok: await p.evaluate(() => caches.has('andere-app')), info: '' }));
  await check('Adresszusätze (?…) füllen den Speicher nicht', async () => {
    for (let i = 0; i < 4; i++) await p.goto(BASIS + '?x=' + i);
    await p.waitForTimeout(300);
    const k = await p.evaluate(async () => { const n = []; for (const name of await caches.keys()) if (name.startsWith('russisch-')) for (const r of await (await caches.open(name)).keys()) n.push(r.url); return n; });
    return { ok: !k.some(u => u.includes('?')) && k.length <= 8, info: k.length + ' Einträge' };
  });
  await check('Umgeleitete Seitenaufrufe funktionieren', async () => {
    const r = await p.goto(BASIS + 'umleitung').then(() => p.url()).catch(e => e.message.slice(0, 60));
    return { ok: r === BASIS, info: r };
  });
  await check('Browser erkennt Manifest mit Symbolen', async () => {
    const s = await ctx.newCDPSession(p); const r = await s.send('Page.getAppManifest');
    const err = (r.errors || []).map(e => e.message);
    return { ok: !!r.url && !err.length && /"icons"/.test(r.data || ''), info: err.join(' | ') };
  });
  await check('Ohne Internet startet die App', async () => {
    await ctx.setOffline(true); await p.reload().catch(() => {}); await p.waitForTimeout(500);
    const ok = await p.evaluate(() => typeof setAppView === 'function' && !!document.getElementById('russian-word'));
    await ctx.setOffline(false); await p.goto(BASIS); return ok;
  });
  await check('Neue Version kommt sofort an (zuerst Netz)', async () => {
    ersatz = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8').replace('<title>Russisch Sprachtool</title>', '<title>Neue Version</title>');
    await p.reload(); await p.waitForTimeout(300); const t = await p.title(); ersatz = null;
    return { ok: t === 'Neue Version', info: t };
  });
  await check('GitHub-Anfragen gehen am Helfer vorbei', () => {
    const s = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
    return /origin !== self\.location\.origin\) return/.test(s);
  });
  await check('Keine Fehler und kein CSP-Verstoß', async () => { await p.reload(); await p.waitForTimeout(400); return { ok: !errs.length && !csp.length, info: errs.concat(csp).slice(0, 2).join(' | ') }; });
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close(); server.close();
})();
