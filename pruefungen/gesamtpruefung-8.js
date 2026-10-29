const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Fixes der Gesamtprüfung vom 29.10.: Tagesziel und „Oft falsch“-Schwelle in der Sicherung,
// Schalter „Oft falsch“ passt in die Karte, Beispielsätze, Bedeutungsklassen der Wortgruppen,
// Anführungszeichen im Imperativ-Hinweis, aufgeteilte Tastenkürzel
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const R = []; const errs = [];
  const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);

  // 1. Sicherung: beide Schlüssel enthalten; auf einem leeren Gerät kommen sie an und gelten sofort
  const s = await p.evaluate(() => {
    setDayGoal(200); setHardMin(5); flushSaves();
    const data = {}; BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
    const drin = 'vokabeltrainer-day-goal' in data && 'vokabeltrainer-hard-min' in data;
    localStorage.removeItem('vokabeltrainer-day-goal'); localStorage.removeItem('vokabeltrainer-hard-min');
    dayGoal = 0; hardMin = 2;
    mergeAllFromBackup(data);
    return { drin, dayGoal, hardMin, ls: [localStorage.getItem('vokabeltrainer-day-goal'), localStorage.getItem('vokabeltrainer-hard-min')] };
  });
  ok('Sicherung enthält Tagesziel und „Oft falsch“-Schwelle', s.drin, JSON.stringify(s));
  ok('Zusammenführen auf leerem Gerät übernimmt beide sofort', s.dayGoal === 200 && s.hardMin === 5 && s.ls.join() === '200,5', JSON.stringify(s));
  const lokal = await p.evaluate(() => { setDayGoal(50); flushSaves(); mergeAllFromBackup({ 'vokabeltrainer-day-goal': '500' }); return dayGoal; });
  ok('vorhandene Einstellung des Geräts bleibt', lokal === 50, String(lokal));

  // 2. Schalter „Oft falsch“ mit vierstelligen Zahlen bleibt in der Karte
  await p.evaluate(() => {
    const L = loadLifetime(), now = Date.now(), ws = allVocabWords();
    ws.slice(0, 1200).forEach((w, i) => { L.v[getKey(w)] = { c: 1, w: 20, f: 12 + (i % 3), mb: 1, l: now, d: 1, dd: now }; });
    saveLifetime(); setHardMin(2); setAppView('home');
  });
  for (const w of [1000, 1100, 1280, 1700, 701, 390, 320]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(120);
    const m = await p.evaluate(() => {
      const seg = document.querySelector('#home-hard .set-seg'), card = document.getElementById('home-hard');
      const cs = getComputedStyle(card), innen = card.getBoundingClientRect().right - parseFloat(cs.paddingRight);
      return { seg: Math.round(seg.getBoundingClientRect().right), innen: Math.round(innen), zahl: seg.querySelector('small').textContent, doc: document.documentElement.scrollWidth - innerWidth };
    });
    ok(w + ' px: Schalter „Oft falsch“ bleibt in der Karte (' + m.zahl + ' Wörter)', m.seg <= m.innen + 1 && m.doc <= 0, JSON.stringify(m));
  }
  await p.setViewportSize({ width: 1280, height: 900 });

  // 3. Beispielsätze
  const saetze = await p.evaluate(() => {
    const f = ru => SENTENCE_PAIRS.find(x => x.ru === ru);
    return {
      neu: !!f('Мой брат — уборщик.') && !!f('Мэр много работает.') && !!f('У меня есть патент на работу.'),
      de: [(f('Мой брат — уборщик.') || {}).de, (f('У меня есть патент на работу.') || {}).de],
      alt: SENTENCE_PAIRS.some(x => ['Он работает как уборщик.', 'Мэр работает много.', 'У меня есть патент.'].includes(x.ru))
    };
  });
  ok('drei Beispielsätze ersetzt', saetze.neu && !saetze.alt && saetze.de[0] === 'Mein Bruder ist Gebäudereiniger.' && saetze.de[1] === 'Ich habe eine Arbeitserlaubnis.', JSON.stringify(saetze));

  // 4. Wortgruppen: keine unpassenden Paare mehr, passende bleiben
  const wg = await p.evaluate(() => ({
    weg: [['слабый', 'голова'], ['местный', 'мать'], ['местный', 'отец'], ['красивый', 'год'], ['красивый', 'время'], ['сильный', 'голова'], ['местный', 'комната']].filter(([a, n]) => wgFits(a, n)).map(x => x.join(' ')),
    da: [['слабый', 'студент'], ['слабый', 'рука'], ['местный', 'врач'], ['местный', 'музей'], ['местный', 'город'], ['красивый', 'вечер'], ['красивый', 'город'], ['сильный', 'рука'], ['сильный', 'брат']].filter(([a, n]) => !wgFits(a, n)).map(x => x.join(' '))
  }));
  ok('Wortgruppen ohne „schwacher Kopf“, „hiesige Mutter“, „schönes Jahr“', wg.weg.length === 0, wg.weg.join(', '));
  ok('passende Paare bleiben möglich', wg.da.length === 0, wg.da.join(', '));

  // 5. Imperativ-Hinweise mit deutschen Anführungszeichen
  const imp = await p.evaluate(() => ['видеть', 'хотеть', 'мочь'].map(v => conjugationData[v].imperativeNote));
  ok('Imperativ-Hinweise mit „…“ statt geraden Anführungszeichen', imp.every(t => /„[a-zäöü]+“/.test(t) && !t.includes('"')), imp.join(' | '));

  // 6. Aufgeräumter Code: toggleTheme weg, Tastenkürzel in Teilfunktionen
  const code = await p.evaluate(() => ({ toggle: typeof window.toggleTheme, teile: ['keyGlobal', 'keyVocabChoice', 'keyListeningSpace', 'keyToolReveal', 'keyHearquizFlip', 'keyVocabCard'].filter(f => typeof window[f] !== 'function') }));
  ok('toggleTheme entfernt, Tastenkürzel in sechs Teilfunktionen', code.toggle === 'undefined' && code.teile.length === 0, JSON.stringify(code));
  const tasten = await p.evaluate(() => {
    const out = {};
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    out.hilfe = !!document.querySelector('.overlay.open');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.zu = !document.querySelector('.overlay.open');
    return out;
  });
  ok('Taste ? öffnet die Übersicht, Esc schließt sie', tasten.hilfe && tasten.zu, JSON.stringify(tasten));

  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
