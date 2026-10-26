const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Handy: Kopfbereich in einer Zeile, Kartenaktionen in einer Zeile,
// „Gewusst“/„Nicht gewusst“ beim Aufdecken immer über der Leiste unten sichtbar; PC unverändert
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const errs = [];
  for (const [w, h] of [[412, 780], [360, 600], [320, 568]]) {
    const m = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    m.on('pageerror', e => errs.push(e.message));
    await m.goto('file://' + APP_PATH); await m.waitForTimeout(300);
    await check(w + '×' + h + ': Aufdecken – Knöpfe ganz über der Leiste unten, ohne Scrollen', () => m.evaluate(async () => {
      setAppView('vocab'); setMode('flip'); flipReveal(); window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 80));
      const k = document.getElementById('flip-known').getBoundingClientRect(), nav = document.getElementById('app-header').getBoundingClientRect();
      return { ok: k.bottom <= nav.top + 0.5 && k.top >= 0, info: Math.round(k.top) + '–' + Math.round(k.bottom) + ', Leiste ab ' + Math.round(nav.top) };
    }));
    await check(w + '×' + h + ': Kategorie, Vokabelliste und Alphabet in einer Zeile; Kartenaktionen in einer Zeile; kein Überlauf', () => m.evaluate(() => {
      const t = document.getElementById('sidebar-mobile-toggle').getBoundingClientRect(), tools = document.getElementById('sidebar-tools').getBoundingClientRect();
      const acts = [...document.querySelectorAll('#card-actions .card-act')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().top));
      const eineZeile = Math.abs(t.top - tools.top) < 2, aktZeile = new Set(acts).size === 1, kein = document.documentElement.scrollWidth <= innerWidth;
      return { ok: eineZeile && aktZeile && kein, info: 'Kopf ' + eineZeile + ', Aktionen ' + aktZeile + ', Breite ' + document.documentElement.scrollWidth };
    }));
    await m.close();
  }
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await check('PC: Knöpfe im normalen Fluss, Transliteration mit Beschriftung', () => p.evaluate(() => {
    setAppView('vocab'); setMode('flip'); flipReveal();
    const pos = getComputedStyle(document.getElementById('flip-row')).position, lab = getComputedStyle(document.getElementById('transcription-btn-label')).display;
    return { ok: pos === 'static' && lab !== 'none', info: pos + ', ' + lab };
  }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
