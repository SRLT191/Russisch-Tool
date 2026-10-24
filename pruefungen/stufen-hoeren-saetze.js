const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Stufen fürs Hörverstehen und für Sätze
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  await check('Satzstufen plausibel', () => ev(() => { const a = sentenceLevel('Я люблю маму.'), c = sentenceLevel('Капельница стоит у кровати.'); return { ok: a === 'A1' && levelIdx(c) >= 2, info: a + ' / ' + c }; }));
  await check('ё/е gleich behandelt', () => ev(() => sentenceLevel('Она идёт домой.') === sentenceLevel('Она идет домой.')));
  await check('Diktat: alle Sätze haben eine Stufe, Verteilung', () => ev(() => { dictState.pool = null; const pool = buildDictationPool(); const c = {}; pool.forEach(x => c[x.lvl] = (c[x.lvl] || 0) + 1); return { ok: pool.every(x => LEVELS.includes(x.lvl)), info: JSON.stringify(c) }; }));
  await check('Diktat bis A1: nur A1-Sätze, Stufe sichtbar', () => ev(() => { setMaxLevel('A1'); setAppView('listening'); showListeningPanel('dictation'); openDictation(); let ok = true; for (let i = 0; i < 40; i++) { restartDictation(); if (dictState.current.lvl !== 'A1') ok = false; } const badge = document.querySelector('#dictation-hint .lvl-badge'); return { ok: ok && badge && badge.textContent === 'A1', info: dictState.current.ru }; }));
  await check('Hörquiz bis A2: nur Wörter bis A2', () => ev(() => { setMaxLevel('A2'); hqState.selectedCats = new Set(); const pool = buildHearquizPool(); const bad = pool.filter(w => levelIdx(wordLevel(w)) > 1).length; return { ok: bad === 0 && pool.length > 100, info: pool.length + ' Wörter, zu schwer ' + bad }; }));
  await check('Hörquiz: Umstellen der Stufe baut den Pool neu', () => ev(() => { showListeningPanel('hearquiz'); restartHearquiz(); const a = hqState.pool.length; setMaxLevel(''); const c = hqState.pool.length; return { ok: c > a, info: a + ' → ' + c }; }));
  await check('Hörtrainer bis A1', () => ev(() => { setMaxLevel('A1'); showListeningPanel('hoertrainer'); document.querySelectorAll('#hoertrainer-cat-body input[type="checkbox"]').forEach(cb => cb.checked = true); startHoertrainer(); const bad = htState.queue.filter(w => levelIdx(wordLevel(w)) > 0).length; const n = htState.queue.length; stopHoertrainer && stopHoertrainer(); return { ok: n > 50 && bad === 0, info: n + ' Wörter, zu schwer ' + bad }; }));
  await check('Leere Auswahl nach Filter: alles bleibt', () => ev(() => filterLevelOrAll([{ ru: 'x' }], () => 'C1').length === 1));
  await check('Wortdetails: Beispielsatz mit Stufe', () => ev(() => { setMaxLevel(''); setAppView('vocab'); const w = allVocabWords().find(x => { openWordDetail(x); return document.getElementById('wd-sentence-row').style.display !== 'none'; }); const t = document.querySelector('#wd-sentence-ru .lvl-badge'); closeOverlay('overlay-worddetail'); return { ok: !!t, info: w && w.ru + ' ' + (t && t.textContent) }; }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
