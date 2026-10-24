const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const X = '<img src=x onerror="window.__x=(window.__x||0)+1">';
  await p.evaluate((X) => {
    const sc = {}; sc[X] = { box: 1, correct: 0, wrong: 2, due: 0 };
    localStorage.setItem('vokabeltrainer-scores', JSON.stringify(sc));
    localStorage.setItem('vokabeltrainer-bookmarks', JSON.stringify([X]));
    localStorage.setItem('vokabeltrainer-favorite-cats', JSON.stringify([X, 'Essen']));
    localStorage.setItem('vokabeltrainer-selection', JSON.stringify({ activeMain: X, activeSub: X, selectedBlocksByCat: { [X]: [0] } }));
    localStorage.setItem('vokabeltrainer-tool-settings', JSON.stringify({ conjVerb: X, declAdj: X, noun: X }));
    localStorage.setItem('vokabeltrainer-hearquiz-settings', JSON.stringify({ cats: [X], mode: X, lang: X }));
    localStorage.setItem('vokabeltrainer-hoertrainer-cats', JSON.stringify([X]));
    ['vokabeltrainer-hoertrainer-pause','vokabeltrainer-block-size','vokabeltrainer-direction','vokabeltrainer-theme','vokabeltrainer-session-goal','vokabeltrainer-speak-rate','vokabeltrainer-view','vokabeltrainer-grammar-panel','vokabeltrainer-listening-panel'].forEach(k => localStorage.setItem(k, X));
    localStorage.setItem('vokabeltrainer-grammar-srs', JSON.stringify({ conj: { [X]: { box: 1, due: 0 } }, noun: { [X]: { box: 1 } } }));
  }, X);
  await p.reload(); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    try { setAppView('vocab'); openVocabList(); closeOverlay('overlay-vocab'); openCategoryPicker(); closeOverlay('overlay-categories'); openSessionSummary(); closeOverlay('overlay-session');
      setAppView('grammar'); ['conjugate','decline','noun','pronoun'].forEach(n=>showGrammarPanel(n)); openFormPicker('conj'); closeOverlay('overlay-formpicker');
      setAppView('listening'); showListeningPanel('hearquiz'); showListeningPanel('hoertrainer'); } catch (e) { return 'Fehler: ' + e.message; }
    return 'ok';
  });
  await p.waitForTimeout(300);
  console.log('Bedienung:', r, '| Skript ausgeführt:', await p.evaluate(() => window.__x || 0), '| JS-Fehler:', errs.join(' ; ') || 'keine');
  await b.close();
})();
