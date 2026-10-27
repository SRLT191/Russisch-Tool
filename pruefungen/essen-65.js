const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Essen +5 (A1 nach FIPI) und Besteck/Kochgeschirr nach „Alltagsobjekte“
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = await p.evaluate(() => {
    const R = []; const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
    const NEU = { 'продукты': ['produkty', 'Lebensmittel'], 'овощи': ['owoschtschi', 'Gemüse'], 'фрукты': ['frukty', 'Obst'], 'мороженое': ['moroschenoje', 'Eis|Speiseeis'], 'конфета': ['konfeta', 'Bonbon|Süßigkeit'] };
    const essen = getAllWordsOfCat('Essen'), alltag = getAllWordsOfCat('Alltagsobjekte');
    Object.entries(NEU).forEach(([ru, [tr, de]]) => {
      const w = essen.find(x => x.ru === ru), s = w && getWordSentence(w);
      ok(ru + ': in Essen, Umschrift, nur bestätigte Übersetzung', w && w.tr === tr && w.de.join('|') === de, w ? w.tr + ' · ' + w.de.join(', ') : 'fehlt');
      ok(ru + ': Stufe A1, Beispielsatz A1', w && wordLevel(w) === 'A1' && s && sentenceLevel(s.ru) === 'A1', s ? s.ru : 'kein Satz');
    });
    ok('Plural-Wörter nicht als „nur Plural“ abgefragt, мороженое sächlich, конфета weiblich',
      ['продукты', 'овощи', 'фрукты'].every(r => genderOf(r) === null) && genderOf('мороженое').g === 'n' && genderOf('конфета').g === 'f');
    const BESTECK = ['ложка', 'вилка', 'нож', 'тарелка', 'кастрюля', 'сковорода'];
    ok('Besteck und Kochgeschirr jetzt in „Alltagsobjekte“, nicht mehr in „Essen“', BESTECK.every(r => alltag.some(x => x.ru === r) && !essen.some(x => x.ru === r)));
    ok('Kein Wort doppelt im Wortschatz', (() => { const all = allVocabWords().map(w => w.ru); return all.length === new Set(all).size; })());
    ok('Essen 59, Alltagsobjekte 56', essen.length === 59 && alltag.length === 56, essen.length + ' / ' + alltag.length);
    return R;
  });
  R.push([errs.length ? 'XX ' : 'OK ', 'Keine JS-Fehler', errs.slice(0, 2).join(' | ')]);
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
