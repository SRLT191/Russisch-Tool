const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Gebündeltes Speichern: Antworten erst gesammelt schreiben, sofort beim Verlassen und vor allem,
// was den gespeicherten Stand liest; GitHub lädt nur hoch, wenn sich der Lernstand geändert hat.
const { chromium } = require('playwright');
const TOKEN = 'github_pat_' + 'A'.repeat(40);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext();
  const gh = { file: null, sha: 0, puts: 0 };
  const enc = s => Buffer.from(s, 'utf8').toString('base64'), dec = s => Buffer.from(s, 'base64').toString('utf8');
  await ctx.route('https://api.github.com/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, PUT' } });
    if (url.pathname === '/repos/ich/lernstand') return json(200, { private: true });
    if (req.method() === 'GET') return gh.file === null ? json(404, {}) : json(200, { sha: 's' + gh.sha, encoding: 'base64', content: enc(gh.file) });
    const body = JSON.parse(req.postData()); gh.puts++;
    if (gh.file !== null && body.sha !== 's' + gh.sha) return json(409, {});
    gh.file = dec(body.content); gh.sha++; return json(200, {});
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400); await p.evaluate(() => setAppView('vocab'));
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = (f, a) => p.evaluate(f, a);
  const gespeichert = (ru) => ev(ru => { const s = JSON.parse(localStorage.getItem('vokabeltrainer-scores') || '{}'); const w = allVocabWords().find(x => x.ru === ru); return !!s[getKey(w)]; }, ru);
  await ev(() => { window.__w = {}; const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { window.__w[k] = (window.__w[k] || 0) + 1; return orig.call(this, k, v); }; });
  await check('Antwort wird nicht sofort, aber nach gut 1 s geschrieben', async () => {
    await ev(() => updateScore(allVocabWords().find(x => x.ru === 'дом'), true));
    const sofort = await gespeichert('дом'); await p.waitForTimeout(1300); const spaeter = await gespeichert('дом');
    return { ok: !sofort && spaeter, info: sofort + ' → ' + spaeter };
  });
  await check('zehn schnelle Antworten = ein Schreibvorgang je Speicherschlüssel', async () => {
    await ev(() => { window.__w = {}; getPool().slice(0, 10).forEach(w => updateScore(w, true)); }); await p.waitForTimeout(1300);
    const w = await ev(() => window.__w);
    return { ok: w['vokabeltrainer-scores'] === 1 && w['vokabeltrainer-lifetime'] === 1 && w['vokabeltrainer-daylog'] === 1, info: JSON.stringify(w) };
  });
  await check('mit vollem Lernstand: eine Antwort kostet nur Bruchteile einer Millisekunde', () => ev(() => {
    const ws = allVocabWords(), now = Date.now(); ws.forEach(w => { scores[getKey(w)] = { correct: 1, wrong: 0, box: 1, lastSeen: now }; lifetime.v[getKey(w)] = { c: 3, w: 1, mb: 2, l: now, d: 2, dd: now, z: now }; }); saveScores(); saveLifetime(); flushSaves();
    const t0 = performance.now(); for (let i = 0; i < 30; i++) updateScore(ws[i], true); const ms = (performance.now() - t0) / 30; flushSaves();
    return { ok: ms < 5, info: ms.toFixed(2) + ' ms je Antwort' };
  }));
  await check('sofortiges Neuladen nach einer Antwort verliert nichts', async () => {
    await ev(() => updateScore(allVocabWords().find(x => x.ru === 'кот'), true)); await p.reload(); await p.waitForTimeout(400); await ev(() => setAppView('vocab'));
    return gespeichert('кот');
  });
  await check('Sicherung enthält die letzte Antwort sofort', () => ev(() => { const w = allVocabWords().find(x => x.ru === 'лес'); updateScore(w, true); const d = ghBuildPayload(); return !!JSON.parse(d.data['vokabeltrainer-scores'])[getKey(w)]; }));
  await check('Richtungswechsel direkt nach einer Antwort: jede Richtung behält ihren Stand', () => ev(() => {
    const a = allVocabWords().find(x => x.ru === 'море'), c = allVocabWords().find(x => x.ru === 'река');
    setDirection('ru-de'); resetProgress(); updateScore(a, true); setDirection('de-ru'); updateScore(c, true); setDirection('ru-de'); flushSaves();
    const ru = JSON.parse(localStorage.getItem('vokabeltrainer-scores')), de = JSON.parse(localStorage.getItem('vokabeltrainer-scores-de-ru'));
    return { ok: !!ru[getKey(a)] && !ru[getKey(c)] && !!de[getKey(c)] && !de[getKey(a)], info: '' };
  }));
  await check('nach dem Zusammenführen überschreibt eine neue Antwort den übernommenen Stand nicht', () => ev(() => {
    const x = allVocabWords().find(w => w.ru === 'гора'), y = allVocabWords().find(w => w.ru === 'поле');
    const fremd = { [getKey(x)]: { correct: 2, wrong: 0, box: 2, lastSeen: Date.now() } };
    mergeAllFromBackup({ 'vokabeltrainer-scores': JSON.stringify(fremd) }); updateScore(y, true); flushSaves();
    const s = JSON.parse(localStorage.getItem('vokabeltrainer-scores')); return { ok: !!s[getKey(x)] && !!s[getKey(y)], info: '' };
  }));
  await check('nach „Neu laden nach dem Zusammenführen“ wird nichts mehr geschrieben', () => ev(() => { freezeSaves(); const vor = localStorage.getItem('vokabeltrainer-scores'); updateScore(allVocabWords()[7], true); flushSaves(); const ok = localStorage.getItem('vokabeltrainer-scores') === vor; savesFrozen = false; return ok; }));
  await check('Zurücksetzen wird sofort festgeschrieben', () => ev(() => { resetProgress(); return localStorage.getItem('vokabeltrainer-scores') === '{}' && !pendingSaves.size; }));
  // GitHub
  await ev(T => { localStorage.setItem('vokabeltrainer-gh-settings', JSON.stringify({ repo: 'ich/lernstand', device: 'x' })); localStorage.setItem('vokabeltrainer-gh-token', T); }, TOKEN);
  await check('GitHub: erster Abgleich lädt hoch', async () => { await ev(() => updateScore(allVocabWords()[3], true)); await ev(() => ghSync()); return { ok: gh.puts === 1, info: gh.puts + ' Uploads' }; });
  await check('GitHub: ohne Änderung kein Upload, Meldung „Bereits aktuell“', async () => { await ev(() => ghSync()); const st = await ev(() => document.getElementById('gh-status').textContent); return { ok: gh.puts === 1 && /Bereits aktuell/.test(st), info: st }; });
  await check('GitHub: nur Ansicht/Seitenleiste geändert → kein Upload', async () => { await ev(() => { setAppView('grammar'); setSidebarWidth(300, true); setAppView('vocab'); ghSync(); }); await p.waitForTimeout(300); return { ok: gh.puts === 1, info: gh.puts + ' Uploads' }; });
  await check('GitHub: neue Antwort → Upload', async () => { await ev(() => updateScore(allVocabWords()[4], true)); await ev(() => ghSync()); return { ok: gh.puts === 2, info: gh.puts + ' Uploads' }; });
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
