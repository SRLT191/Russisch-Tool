const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Fehlerzähler für „Oft falsch“: +1 bei falsch, −1 bei richtig, nie unter 0; Zusammenführen: der neuere Stand zählt
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message.slice(0, 120)]); } };
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  // echte Antworten über die Oberfläche (Freitext)
  const antwort = (richtig) => ev(async (richtig) => {
    setAppView('vocab'); setMode('free');
    const w = allVocabWords().find(x => x.ru === 'книга') || allVocabWords()[0];
    nextWord(w); await new Promise(r => setTimeout(r, 50));
    const inp = document.getElementById('answer-input'); inp.value = richtig ? w.de[0] : 'qqqq'; checkAnswer();
    await new Promise(r => setTimeout(r, 50));
    const e = lifeVocabEntry(w); return { ru: w.ru, f: e && e.f, c: e && e.c, w: e && e.w };
  }, richtig);
  await check('Zweimal falsch → Zähler 2, Wort unter „Oft falsch“', async () => {
    await antwort(false); const e = await antwort(false);
    const drin = await ev(ru => homeStats().hard.some(x => x.w.ru === ru && x.falsch === 2), e.ru);
    return { ok: e.f === 2 && e.w === 2 && drin, info: JSON.stringify(e) };
  });
  await check('Einmal richtig → Zähler 1, Wort nicht mehr unter „Oft falsch“, Gesamt bleibt', async () => {
    const e = await antwort(true);
    const drin = await ev(ru => homeStats().hard.some(x => x.w.ru === ru), e.ru);
    return { ok: e.f === 1 && e.w === 2 && e.c === 1 && !drin, info: JSON.stringify(e) };
  });
  await check('Nie unter 0', async () => { await antwort(true); const e = await antwort(true); return { ok: e.f === 0, info: JSON.stringify(e) }; });
  await check('Alter Eintrag ohne Zähler: Start mit falsch minus richtig', () => ev(() => {
    const m = {}; m.x = { c: 1, w: 4, mb: 1, l: 1, z: 1 }; const vor = lifeFehler(m.x);
    lifeNote(m, 'x', true, 1); return { ok: vor === 3 && m.x.f === 2, info: vor + ' → ' + m.x.f };
  }));
  await check('Zusammenführen: der neuere Stand zählt (beide Richtungen)', () => ev(() => {
    const alt = { c: 1, w: 5, mb: 1, l: 1, z: 1000, f: 5 }, neu = { c: 4, w: 5, mb: 1, l: 1, z: 2000, f: 1 };
    const a = mergeLifeEntry(alt, neu).f, b = mergeLifeEntry(neu, alt).f;
    const hoeher = mergeLifeEntry({ c: 1, w: 2, z: 1000, f: 0 }, { c: 1, w: 4, z: 3000, f: 3 }).f;
    return { ok: a === 1 && b === 1 && hoeher === 3, info: a + ' / ' + b + ' / ' + hoeher };
  }));
  await check('Zusammenführen mit altem Gerät ohne Zähler', () => ev(() => {
    const a = mergeLifeEntry({ c: 2, w: 3, z: 1000, f: 0 }, { c: 2, w: 6, z: 5000 }).f;   // neueres Gerät ohne Zähler: 6−2
    const b = mergeLifeEntry({ c: 2, w: 3, z: 1000 }, { c: 2, w: 6, z: 5000 }).f;         // beide ohne: bleibt ohne
    return { ok: a === 4 && b === undefined, info: a + ' / ' + b };
  }));
  await check('Bereinigen: Zähler bleibt, Unsinn fällt weg', () => ev(() => {
    const ok1 = cleanLifeEntry({ c: 1, w: 2, f: 2 }).f === 2, ok2 = !('f' in cleanLifeEntry({ c: 1, w: 2, f: -1 })), ok3 = !('f' in cleanLifeEntry({ c: 1, w: 2, f: 'x' })), ok4 = !('f' in cleanLifeEntry({ c: 1, w: 2 }));
    return { ok: ok1 && ok2 && ok3 && ok4, info: [ok1, ok2, ok3, ok4].join(' ') };
  }));
  await check('Sicherung: Zähler übersteht Einlesen', () => ev(() => {
    const L = JSON.stringify({ v: { 'тест': { c: 1, w: 3, z: 9e12, f: 2 } }, g: {} });
    const out = JSON.parse(mergeBackupValue('vokabeltrainer-lifetime', JSON.stringify({ v: {}, g: {} }), L));
    return { ok: out.v['тест'].f === 2, info: JSON.stringify(out.v['тест']) };
  }));
  await check('Bewertung zurücknehmen stellt den Zähler wieder her', () => ev(() => {
    const m = { x: { c: 0, w: 2, f: 2, z: 1 } }; const snap = lifeSnap(m, 'x'); lifeNote(m, 'x', true, 1); const nach = m.x.f;
    lifeRestore(m, 'x', snap); return { ok: nach === 1 && m.x.f === 2, info: nach + ' → ' + m.x.f };
  }));
  await check('Keine JS-Fehler', () => ({ ok: !errs.length, info: errs.slice(0, 2).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
