const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Wiederholungsstufe 0–5 mit wachsenden Abständen (sofort, 1, 3, 7, 14 Tage), „zuletzt geübt“,
// Zurücksetzen bringt keine Stufe, wahlweise Rückstufung bei falscher Antwort (Standard aus).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear();
    localStorage.setItem('vokabeltrainer-scores', JSON.stringify({ 'мама': { correct: 1, wrong: 0, box: 1, lastSeen: 1 } }));
    localStorage.setItem('vokabeltrainer-lifetime', JSON.stringify({ ver: 2, v: { 'мама': { c: 4, w: 1, mb: 3, l: 1700000000000 }, 'папа': { c: 2, w: 0, mb: 2, l: 1700000000000 } }, g: {} }));
  });
  await p.reload(); await p.waitForTimeout(400);
  // Uhr der Seite verstellbar machen
  await p.evaluate(() => { const echt = Date.now.bind(Date); window.__off = 0; Date.now = () => echt() + window.__off; });
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = (f, a) => p.evaluate(f, a);
  const H = 36e5, T = 864e5;
  const spring = ms => ev(ms => { window.__off += ms; }, ms);
  const richtig = w => ev(w => { lifeVocab(w, true, 1); return loadLifetime().v[w].d; }, w);
  const falsch = w => ev(w => { lifeVocab(w, false, 0); return loadLifetime().v[w].d; }, w);

  await check('Übernahme alter Stände: gelernte Wörter auf Stufe 1', () => ev(() => { const L = loadLifetime(); return { ok: L.v['мама'].d === 1 && L.v['папа'].d === 1, info: JSON.stringify(L.v['мама']) }; }));
  await check('neues Wort: erste Stufe sofort', async () => ({ ok: (await richtig('дом')) === 1 }));
  await check('mehrmals richtig am selben Tag: bleibt Stufe 1', async () => { for (let i = 0; i < 4; i++) await richtig('дом'); return (await richtig('дом')) === 1; });
  await check('Zurücksetzen bringt keine Stufe (früher: + richtig + … = 5 in Sekunden)', async () => { const d = await ev(() => { for (let i = 0; i < 7; i++) { resetProgress(); lifeVocab('дом', true, 1); } return loadLifetime().v['дом'].d; }); return { ok: d === 1, info: 'Stufe ' + d }; });
  await check('nach 23 Stunden noch nicht, nach 24 Stunden Stufe 2', async () => { await spring(23 * H); const a = await richtig('дом'); await spring(1 * H + 1000); const c = await richtig('дом'); return { ok: a === 1 && c === 2, info: a + ' → ' + c }; });
  await check('Stufe 2 → 3 erst nach 3 Tagen', async () => { await spring(2 * T); const a = await richtig('дом'); await spring(1 * T + 1000); const c = await richtig('дом'); return { ok: a === 2 && c === 3, info: a + ' → ' + c }; });
  await check('Stufe 3 → 4 nach 7 Tagen, 4 → 5 nach 14 Tagen, dann sicher', async () => {
    await spring(6 * T); const a = await richtig('дом'); await spring(1 * T + 1000); const c = await richtig('дом');
    await spring(13 * T); const d = await richtig('дом'); await spring(1 * T + 1000); const e = await richtig('дом'); await spring(60 * T); const f = await richtig('дом');
    return { ok: a === 3 && c === 4 && d === 4 && e === 5 && f === 5, info: [a, c, d, e, f].join(' → ') };
  });
  await check('„zuletzt geübt“ wird bei jeder Antwort gespeichert, auch bei falsch', async () => { await spring(5 * H); await falsch('дом'); return ev(() => { const e = loadLifetime().v['дом']; return { ok: Math.abs(e.z - Date.now()) < 1000 && e.d === 5, info: lifeRunsText(e) }; }); });
  await check('Standard: falsch stuft nicht zurück, Schalter aus', () => ev(() => { openSettings(); const t = document.getElementById('lifedemote-toggle').checked; closeOverlay('overlay-settings'); return !t && !lifeDemote && loadLifetime().v['дом'].d === 5; }));
  await check('Rückstufung eingeschaltet: falsch = −1, höchstens einmal am Tag', async () => {
    await ev(() => { openSettings(); const t = document.getElementById('lifedemote-toggle'); t.checked = true; t.dispatchEvent(new Event('change')); closeOverlay('overlay-settings'); });
    const a = await falsch('дом'); const c = await falsch('дом'); await spring(1 * T + 1000); const d = await falsch('дом');
    return { ok: a === 4 && c === 4 && d === 3, info: [a, c, d].join(' → ') };
  });
  await check('nach Rückstufung läuft der Abstand neu (Stufe 3 → 4 erst nach 7 Tagen)', async () => { await spring(6 * T); const a = await richtig('дом'); await spring(1 * T + 1000); const c = await richtig('дом'); return { ok: a === 3 && c === 4, info: a + ' → ' + c }; });
  await check('Schalter bleibt gespeichert und steht in der Sicherung', () => ev(() => localStorage.getItem('vokabeltrainer-life-demote') === '1' && BACKUP_KEYS.includes('vokabeltrainer-life-demote')));
  await check('Text: Stufe, nächste Stufe ab …, zuletzt geübt', () => ev(() => { const t = lifeRunsText(loadLifetime().v['дом']); return { ok: /^Wiederholt: 4 von 5 · nächste Stufe ab \d\d\.\d\d\.\d{4}, \d\d:\d\d · zuletzt geübt /.test(t), info: t }; }));
  await check('Vokabelliste: Haken 4/5 mit Text, Sortierung „Wiederholt: wenig zuerst“', () => ev(() => {
    openVocabList(); document.getElementById('vocab-search').value = 'дом'; renderVocabTable();
    const e = [...document.querySelectorAll('#vocab-table-body .ever-ok')].find(x => /4\/5/.test(x.textContent)); document.getElementById('vocab-search').value = '';
    document.getElementById('vocab-sort').value = 'runs-asc'; renderVocabTable(); const n = document.querySelectorAll('#vocab-table-body tr').length; document.getElementById('vocab-sort').value = 'default'; closeOverlay('overlay-vocab');
    return { ok: !!e && /Wiederholt: 4 von 5/.test(e.title) && n > 100 && /Wiederholt: wenig zuerst/.test(document.querySelector('#vocab-sort option[value="runs-asc"]').textContent), info: e && e.title };
  }));
  await check('Wortdetails zeigen Stufe und „zuletzt geübt“', () => ev(() => { openWordDetail(allVocabWords().find(v => v.ru === 'дом')); const t = document.getElementById('wd-srs').textContent; closeOverlay('overlay-worddetail'); return { ok: /Wiederholt: 4 von 5 .*zuletzt geübt/.test(t), info: t }; }));
  await check('Grammatik ebenfalls mit Abstand', async () => { const a = await ev(() => { progressMark('gender', 'дом', true); progressMark('gender', 'дом', true); return loadLifetime().g.gender['дом'].d; }); await spring(1 * T + 1000); const c = await ev(() => { progressMark('gender', 'дом', true); return loadLifetime().g.gender['дом'].d; }); return { ok: a === 1 && c === 2, info: a + ' → ' + c }; });
  await check('Bewertung zurücknehmen nimmt die Stufe zurück', () => ev(() => { window.__off += 60 * 864e5; resetProgress(); setMode('flip'); const cw = currentWord; const before = (loadLifetime().v[getKey(cw)] || {}).d || 0; flipReveal(); flipJudge(true); const mid = loadLifetime().v[getKey(cw)].d; undoFlip(); const after = (loadLifetime().v[getKey(cw)] || {}).d || 0; setMode('free'); return { ok: mid === Math.min(5, before + 1) && after === before, info: before + '→' + mid + '→' + after }; }));
  await check('Zusammenführen (Sicherung/GitHub): höhere Stufe, neueres „zuletzt geübt“', () => ev(() => { const m = mergeLifeEntry({ c: 1, w: 0, mb: 1, l: 5, d: 2, dd: 100, z: 300, dw: 0 }, { c: 2, w: 1, mb: 1, l: 3, d: 3, dd: 200, z: 250, dw: 50 }); return { ok: m.d === 3 && m.dd === 200 && m.z === 300 && m.dw === 50 && m.l === 3, info: JSON.stringify(m) }; }));
  await check('Gesamtstand löschen leert die Stufen', () => ev(() => { const oc = window.confirm; window.confirm = () => true; resetLifetime(); window.confirm = oc; return !Object.keys(loadLifetime().v).length; }));
  await check('kaputte Werte aus fremder Sicherung werden bereinigt', () => ev(() => { const e = cleanLifeEntry({ d: 99, z: 'x', dw: -5 }); return e.d === 5 && e.z === 0 && e.dw === 0; }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
