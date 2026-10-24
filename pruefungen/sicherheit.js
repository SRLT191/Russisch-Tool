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
    // GitHub-Speicher, Rückstufung, Gesamtstand mit den Feldern z/dw (seit 25.10.)
    localStorage.setItem('vokabeltrainer-gh-settings', JSON.stringify({ repo: X, device: X, lastSync: X, hash: X, loadOnOpen: X, warnClose: X }));
    localStorage.setItem('vokabeltrainer-gh-token', X);
    localStorage.setItem('vokabeltrainer-life-demote', X);
    localStorage.setItem('vokabeltrainer-lifetime', JSON.stringify({ ver: 3, run: X, v: { 'дом': { c: X, d: X, z: X, dw: X, dd: X }, [X]: { c: 1, d: 2, z: X } }, g: { [X]: { [X]: { c: 1, z: X } } } }));
  }, X);
  await p.reload(); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    try { setAppView('vocab'); openVocabList(); closeOverlay('overlay-vocab'); openCategoryPicker(); closeOverlay('overlay-categories'); openSessionSummary(); closeOverlay('overlay-session');
      setAppView('grammar'); ['conjugate','decline','noun','pronoun'].forEach(n=>showGrammarPanel(n)); openFormPicker('conj'); closeOverlay('overlay-formpicker');
      setAppView('listening'); showListeningPanel('hearquiz'); showListeningPanel('hoertrainer');
      setAppView('vocab'); openSettings(); ghUpdateIndicator(); closeOverlay('overlay-settings'); openVocabList(); document.getElementById('vocab-search').value = 'дом'; renderVocabTable(); closeOverlay('overlay-vocab'); openWordDetail(allVocabWords().find(w => w.ru === 'дом')); closeOverlay('overlay-worddetail');
      if (ghConnected()) return 'Fehler: kaputte GitHub-Einstellungen gelten als verbunden'; } catch (e) { return 'Fehler: ' + e.message; }
    return 'ok';
  });
  await p.waitForTimeout(300);
  const ausgefuehrt = await p.evaluate(() => window.__x || 0);
  console.log('Bedienung:', r, '| Skript ausgeführt:', ausgefuehrt, '| JS-Fehler:', errs.join(' ; ') || 'keine');
  // Fehlschlag als Exit-Code melden: Bedienung kaputt, eingeschleustes Skript lief oder JS-Fehler
  if (r !== 'ok' || ausgefuehrt > 0 || errs.length) process.exitCode = 1;
  await b.close();
})();
