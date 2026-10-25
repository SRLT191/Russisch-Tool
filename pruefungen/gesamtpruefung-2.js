const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Gesamtprüfung-Fixes 4, 5, 7, 8, 9
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  await check('4 Abschlussband sichtbar und zählt mit', () => ev(() => { startLevelExam('A1'); const bar = document.getElementById('exam-bar'); const a = getComputedStyle(bar).display === 'flex'; updateScore(currentWord, true); nextWord(); const t = document.getElementById('exam-bar-text').textContent; return { ok: a && /Abschluss A1 · 1 von \d+ /.test(t), info: t }; }));
  await check('4 Abbrechen im Band beendet den Abschluss', () => ev(() => { document.querySelector('#exam-bar button').click(); return !levelExam && activeMain === 'all' && getComputedStyle(document.getElementById('exam-bar')).display === 'none'; }));
  await check('4 Band nach Neuladen wieder da', async () => { await ev(() => startLevelExam('A2')); await p.reload(); await p.waitForTimeout(400); const r = await ev(() => getComputedStyle(document.getElementById('exam-bar')).display === 'flex' && /A2/.test(document.getElementById('exam-bar-text').textContent)); await ev(() => cancelLevelExam()); return r; });
  await check('5 Einstufungstest: 2 Spalten am PC, Wort kräftig', () => ev(() => { openPlacement(); startPlacement(); const cols = getComputedStyle(document.querySelector('#placement-body .place-opts')).gridTemplateColumns.split(' ').length; const col = getComputedStyle(document.querySelector('#placement-body .place-word .case-prep')).color; const ref = getComputedStyle(document.body).color; closeOverlay('overlay-placement'); return { ok: cols === 2, info: cols + ' Spalten, Farbe ' + col + ' (Text ' + ref + ')' }; }));
  await check('7 Kurzpartizipien eingestuft', () => ev(() => { const a = sentenceLevel('Дом построен в прошлом году.'), c = sentenceLevel('Независимость была провозглашена.'); return { ok: a !== 'A1' && c !== 'A1', info: a + ' / ' + c }; }));
  await check('8 Infotexte der Hörwerkzeuge nennen die Stufe', () => ev(() => ['hoertrainer-info-panel', 'dictation-info-panel', 'hearquiz-info-panel'].every(id => /Wörter bis Stufe/.test(document.getElementById(id).textContent))));
  const ctx = await b.newContext({ ...devices['iPhone 12'], deviceScaleFactor: 1 }); const m = await ctx.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto('file://' + APP_PATH); await m.waitForTimeout(300);
  await check('9 Tippflächen ≥ 44 px (Handy)', () => m.evaluate(() => { const h = sel => Math.round(document.querySelector(sel).getBoundingClientRect().height); const out = {}; openLevelOverview(); out.link = h('#lvl-plan .lvl-link'); renderLevelPlan('A2'); out.haken = h('.lvl-manual'); closeOverlay('overlay-levels'); openSettings(); if (!settingsUi.open.includes('niveau')) toggleSettingsSection('niveau'); out.einst = h('#overlay-settings .lvl-link'); closeOverlay('overlay-settings'); showCaughtUp(getPool()); out.reset = h('#caught-up-reset'); hideCaughtUp(); openPlacement(); startPlacement(); out.cols = getComputedStyle(document.querySelector('#placement-body .place-opts')).gridTemplateColumns.split(' ').length; closeOverlay('overlay-placement'); return { ok: Object.entries(out).every(([k, v]) => k === 'cols' ? v === 1 : v >= 44), info: JSON.stringify(out) }; }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
