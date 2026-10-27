const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Aufdecken-Modus der Vokabeln: Taste 3 = Rückgängig (auch nach „Alles gelernt!“), Enter bei „Alles gelernt!“ = Fortschritt zurücksetzen
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = await p.evaluate(() => {
    const R = []; const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
    const key = k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    const shown = id => { const el = document.getElementById(id); return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; };
    setAppView('vocab');
    activeMain = 'multi'; selectedCats = new Set(['Interjektionen']);
    setMode('flip');
    const pool = getPool();
    pool.slice(1).forEach(w => { if (!hasCorrectAnswer(w)) updateScore(w, true); });
    const letztes = pool[0];
    nextWord();
    ok('nur noch ein offenes Wort auf der Karte', currentWord && currentWord.ru === letztes.ru, currentWord && currentWord.ru);
    key('Enter'); key('1');
    ok('nach dem letzten „Gewusst“: Alles gelernt! mit Rückgängig- und Zurücksetzen-Knopf', caughtUpShown() && shown('caught-up-undo') && shown('caught-up-reset'));
    ok('Rückgängig-Knöpfe zeigen die Taste 3', /3/.test(document.querySelector('#caught-up-undo .gt-kbd').textContent) && /3/.test(document.querySelector('#flip-undo-btn .gt-kbd').textContent));
    key('3');
    ok('Taste 3 holt das Wort zurück, unaufgedeckt und wieder offen', !caughtUpShown() && currentWord.ru === letztes.ru && !hasCorrectAnswer(letztes)
      && shown('flip-show-btn') && !answered);
    key('3');
    ok('zweites 3 ohne Bewertung ändert nichts', !caughtUpShown() && currentWord.ru === letztes.ru);
    key('Enter'); key('2');
    ok('Nicht gewusst: Wort bleibt offen, kein „Alles gelernt!“', !caughtUpShown() && !hasCorrectAnswer(letztes));
    key('3');
    ok('Taste 3 nimmt auch „Nicht gewusst“ zurück', currentWord.ru === letztes.ru && !answered && shown('flip-show-btn'));
    key('Enter'); key('1');
    ok('wieder alles gelernt', caughtUpShown());
    key('Enter');
    const offen = getPool().filter(w => !hasCorrectAnswer(w)).length;
    ok('Enter setzt den Fortschritt zurück: Karte wieder da, alle Wörter offen', !caughtUpShown() && !!currentWord && offen === getPool().length, offen + ' von ' + getPool().length);
    key('3');
    ok('nach dem Zurücksetzen gibt es nichts zurückzunehmen', getPool().filter(w => !hasCorrectAnswer(w)).length === getPool().length && !answered);
    // andere Modi: Enter bei „Alles gelernt!“ setzt nicht zurück
    setMode('free'); getPool().forEach(w => { if (!hasCorrectAnswer(w)) updateScore(w, true); }); nextWord();
    key('Enter');
    ok('im Eingabe-Modus setzt Enter bei „Alles gelernt!“ nicht zurück', caughtUpShown() && !shown('caught-up-undo'));
    ok('Tastenkürzel-Übersicht nennt 3 = Rückgängig und Enter = Neu anfangen',
      /Rückgängig/.test(document.getElementById('set-sec-kuerzel').textContent) && /Neu anfangen/.test(document.getElementById('set-sec-kuerzel').textContent));
    return R;
  });
  R.push([errs.length ? 'XX ' : 'OK ', 'Keine JS-Fehler', errs.slice(0, 2).join(' | ')]);
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
