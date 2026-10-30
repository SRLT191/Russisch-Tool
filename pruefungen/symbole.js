const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Jedes benutzte Tabler-Symbol (ti-…) steckt in der eingebetteten Schrift – sonst bliebe die Stelle leer.
// Dazu im Browser: jedes sichtbare Symbol hat eine Glyphe (Inhalt von ::before).
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const R = []; const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  const h = fs.readFileSync(APP_PATH, 'utf8');
  const defined = new Set([...h.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map(m => m[1]));
  const used = new Set([...h.replace(/\.ti-[a-z0-9-]+:before/g, '').matchAll(/\bti-[a-z0-9]+(?:-[a-z0-9]+)*\b/g)].map(m => m[0]));
  const fehlt = [...used].filter(u => !defined.has(u)), unbenutzt = [...defined].filter(d => !used.has(d));
  ok('Alle benutzten Symbole sind eingebettet', fehlt.length === 0, fehlt.join(', ') || used.size + ' Symbole');
  ok('Keine ungenutzten Symbole in der Schrift', unbenutzt.length === 0, unbenutzt.join(', '));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const leer = await p.evaluate(() => {
    const out = [];
    const pruefe = wo => document.querySelectorAll('i.ti, .ti').forEach(el => { if (!el.getClientRects().length) return; const c = getComputedStyle(el, '::before').content; if (!c || c === 'none' || c === '""') out.push(wo + ': ' + el.className); });
    pruefe('Heute'); setAppView('vocab'); pruefe('Vokabeln'); setAppView('grammar'); pruefe('Grammatik'); setAppView('listening'); pruefe('Hören');
    openSettings(); pruefe('Einstellungen'); closeOverlay('overlay-settings'); openLevelOverview(); pruefe('Stufen'); closeOverlay('overlay-levels'); openAlphabet(); pruefe('Alphabet'); closeOverlay('overlay-alphabet');
    return [...new Set(out)];
  });
  ok('Sichtbare Symbole haben eine Glyphe (Ansichten, Einstellungen, Stufen, Alphabet)', leer.length === 0, leer.slice(0, 5).join(' | '));
  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
