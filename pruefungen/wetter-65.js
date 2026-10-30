const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Wetter +14: Substantive nach Häufigkeit (keine A1/A2-Wörter mehr)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = await p.evaluate(() => {
    const R = []; const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
    const NEU = { 'шторм': ['Sturm (auf See)', 'B2', 'm'], 'капля': ['Tropfen', 'C1', 'f'], 'цунами': ['Tsunami', 'C1', 'n'], 'потоп': ['Sintflut', 'C1', 'm'],
      'дождик': ['Nieselregen', 'C1', 'm'], 'сквозняк': ['Durchzug', 'C1', 'm'], 'лужа': ['Pfütze', 'C1', 'f'], 'тайфун': ['Taifun', 'C1', 'm'], 'смог': ['Smog', 'C1', 'm'],
      'снежинка': ['Schneeflocke', 'C1', 'f'], 'сосулька': ['Eiszapfen', 'C1', 'f'], 'непогода': ['Unwetter', 'C1', 'f'], 'прохлада': ['Kühle', 'C1', 'f'], 'термометр': ['Thermometer', 'C1', 'm'] };
    const kl = getAllWordsOfCat('Wetter');
    Object.entries(NEU).forEach(([ru, [de, lv, g]]) => {
      const w = kl.find(x => x.ru === ru), s = w && getWordSentence(w);
      ok(ru + ': in Wetter, Umschrift nach Regel, nur bestätigte Übersetzung', w && w.tr === trLetters(ru) && w.de.join('|') === de, w ? w.tr + ' · ' + w.de.join(', ') : 'fehlt');
      ok(ru + ': Stufe ' + lv + ', Satz mit Wort und Übersetzung, nicht schwerer als das Wort', w && wordLevel(w) === lv && s
        && s.ru.toLowerCase().includes(ru.toLowerCase()) && s.de.includes(w.de[0].replace(/\s*\(.*\)$/, '')) && LEVELS.indexOf(sentenceLevel(s.ru)) <= LEVELS.indexOf(lv), s ? s.ru + ' / ' + s.de + ' · ' + sentenceLevel(s.ru) : 'kein Satz');
      if (g) ok(ru + ': Geschlecht ' + g, (genderOf(ru) || {}).g === g, JSON.stringify(genderOf(ru)));
    });
    ok('Kein Wort doppelt im Wortschatz', (() => { const all = allVocabWords().map(w => w.ru); return all.length === new Set(all).size; })());
    ok('Wetter 65', kl.length === 65, String(kl.length));
    return R;
  });
  R.push([errs.length ? 'XX ' : 'OK ', 'Keine JS-Fehler', errs.slice(0, 2).join(' | ')]);
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
