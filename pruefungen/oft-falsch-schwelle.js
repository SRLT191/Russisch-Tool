const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Startseite „Oft falsch“: Schalter „ab 2× / 3× / 5× / 10×“, Knopf übt alle Wörter ab dieser Fehlerzahl, Wahl bleibt gemerkt
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const R = []; const errs = [];
  const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  // Fehlerzähler: 3 Wörter mit 2, 4 mit 3, 5 mit 6, 1 mit 12, 1 sicheres mit 9 (zählt nicht), 1 mit 1 (zählt nicht)
  await p.evaluate(() => {
    const L = loadLifetime(), now = Date.now(), ws = allVocabWords(); let k = 0;
    [[2, 3], [3, 4], [6, 5], [12, 1]].forEach(([f, n]) => { for (let i = 0; i < n; i++) L.v[getKey(ws[k++])] = { c: 1, w: f + 1, f, mb: 1, l: now, d: 1, dd: now }; });
    L.v[getKey(ws[k++])] = { c: 9, w: 9, f: 9, mb: 5, l: now, d: 5, dd: now };
    L.v[getKey(ws[k++])] = { c: 1, w: 1, f: 1, mb: 1, l: now, d: 1, dd: now };
    saveLifetime(); setAppView('home');
  });
  const stand = () => p.evaluate(() => {
    const c = document.getElementById('home-hard'), btns = [...c.querySelectorAll('.set-seg button')];
    return { rows: c.querySelectorAll('.home-hard > div').length, mehr: (c.querySelector('.home-hard-mehr') || {}).textContent || '',
      on: (c.querySelector('.set-seg button.on') || {}).textContent || '', zahlen: btns.map(x => x.querySelector('small').textContent).join(','),
      aus: btns.filter(x => x.disabled).map(x => x.textContent.trim().split(' ')[1]).join(','), knopf: c.querySelector('.home-btn').textContent.trim(),
      erste: c.querySelector('.home-hard small').textContent };
  });
  let s = await stand();
  ok('Start: ab 2×, 13 Wörter, 5 gezeigt, „und 8 weitere“', /^ab 2×/.test(s.on) && s.rows === 5 && s.mehr === 'und 8 weitere' && s.knopf === 'Alle 13 üben', JSON.stringify(s));
  ok('Zahlen je Schalter: 13 / 10 / 6 / 1, sichere und 1× zählen nicht', s.zahlen === '13,10,6,1', s.zahlen);
  ok('häufigste zuerst', s.erste === '12× falsch', s.erste);
  await p.click('#home-hard .set-seg button:nth-child(3)');
  s = await stand();
  ok('ab 5×: 6 Wörter, Knopf „Alle 6 üben“', /^ab 5×/.test(s.on) && s.rows === 5 && s.mehr === 'und 1 weiteres' && s.knopf === 'Alle 6 üben', JSON.stringify(s));
  const pool = await p.evaluate(() => { document.querySelector('#home-hard .home-btn').click(); return { a: activeMain, n: getPool().length, min: Math.min(...getPool().map(w => lifeFehler(lifeVocabEntry(w)))) }; });
  ok('Knopf übt genau die 6 Wörter ab 5 Fehlern', pool.a === 'hard' && pool.n === 6 && pool.min >= 5, JSON.stringify(pool));
  await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => setAppView('home'));
  s = await stand();
  ok('Wahl bleibt nach Neuladen', /^ab 5×/.test(s.on), s.on);
  await p.click('#home-hard .set-seg button:nth-child(4)');
  s = await stand();
  ok('ab 10×: ein Wort, Knopf „Dieses Wort üben“', s.rows === 1 && !s.mehr && s.knopf === 'Dieses Wort üben', JSON.stringify(s));
  // nur noch Wörter unter der gemerkten Schwelle → Anzeige fällt auf „ab 2×“ zurück, gemerkte Wahl bleibt
  const r = await p.evaluate(() => { const L = loadLifetime(); Object.values(L.v).forEach(e => { if (e.f === 12 || e.f === 6) e.f = 3; }); saveLifetime(); setAppView('home');
    return { on: document.querySelector('#home-hard .set-seg button.on').textContent, aus: [...document.querySelectorAll('#home-hard .set-seg button:disabled')].length, gemerkt: localStorage.getItem('vokabeltrainer-hard-min') }; });
  ok('Schwelle zu hoch: Anzeige ab 2×, leere Schalter gesperrt, Wahl bleibt gemerkt', /^ab 2×/.test(r.on) && r.aus === 2 && r.gemerkt === '10', JSON.stringify(r));
  await p.setViewportSize({ width: 320, height: 800 }); await p.waitForTimeout(150);
  const ue = await p.evaluate(() => { const c = document.getElementById('home-hard'); return { doc: document.documentElement.scrollWidth, card: c.scrollWidth - c.clientWidth, h: Math.round(c.querySelector('.set-seg button').getBoundingClientRect().height) }; });
  ok('320 px: kein Überlauf, Tippflächen ≥ 44 px', ue.doc <= 320 && ue.card <= 0 && ue.h >= 44, JSON.stringify(ue));
  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
