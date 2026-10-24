const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Gesamtprüfung-Fixes 1–3: Einschleusen über Gesamtstand/Sicherung, Ablenker im Einstufungstest, zwei Tabs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  const bad = '1"><img src=x onerror="window.__pwn=1">';
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await p.evaluate(bad => { localStorage.clear();
    localStorage.setItem('vokabeltrainer-lifetime', JSON.stringify({ ver: 3, run: 1, v: { 'мама': { c: 1, w: 0, mb: 1, l: 1, d: bad, dd: bad } }, g: { gender: { 'дом': { c: bad, l: 5 } } }, lv: { A1: bad, X: 5 } }));
    localStorage.setItem('vokabeltrainer-level-exam', JSON.stringify({ level: '<img src=x onerror="window.__pwn3=1">', first: {} }));
  }, bad);
  await p.reload(); await p.waitForTimeout(400);
  await check('Gesamtstand mit Fremdcode: nichts ausgeführt', () => ev(async () => { openVocabList(); document.getElementById('vocab-search').value = 'мама'; renderVocabTable(); openLevelOverview(); renderLevelPlan('A1'); openWordDetail(allVocabWords().find(w => w.ru === 'мама')); updateGrammarTileProgress(); await new Promise(r => setTimeout(r, 300)); return { ok: !window.__pwn && !window.__pwn3, info: JSON.stringify(loadLifetime().v['мама']) }; }));
  await check('Gesamtstand nur Zahlen, ungültige Stufe verworfen', () => ev(() => { const L = loadLifetime(); return { ok: L.v['мама'].d === 0 && L.g.gender['дом'].c === 0 && !L.lv.A1 && !('X' in L.lv) && !levelExam, info: JSON.stringify(L.lv) }; }));
  // Sicherung mit Fremdcode einlesen
  const app = await ev(() => APP_ID);
  const f = require('path').join(TMP, 'xss-backup.json');
  fs.writeFileSync(f, JSON.stringify({ app, version: 1, saved: '2026-10-01', data: {
    'vokabeltrainer-lifetime': JSON.stringify({ ver: 3, run: 2, v: { 'папа': { c: 2, d: bad, dd: 5, x: bad } }, g: {} }),
    'vokabeltrainer-scores': JSON.stringify({ 'папа': { correct: bad, wrong: 1, box: '<b>', lastSeen: 3, extra: bad } }),
  } }));
  await (await p.$('#backup-file')).setInputFiles(f); await p.waitForTimeout(800);
  await check('Sicherung mit Fremdcode: nur Zahlen gespeichert', () => ev(() => { const raw = localStorage.getItem('vokabeltrainer-lifetime') + localStorage.getItem('vokabeltrainer-scores'); return { ok: !/onerror|<img|<b>/.test(raw), info: raw.slice(0, 160) }; }));
  await check('… und nichts ausgeführt', () => ev(async () => { openVocabList(); document.getElementById('vocab-search').value = 'папа'; renderVocabTable(); await new Promise(r => setTimeout(r, 300)); closeOverlay('overlay-vocab'); return !window.__pwn; }));
  // Ablenker
  await check('Einstufungstest: kein Ablenker teilt eine Bedeutung mit dem Zielwort (200 Runden)', () => ev(() => {
    const byRight = {}; let bad = [];
    for (let r = 0; r < 40; r++) LEVELS.forEach(l => placeLevelItems(l).forEach(it => {
      const mine = placeMeanings(it.w);
      it.opts.filter(o => o !== it.right).forEach(o => { const x = allVocabWords().find(v => wordLevel(v) === l && stripClarification(v.de[0]) === o && [...placeMeanings(v)].some(d => mine.has(d))); if (x) bad.push(it.w.ru + '←' + o); });
      if (it.opts.length !== 4 || new Set(it.opts).size !== 4) bad.push('Optionen ' + it.w.ru);
    }));
    return { ok: bad.length === 0, info: bad.slice(0, 5).join(', ') };
  }));
  await check('мама bekommt nie „Mutter“, муж nie „Mann“ als Ablenker', () => ev(() => { const l = wordLevel(allVocabWords().find(w => w.ru === 'мама')); let bad = 0; const orig = placeShuffle; for (let r = 0; r < 300; r++) placeLevelItems(l).forEach(it => { if (it.w.ru === 'мама' && it.opts.includes('Mutter')) bad++; if (it.w.ru === 'муж' && it.opts.includes('Mann')) bad++; }); return bad === 0; }));
  // zwei Tabs
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push(e.message));
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  await q.goto('file://' + APP_PATH); await q.waitForTimeout(300);
  await p.evaluate(() => allVocabWords().slice(0, 20).forEach(w => updateScore(w, true)));
  await q.waitForTimeout(200);
  await q.evaluate(() => updateScore(allVocabWords()[500], true));
  await p.waitForTimeout(200);
  await check('Zwei Tabs: beide Antworten bleiben erhalten', () => q.evaluate(() => { const n = Object.keys(JSON.parse(localStorage.getItem(scoresKeyFor(scoresDir)))).length; return { ok: n === 21, info: n + ' Einträge' }; }));
  await check('Zwei Tabs: Zähler im ersten Tab aktualisiert', () => ev(() => ({ ok: Object.keys(scores).length === 21, info: Object.keys(scores).length })));
  await q.evaluate(() => progressMark('gender', 'дом', true)); await p.waitForTimeout(200);
  await p.evaluate(() => progressMark('gender', 'мама', true)); await q.waitForTimeout(200);
  await check('Zwei Tabs: Grammatik und Gesamtstand zusammen', () => q.evaluate(() => { const g = JSON.parse(localStorage.getItem('vokabeltrainer-grammar-srs')).gender, L = JSON.parse(localStorage.getItem('vokabeltrainer-lifetime')); return { ok: !!g['дом'] && !!g['мама'] && Object.keys(L.v).length === 21 && !!L.g.gender['дом'] && !!L.g.gender['мама'], info: Object.keys(g).join(',') + ' / ' + Object.keys(L.v).length }; }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
