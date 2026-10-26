const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Wortschatzrunde 26.10.2026: Jahreszeiten in der Kategorie Zeit
const { chromium } = require('playwright');
const NEU = ['весна', 'лето', 'осень', 'зима', 'время года'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  await check('Jahreszeiten in Zeit: je einmal, mit Transliteration, Stufe A1 und Satz', () => p.evaluate(NEU => {
    const zeit = getAllWordsOfCat('Zeit'); const fehl = [];
    NEU.forEach(ru => {
      const w = allVocabWords().filter(x => x.ru === ru);
      if (w.length !== 1 || !zeit.some(x => x.ru === ru)) { fehl.push(ru + ' ×' + w.length); return; }
      const s = getWordSentence(w[0]);
      if (!w[0].tr || wordLevel(w[0]) !== 'A1' || !s || !s.ru.toLowerCase().includes(ru)) fehl.push(ru);
    });
    return { ok: !fehl.length, info: fehl.join(', ') };
  }, NEU));
  await check('Werkzeug Geschlecht: весна/зима/осень weiblich, лето sächlich', () => p.evaluate(() => {
    const g = w => (genderPool().find(x => x.ru === w) || {}).g;
    const r = ['весна', 'зима', 'осень', 'лето'].map(w => w + ' ' + g(w));
    return { ok: g('весна') === 'f' && g('зима') === 'f' && g('осень') === 'f' && g('лето') === 'n', info: r.join(', ') };
  }));
  await check('Sätze nicht leichter als das Wort', () => p.evaluate(NEU => {
    const L = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const f = NEU.filter(ru => { const w = allVocabWords().find(x => x.ru === ru); return L.indexOf(sentenceLevel(getWordSentence(w).ru)) < L.indexOf(wordLevel(w)); });
    return { ok: !f.length, info: f.join(', ') };
  }, NEU));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
