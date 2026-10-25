const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Startseite „Heute“: Start beim Öffnen, Weiterlernen, Tagesprotokoll (Sicherung, Zusammenführen),
// Tage in Folge, fällige Wiederholungen, Stand je Sprachstufe, Woche, Zuletzt geübt, Gruß, Schmalansicht.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const p = await b.newPage({ viewport: { width: 1366, height: 820 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const ev = (f, a) => p.evaluate(f, a);
  await check('öffnet auf „Heute“, Seitenleiste aus', () => ev(() => ({ ok: appView === 'home' && !!document.getElementById('home-view').offsetParent && document.getElementById('view-btn-home').classList.contains('active') && !document.getElementById('sidebar').offsetParent && !!document.querySelector('.home-go'), info: appView })));
  await check('Weiterlernen: ohne Verlauf Vokabeln, danach die zuletzt benutzte Ansicht', () => ev(() => {
    homeContinue(); const a = appView; setAppView('grammar'); showGrammarPanel('gender'); setAppView('home'); homeContinue();
    const c = appView === 'grammar' && document.getElementById('overlay-gender').classList.contains('open'); setAppView('home'); return { ok: a === 'vocab' && c, info: a };
  }));
  await check('Tagesprotokoll zählt Antworten und richtige von heute', () => ev(() => {
    setAppView('vocab'); const ws = getPool().slice(0, 3); updateScore(ws[0], true); updateScore(ws[1], true); updateScore(ws[2], false);
    const t = homeStats().today; return { ok: t.a === 3 && t.r === 2 && BACKUP_KEYS.includes('vokabeltrainer-daylog'), info: JSON.stringify(t) };
  }));
  await check('Tagesprotokoll: Zusammenführen nimmt je Tag das Höhere, fremde Daten werden bereinigt', () => ev(() => {
    const m = JSON.parse(mergeDaylog(JSON.stringify({ '2026-10-01': [5, 4], '2026-10-02': [3, 1] }), JSON.stringify({ '2026-10-02': [7, 2], '2026-10-03': [2, 2], '<img>': [9, 9], '2026-10-04': 'x', '2026-10-05': [3, 9] })));
    return { ok: JSON.stringify(m) === JSON.stringify({ '2026-10-01': [5, 4], '2026-10-02': [7, 2], '2026-10-03': [2, 2], '2026-10-05': [3, 3] }), info: JSON.stringify(m) };
  }));
  await check('Tage in Folge: heute + gestern + vorgestern = 3; nur bis gestern zählt auch', () => ev(() => {
    flushSaves(); const d = n => dayKey(new Date(Date.now() - n * 864e5));
    localStorage.setItem('vokabeltrainer-daylog', JSON.stringify({ [d(0)]: [5, 5], [d(1)]: [2, 1], [d(2)]: [1, 1], [d(4)]: [3, 3] })); const a = homeStats().streak;
    localStorage.setItem('vokabeltrainer-daylog', JSON.stringify({ [d(1)]: [2, 1], [d(2)]: [1, 1] })); const c = homeStats().streak;
    return { ok: a === 3 && c === 2, info: a + ' / ' + c };
  }));
  await check('fällig: nur wenn der Abstand zur nächsten Stufe abgelaufen ist', () => ev(() => {
    const L = loadLifetime(), now = Date.now(); Object.keys(L.v).forEach(k => delete L.v[k]); const ws = allVocabWords();
    L.v[getKey(ws[0])] = { c: 2, w: 0, mb: 1, l: now, d: 2, dd: now - 4 * 864e5 };   // 2 → 3 nach 3 Tagen: fällig
    L.v[getKey(ws[1])] = { c: 2, w: 0, mb: 1, l: now, d: 2, dd: now - 1 * 864e5 };   // noch nicht
    L.v[getKey(ws[2])] = { c: 9, w: 0, mb: 1, l: now, d: 5, dd: now - 99 * 864e5 }; // sicher: nicht fällig
    saveLifetime(); const s = homeStats(); return { ok: s.dueWords === 1, info: s.dueWords };
  }));
  await check('Stand je Sprachstufe: sicher und in Arbeit je Stufe', () => ev(() => {
    const s = homeStats(); const sum = s.levels.reduce((x, l) => x + l.sicher + l.arbeit, 0), tot = s.levels.reduce((x, l) => x + l.total, 0);
    return { ok: s.levels.length === 5 && sum === 3 && s.levels.reduce((x, l) => x + l.sicher, 0) === 1 && tot > 3000, info: s.levels.map(l => l.L + ' ' + l.sicher + '/' + l.arbeit + '/' + l.total).join(' · ') };
  }));
  await check('Anzeige: Gruß, Woche mit 7 Tagen, „Zuletzt geübt“ nach Zeit, Merkliste', () => ev(() => {
    bookmarkedWords.add(allVocabWords()[0].ru);
    setAppView('listening'); setAppView('vocab'); setAppView('home');
    const el = document.getElementById('home-view'); const h1 = el.querySelector('h1').textContent;
    const bars = el.querySelectorAll('.home-week div').length, res = [...el.querySelectorAll('.home-res button')].map(b => b.textContent.trim());
    bookmarkedWords.delete(allVocabWords()[0].ru);
    return { ok: /^(Доброе утро|Добрый день|Добрый вечер|Доброй ночи)!$/.test(h1) && bars === 7 && /^Vokabeln/.test(res[0]) && /^Hören/.test(res[1]) && !res.some(r => /A1|A2/.test(r)) && res.some(r => /^Merkliste · 1/.test(r)), info: h1 + ' | ' + res.join(' | ') };
  }));
  await check('Gruß nach Tageszeit', () => ev(() => {
    const echt = Date; const mk = hh => { window.Date = class extends echt { constructor(...a) { if (a.length) super(...a); else { super(); this.setHours(hh, 0, 0, 0); } } static now() { return echt.now(); } }; renderHome(); const t = document.querySelector('#home-view h1').textContent; window.Date = echt; return t; };
    const r = [mk(8), mk(14), mk(20), mk(2)]; renderHome();
    return { ok: r.join('|') === 'Доброе утро!|Добрый день!|Добрый вечер!|Доброй ночи!', info: r.join('|') };
  }));
  await check('fremde Werte im Protokoll lösen keinen Code aus', () => ev(() => { localStorage.setItem('vokabeltrainer-daylog', '{"<img src=x onerror=window.__x=1>":[1,1]}'); renderHome(); return !window.__x && !document.querySelector('#home-view img'); }));
  await check('Dunkelansicht ohne Fehler', () => ev(() => { setThemeMode('dark'); renderHome(); const ok = getComputedStyle(document.querySelector('.home-card')).backgroundColor !== 'rgb(255, 255, 255)'; setThemeMode('light'); return ok; }));
  for (const w of [320, 360, 390, 768, 1024]) await check('Breite ' + w + ' px: kein Überlauf', async () => {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(150);
    return ev(() => { setAppView('home'); return { ok: document.documentElement.scrollWidth <= document.documentElement.clientWidth, info: document.documentElement.scrollWidth + '' }; });
  });
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
