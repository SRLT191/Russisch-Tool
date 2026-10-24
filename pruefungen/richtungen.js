const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Getrennter Übungsstand je Richtung
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const mode = process.argv[2] || 'ru';
  // Ausgangsdaten setzen, dann neu laden (ohne Init-Skript, damit Neuladen im Test nichts überschreibt)
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await p.evaluate((m) => { localStorage.clear();
    localStorage.setItem('vokabeltrainer-scores', JSON.stringify({ 'мама': { correct: 1, wrong: 0, box: 1, lastSeen: 1 } }));
    localStorage.setItem('vokabeltrainer-direction', m === 'de' ? 'de-ru' : 'ru-de');
  }, mode);
  await p.reload(); await p.waitForTimeout(400);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  if (mode === 'de') {
    await check('Alter Stand landet bei zuletzt benutzter Richtung DE→RU', () => ev(() => ({ ok: scoresDir === 'de-ru' && !!scores['мама'] && JSON.parse(localStorage.getItem('vokabeltrainer-scores')).мама === undefined, info: localStorage.getItem('vokabeltrainer-scores-de-ru') })));
  } else {
    await check('Alter Stand bleibt bei RU→DE', () => ev(() => ({ ok: scoresDir === 'ru-de' && !!scores['мама'] && !localStorage.getItem('vokabeltrainer-scores-de-ru'), info: scoresDir })));
    await check('DE→RU beginnt leer, мама dort offen', () => ev(() => { setDirection('de-ru'); return { ok: !scores['мама'] && document.getElementById('info-open').textContent === document.getElementById('info-total').textContent, info: document.getElementById('info-open').textContent }; }));
    await check('Antwort in DE→RU zählt nur dort', () => ev(() => { const w = allVocabWords().find(v => v.ru === 'папа'); updateScore(w, true); setDirection('ru-de'); const ru = !!scores['папа'], m = !!scores['мама']; setDirection('de-ru'); return { ok: !ru && m && !!scores['папа'], info: 'RU→DE папа=' + ru + ' мама=' + m }; }));
    await check('Gespeichert unter getrennten Schlüsseln', () => ev(() => { const a = JSON.parse(localStorage.getItem('vokabeltrainer-scores')), d = JSON.parse(localStorage.getItem('vokabeltrainer-scores-de-ru')); return !!a['мама'] && !a['папа'] && !!d['папа'] && !d['мама']; }));
    await check('Wortdetails nennen die Richtung', () => ev(() => { openWordDetail(allVocabWords().find(v => v.ru === 'папа')); const t = document.getElementById('wd-srs').textContent; closeOverlay('overlay-worddetail'); return { ok: /^DE → RU: erledigt/.test(t), info: t }; }));
    await p.reload(); await p.waitForTimeout(300);
    await check('Nach Neuladen: Richtung und Stand passen', () => ev(() => ({ ok: quizDirection === 'de-ru' && scoresDir === 'de-ru' && !!scores['папа'] && !scores['мама'], info: quizDirection })));
    await check('Zurücksetzen leert beide Richtungen', () => ev(() => { resetProgress(); const a = JSON.parse(localStorage.getItem('vokabeltrainer-scores')), d = JSON.parse(localStorage.getItem('vokabeltrainer-scores-de-ru')); setDirection('ru-de'); return { ok: !Object.keys(a).length && !Object.keys(d).length && !Object.keys(scores).length, info: JSON.stringify([a, d]) }; }));
    await check('Gesamtstand gemeinsam für beide Richtungen', () => ev(() => !!loadLifetime().v['папа'] && !!loadLifetime().v['мама']));
    await check('Sicherung enthält DE→RU', () => ev(() => BACKUP_KEYS.includes('vokabeltrainer-scores-de-ru')));
  }
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
