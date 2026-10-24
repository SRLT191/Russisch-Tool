const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Einstufungstest
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  const answerLevel = async (nRight) => { for (let i = 0; i < 10; i++) { await p.evaluate(n => { const st = placeState, it = st.items[st.i]; const k = st.i < n ? it.opts.indexOf(it.right) : it.opts.findIndex(o => o !== it.right); answerPlacement(k); }, nRight); await p.waitForTimeout(1150); } };
  await check('Aus Einstellungen und Stufen erreichbar', () => ev(() => { openSettings(); const a = [...document.querySelectorAll('#overlay-settings .lvl-link')].some(x => /Einstufungstest/.test(x.textContent)); closeOverlay('overlay-settings'); openLevelOverview(); const b2 = [...document.querySelectorAll('#level-overview-body button')].some(x => /Einstufungstest/.test(x.textContent)); closeOverlay('overlay-levels'); return a && b2; }));
  await check('Start: 10 A1-Wörter, 4 verschiedene Antworten, richtige dabei', () => ev(() => { openPlacement(); document.getElementById('placement-start').click(); const it = placeState.items; return { ok: it.length === 10 && it.every(x => wordLevel(x.w) === 'A1' && x.opts.length === 4 && new Set(x.opts).size === 4 && x.opts.includes(x.right)), info: it[0].w.ru + ' → ' + it[0].opts.join(' / ') }; }));
  const vorher = await ev(() => JSON.stringify([localStorage.getItem('vokabeltrainer-scores'), localStorage.getItem('vokabeltrainer-lifetime')]));
  await answerLevel(8);
  await check('8 von 10 → weiter zu A2', () => ev(() => ({ ok: LEVELS[placeState.li] === 'A2' && placeState.results.A1 === 8, info: JSON.stringify(placeState.results) })));
  await check('Tasten 1–4 und 5 wirken', async () => { await p.keyboard.press('5'); await p.waitForTimeout(1150); return ev(() => ({ ok: placeState.i === 1 && placeState.ok === 0, info: 'i=' + placeState.i })); });
  // Rest von A2 falsch → Ende
  for (let i = 1; i < 10; i++) { await ev(() => { const it = placeState.items[placeState.i]; answerPlacement(it.opts.findIndex(o => o !== it.right)); }); await p.waitForTimeout(1150); }
  await check('A2 nicht geschafft → Vorschlag A1', () => ev(() => ({ ok: placeState.vorschlag === 'A1' && /Vorschlag: A1/.test(document.getElementById('placement-body').textContent), info: JSON.stringify(placeState.results) })));
  await check('Lernstand unverändert', async () => (await ev(() => JSON.stringify([localStorage.getItem('vokabeltrainer-scores'), localStorage.getItem('vokabeltrainer-lifetime')]))) === vorher);
  await check('Übernehmen setzt „Mein Niveau“', () => ev(() => { document.getElementById('placement-apply').click(); return { ok: myLevel === 'A1' && localStorage.getItem('vokabeltrainer-my-level') === 'A1' && document.getElementById('mylevel-select').value === 'A1' && !document.getElementById('overlay-placement').classList.contains('open'), info: myLevel }; }));
  await check('A1 nicht geschafft → Vorschlag A1 (Einstieg)', async () => { await ev(() => { openPlacement(); startPlacement(); }); await answerLevel(3); return ev(() => ({ ok: placeState.vorschlag === 'A1' && /Einstieg/.test(document.getElementById('placement-body').textContent), info: JSON.stringify(placeState.results) })); });
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
