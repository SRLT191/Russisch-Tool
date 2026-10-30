const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Kyrillisches Alphabet überarbeitet: Umschrift nach Schalter, Literata, Reihenfolge umschaltbar und gemerkt,
// falsche Freunde, Beispiel vorlesen, Schmal- und Handyansicht
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const R = []; const errs = [];
  const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);

  const d = await p.evaluate(() => {
    const L = ALPHABET_LETTERS;
    return { n: L.length, abc: L.map(l => l.upper).join(''), alleBsp: L.every(l => l.example && l.example.ru.toLowerCase().includes(l.lower)),
      ff: L.filter(l => l.ff).map(l => l.upper).join(''), ze: L.find(l => l.lower === 'з').tr };
  });
  ok('33 Buchstaben in der Reihenfolge А–Я', d.n === 33 && d.abc === 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', d.abc);
  ok('Jeder Buchstabe hat ein Beispielwort, das ihn enthält (auch Ъ)', d.alleBsp);
  ok('Falsche Freunde В Е Н Р С У Х markiert', d.ff === 'ВЕНРСУХ', d.ff);
  ok('З als „s (stimmhaft)“ wie in der Umschrift der App', d.ze === 's (stimmhaft)', d.ze);

  // Umschrift folgt dem Schalter
  const tr = await p.evaluate(() => {
    const ex = () => (document.querySelector('.alpha-card[data-letter="з"] .alpha-example') || {}).textContent || '';
    const out = {};
    setTranscriptionMode('letters'); openAlphabet(); out.letters = ex();
    setTranscriptionMode('speech'); out.speech = ex();
    setTranscriptionMode('off'); out.off = ex();
    setTranscriptionMode('speech'); closeOverlay('overlay-alphabet');
    return out;
  });
  ok('Umschrift der Beispiele folgt dem Schalter (Buchstaben / Aussprache / aus)', /\[sawtra\]/.test(tr.letters) && /\[saftra\]/.test(tr.speech) && !/\[/.test(tr.off), JSON.stringify(tr));

  // Literata
  const f = await p.evaluate(() => { openAlphabet(); const fam = sel => getComputedStyle(document.querySelector(sel)).fontFamily; return { b: fam('.alpha-letters'), ex: fam('.alpha-example b'), size: parseFloat(getComputedStyle(document.querySelector('.alpha-letters')).fontSize), desc: parseFloat(getComputedStyle(document.querySelector('.alpha-desc')).fontSize) }; });
  ok('Buchstaben und Beispielwörter in Literata, Buchstaben groß, Erklärung ≥ 13 px', /Literata/.test(f.b) && /Literata/.test(f.ex) && f.size >= 28 && f.desc >= 13, JSON.stringify(f));

  // Reihenfolge
  const o = await p.evaluate(() => {
    const titel = () => [...document.querySelectorAll('#alphabet-content .alpha-section-title')].map(t => t.childNodes[0].textContent.trim());
    const out = { laut: titel(), ffGruppe: [...document.querySelectorAll('#alphabet-content .alpha-grid')][1].querySelectorAll('.alpha-card').length };
    document.querySelectorAll('#alphabet-content .alpha-bar .set-seg button')[1].click();
    out.abc = { titel: titel().length, erste: document.querySelector('.alpha-card').dataset.letter, nr: document.querySelectorAll('.alpha-nr').length, gemerkt: localStorage.getItem('vokabeltrainer-alphabet-order') };
    out.backup = BACKUP_KEYS.includes('vokabeltrainer-alphabet-order');
    return out;
  });
  ok('„Nach Lauten“: Vokale, Falsche Freunde, Konsonanten, Zeichen', o.laut.join('|') === 'Vokale|Falsche Freunde|Konsonanten|Zeichen ohne eigenen Laut' && o.ffGruppe === 7, JSON.stringify(o.laut));
  ok('„Alphabetisch“: eine Liste А–Я mit Nummern, Wahl gemerkt und in der Sicherung', o.abc.titel === 0 && o.abc.erste === 'а' && o.abc.nr === 33 && o.abc.gemerkt === 'abc' && o.backup, JSON.stringify(o));
  await p.reload(); await p.waitForTimeout(300);
  const nach = await p.evaluate(() => { openAlphabet(); const r = document.querySelectorAll('.alpha-nr').length; setAlphaOrder('laut'); closeOverlay('overlay-alphabet'); return r; });
  ok('Reihenfolge bleibt nach Neuladen', nach === 33, String(nach));

  // Vorlesen: Beispiel liest das Wort, Knopf den Buchstaben
  const sp = await p.evaluate(() => { const gesagt = []; const alt = window.speak; window.speak = t => gesagt.push(t); openAlphabet();
    document.querySelector('.alpha-card[data-letter="ъ"] .alpha-example').click(); document.querySelector('.alpha-card[data-letter="ъ"] .alpha-speak-btn').click();
    window.speak = alt; closeOverlay('overlay-alphabet'); return gesagt; });
  ok('Beispiel antippen liest das Wort, Knopf den Buchstaben', sp.join('|') === 'подъезд|ъ', sp.join('|'));

  // Schmal und Handy
  for (const w of [320, 390, 700]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(100);
    const m = await p.evaluate(() => { openAlphabet(); const h = sel => Math.min(...[...document.querySelectorAll(sel)].map(x => Math.round(x.getBoundingClientRect().height)));
      const body = document.getElementById('alphabet-content'); const r = { doc: document.documentElement.scrollWidth - innerWidth, inhalt: body.scrollWidth - body.clientWidth, knopf: h('.alpha-speak-btn'), bsp: h('.alpha-example') }; closeOverlay('overlay-alphabet'); return r; });
    ok(w + ' px: kein Überlauf, Tippflächen ≥ 44 px', m.doc <= 0 && m.inhalt <= 0 && m.knopf >= 44 && m.bsp >= 44, JSON.stringify(m));
  }

  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
