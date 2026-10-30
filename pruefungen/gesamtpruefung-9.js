const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Fixes der Gesamtprüfung vom 30.10.: Satz zu дикий, Reste der alten Stufen-Übersicht, Kontrast der Alphabet-Beispiele
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const R = []; const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  const h = fs.readFileSync(APP_PATH, 'utf8');
  const reste = ['.lvl-bar ', '.lvl-bar-started', '.lvl-bar-learned', '.lvl-key', '.lvl-tool-num'].filter(c => h.includes(c));
  ok('Keine CSS-Reste der alten Stufen-Übersicht', reste.length === 0, reste.join(', '));
  const b = await chromium.launch(); const errs = [];
  for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme }); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
    if (scheme === 'light') {
      const s = await p.evaluate(() => { const w = findVocabEntry('дикий'), x = getWordSentence(w); return { ru: x.ru, de: x.de, lv: sentenceLevel(x.ru), wl: wordLevel(w), st: Object.keys(levelStats().A1).join(',') }; });
      ok('дикий: Satz nicht schwerer als das Wort (B1)', s.ru === 'Это дикий кот.' && s.de === 'Das ist ein wilder Kater.' && ['A1', 'A2', 'B1'].includes(s.lv) && s.wl === 'B1', JSON.stringify(s));
      ok('levelStats liefert nur noch, was gelesen wird', s.st === 'total,learned', s.st);
    }
    const k = await p.evaluate(() => {
      openAlphabet();
      const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const bg = el => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c.a > 0.9) return c; el = el.parentElement; } return { r: 255, g: 255, b: 255 }; };
      const el = document.querySelector('.alpha-example span'); const a = lum(parse(getComputedStyle(el).color)), c = lum(bg(el));
      return Math.round((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05) * 10) / 10;
    });
    ok(scheme + ': Umschrift und Übersetzung im Alphabet-Beispiel ≥ 4,5 : 1', k >= 4.5, String(k));
    await p.close();
  }
  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
