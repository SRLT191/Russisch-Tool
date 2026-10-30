const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Geographie +15: A2-Wörter география, порт, село, dann Substantive nach Häufigkeit
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = await p.evaluate(() => {
    const R = []; const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
    const NEU = { 'география': ['Geographie', 'A2', 'f'], 'порт': ['Hafen', 'A2', 'm'], 'село': ['Dorf', 'A2', 'n'], 'штат': ['Bundesstaat', 'B1', 'm'],
      'канал': ['Kanal', 'B1', 'm'], 'зона': ['Zone', 'B2', 'f'], 'край': ['Region', 'B2', 'm'], 'область': ['Gebiet', 'B2', 'f'], 'округ': ['Bezirk', 'B2', 'm'],
      'деревня': ['Dorf', 'B2', 'f'], 'местность': ['Gegend', 'C1', 'f'], 'хребет': ['Gebirgskamm', 'C1', 'm'], 'пригород': ['Vorort', 'C1', 'm'], 'глобус': ['Globus', 'C1', 'm'],
      'провинция': ['Provinz', 'C1', 'f'] };
    const kl = getAllWordsOfCat('Geographie');
    Object.entries(NEU).forEach(([ru, [de, lv, g]]) => {
      const w = kl.find(x => x.ru === ru), s = w && getWordSentence(w);
      ok(ru + ': in Geographie, Umschrift nach Regel, nur bestätigte Übersetzung', w && w.tr === trLetters(ru) && w.de.join('|') === de, w ? w.tr + ' · ' + w.de.join(', ') : 'fehlt');
      ok(ru + ': Stufe ' + lv + ', Satz mit Wort und Übersetzung, nicht schwerer als das Wort', w && wordLevel(w) === lv && s
        && s.ru.toLowerCase().includes(ru.toLowerCase()) && s.de.includes(w.de[0].replace(/\s*\(.*\)$/, '')) && LEVELS.indexOf(sentenceLevel(s.ru)) <= LEVELS.indexOf(lv), s ? s.ru + ' / ' + s.de + ' · ' + sentenceLevel(s.ru) : 'kein Satz');
      if (g) ok(ru + ': Geschlecht ' + g, (genderOf(ru) || {}).g === g, JSON.stringify(genderOf(ru)));
    });
    ok('Kein Wort doppelt im Wortschatz', (() => { const all = allVocabWords().map(w => w.ru); return all.length === new Set(all).size; })());
    ok('Geographie 65', kl.length === 65, String(kl.length));
    return R;
  });
  R.push([errs.length ? 'XX ' : 'OK ', 'Keine JS-Fehler', errs.slice(0, 2).join(' | ')]);
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
