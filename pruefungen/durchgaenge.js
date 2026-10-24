const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Durchgänge je Wort: höchstens 1 je Durchgang, bis 5, Datum; Zurücksetzen startet neuen Durchgang.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // Ausgangsdaten setzen, dann neu laden (ohne Init-Skript, damit Neuladen im Test nichts überschreibt)
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear();
    localStorage.setItem('vokabeltrainer-scores', JSON.stringify({ 'мама': { correct: 1, wrong: 0, box: 1, lastSeen: 1 } }));
    localStorage.setItem('vokabeltrainer-lifetime', JSON.stringify({ ver: 2, v: { 'мама': { c: 4, w: 1, mb: 3, l: 1700000000000 }, 'папа': { c: 2, w: 0, mb: 2, l: 1700000000000 } }, g: {} }));
  });
  await p.reload(); await p.waitForTimeout(400);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  await check('Übernahme: gelernte Wörter haben 1 Durchgang', () => ev(() => { const L = loadLifetime(); return { ok: L.ver === 3 && L.v['мама'].d === 1 && L.v['папа'].d === 1 && L.v['мама'].lr === 1 && L.v['папа'].lr === 0, info: JSON.stringify([L.v['мама'], L.v['папа']]) }; }));
  await check('папа zählt im laufenden Durchgang noch, мама nicht doppelt', () => ev(() => { const w = x => allVocabWords().find(v => v.ru === x); updateScore(w('папа'), true); lifeVocab('мама', true, 1); const L = loadLifetime(); return { ok: L.v['папа'].d === 2 && L.v['мама'].d === 1, info: L.v['папа'].d + ' / ' + L.v['мама'].d }; }));
  await check('Mehrfach richtig in einem Durchgang zählt einmal', () => ev(() => { const w = allVocabWords().find(v => v.ru === 'дом'); for (let i = 0; i < 4; i++) lifeVocab('дом', true, 1); return loadLifetime().v['дом'].d === 1; }));
  await check('Falsch zählt keinen Durchgang', () => ev(() => { lifeVocab('кот', false, 0); return !loadLifetime().v['кот'].d; }));
  await check('Zurücksetzen = neuer Durchgang, bis höchstens 5', () => ev(() => { const r0 = loadLifetime().run; for (let i = 0; i < 7; i++) { resetProgress(); lifeVocab('дом', true, 1); } const L = loadLifetime(); return { ok: L.run === r0 + 7 && L.v['дом'].d === 5, info: 'run ' + r0 + '→' + L.run + ', дом d=' + L.v['дом'].d }; }));
  await check('Datum des letzten Durchgangs', () => ev(() => { const e = loadLifetime().v['дом']; return { ok: Math.abs(e.dd - Date.now()) < 6e4, info: lifeRunsText(e) }; }));
  await check('Vokabelliste zeigt 5/5', () => ev(() => { openVocabList(); document.getElementById('vocab-search').value = 'дом'; renderVocabTable(); const t = [...document.querySelectorAll('#vocab-table-body .ever-ok')].map(x => x.textContent + '|' + x.title); document.getElementById('vocab-search').value = ''; closeOverlay('overlay-vocab'); return { ok: t.some(x => x.startsWith('5/5') && /sicher/.test(x)), info: t[0] }; }));
  await check('Sortierung „Durchgänge: wenige zuerst“', () => ev(() => { openVocabList(); document.getElementById('vocab-sort').value = 'runs-asc'; renderVocabTable(); const n = document.querySelectorAll('#vocab-table-body tr').length; document.getElementById('vocab-sort').value = 'default'; closeOverlay('overlay-vocab'); return n > 100; }));
  await check('Wortdetails zeigen Durchgänge', () => ev(() => { openWordDetail(allVocabWords().find(v => v.ru === 'дом')); const t = document.getElementById('wd-srs').textContent; closeOverlay('overlay-worddetail'); return { ok: /In 5 von 5 Durchgängen richtig \(sicher\) · zuletzt am/.test(t), info: t }; }));
  await check('Grammatik zählt ebenfalls Durchgänge', () => ev(() => { progressMark('gender', 'дом', true); progressMark('gender', 'дом', true); return loadLifetime().g.gender['дом'].d === 1; }));
  await check('Bewertung zurücknehmen nimmt Durchgang zurück', () => ev(() => { resetProgress(); setMode('flip'); const cw = currentWord; const before = (loadLifetime().v[getKey(cw)] || {}).d || 0; flipReveal(); flipJudge(true); const mid = loadLifetime().v[getKey(cw)].d; undoFlip(); const after = (loadLifetime().v[getKey(cw)] || {}).d || 0; setMode('free'); return { ok: mid === before + 1 && after === before, info: before + '→' + mid + '→' + after }; }));
  await check('Gesamtstand löschen setzt Durchgänge zurück', () => ev(() => { const oc = window.confirm; window.confirm = () => true; resetLifetime(); window.confirm = oc; const L = loadLifetime(); return L.run === 1 && L.ver === 3 && !Object.keys(L.v).length; }));
  await p.reload(); await p.waitForTimeout(300);
  await check('nach Neuladen bleibt Version 3 ohne erneute Übernahme', () => ev(() => loadLifetime().ver === 3 && loadLifetime().run === 1));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
