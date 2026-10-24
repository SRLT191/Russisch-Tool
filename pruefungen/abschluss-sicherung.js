const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Ein angefangener Stufenabschluss steht in der Sicherung und kommt beim Einlesen zurück
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on('dialog', d => d.accept());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  await p.evaluate(() => { startLevelExam('A1'); for (let i = 0; i < 3; i++) { updateScore(currentWord, true); nextWord(); } });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportBackup())]);
  const f = require('path').join(TMP, 'abschluss-sicherung.json'); await dl.saveAs(f);
  await check('Abschluss steht in der Sicherung', () => !!JSON.parse(fs.readFileSync(f)).data['vokabeltrainer-level-exam']);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await (await p.$('#backup-file')).setInputFiles(f); await p.waitForTimeout(900);
  await check('Nach dem Einlesen geht der Abschluss weiter', () => p.evaluate(() => ({ ok: !!levelExam && levelExam.level === 'A1' && Object.keys(levelExam.first).length === 3, info: levelExam && Object.keys(levelExam.first).length + ' Wörter' })));
  await check('keine JS-Fehler', () => ({ ok: !errs.length, info: errs.join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
