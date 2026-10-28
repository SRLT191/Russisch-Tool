const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Startseite „Stand je Sprachstufe“: Balken je Wiederholungsstufe 1–5 in eigener Farbe, Legende, Zahlen im Tooltip
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const R = []; const errs = [];
  const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const L = loadLifetime(), now = Date.now(), a1 = allVocabWords().filter(w => wordLevel(w) === 'A1');
    // A1: 1× Stufe 1, 2× Stufe 2, 3× Stufe 3, 4× Stufe 4, 5× Stufe 5, 1× Stufe 7 (zählt als sicher)
    let k = 0; [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [7, 1]].forEach(([d, n]) => { for (let i = 0; i < n; i++) L.v[getKey(a1[k++])] = { c: d, w: 0, mb: d, l: now, d, dd: now }; });
    saveLifetime(); setAppView('home');
    const s = homeStats().levels[0], row = document.querySelector('.home-lvr'), segs = [...row.querySelectorAll('.home-t span')];
    const cols = segs.map(x => getComputedStyle(x).backgroundColor);
    const leg = [...document.querySelectorAll('.home-legend .home-lg')].map(x => getComputedStyle(x).backgroundColor);
    const leer = [...document.querySelectorAll('.home-lvr')][1];
    return { st: s.stufen, sicher: s.sicher, arbeit: s.arbeit, n: segs.length, klassen: segs.map(x => x.className), cols, leg,
      title: row.getAttribute('title'), aria: row.getAttribute('aria-label'), zahl: row.querySelector('.home-n').textContent,
      leerSegs: leer.querySelectorAll('.home-t span').length, leerTitle: leer.getAttribute('title'),
      breiten: segs.map(x => parseFloat(x.style.width)), total: s.total };
  });
  ok('Zählung je Stufe (Stufe ≥ 5 zählt als 5)', JSON.stringify(r.st) === '[1,2,3,4,6]' && r.sicher === 6 && r.arbeit === 10, JSON.stringify(r.st));
  ok('fünf Abschnitte, sicher zuerst', r.n === 5 && r.klassen.join() === 's5,s4,s3,s2,s1', r.klassen.join());
  ok('jede Stufe hat eine eigene Farbe, Legende passt dazu', new Set(r.cols).size === 5 && new Set(r.leg).size === 5 && r.leg.slice().reverse().join() === r.cols.join(), r.cols.join(' | '));
  ok('Breiten entsprechen den Anteilen', Math.abs(r.breiten[0] - 6 / r.total * 100) < 0.01 && Math.abs(r.breiten[4] - 1 / r.total * 100) < 0.01);
  ok('Tooltip und Bildschirmleser nennen die Stufen', r.title === 'Stufe 5 (sicher): 6 · Stufe 4: 4 · Stufe 3: 3 · Stufe 2: 2 · Stufe 1: 1' && r.aria.includes('Stufe 5 (sicher): 6'), r.title);
  ok('Zahl rechts bleibt geübt / gesamt', r.zahl === '16 / ' + r.total, r.zahl);
  ok('Stufe ohne geübte Wörter: leerer Balken, Hinweis', r.leerSegs === 0 && r.leerTitle === 'noch nichts geübt');
  for (const t of ['light', 'dark']) {
    const c = await p.evaluate(t => { document.documentElement.setAttribute('data-theme', t); return [1, 2, 3, 4, 5].map(i => getComputedStyle(document.documentElement).getPropertyValue('--c-st' + i).trim()); }, t);
    ok('Farben gesetzt (' + t + ')', c.every(Boolean) && new Set(c).size === 5, c.join(' '));
  }
  await p.setViewportSize({ width: 320, height: 800 }); await p.waitForTimeout(150);
  const ue = await p.evaluate(() => { const c = document.querySelector('.home-legend').closest('.home-card'); return { doc: document.documentElement.scrollWidth, card: c.scrollWidth - c.clientWidth }; });
  ok('320 px: kein Überlauf durch die Legende', ue.doc <= 320 && ue.card <= 0, JSON.stringify(ue));
  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
