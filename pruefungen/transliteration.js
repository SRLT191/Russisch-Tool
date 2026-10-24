const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Transliteration: Schalter Aussprache → Buchstaben → aus, Speichern, alte Stände, beide Umschriften
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = (f, a) => p.evaluate(f, a);
  const zustand = () => ev(() => ({ m: transcriptionMode, label: document.getElementById('transcription-btn-label').textContent, txt: document.getElementById('transcription').textContent }));

  await check('Start: nach der Aussprache', async () => { const z = await zustand(); return { ok: z.m === 'speech' && z.label === 'Aussprache', info: z.label }; });
  await check('Klicks: Aussprache → Buchstaben → aus → Aussprache', async () => {
    await ev(() => { setAppView('vocab'); quizDirection = 'ru-de'; currentWord = allVocabWords().find(w => w.ru === 'сегодня'); renderTranscription(); });
    const z = [await zustand()];
    for (let i = 0; i < 3; i++) { await p.click('#transcription-btn'); z.push(await zustand()); }
    const ok = z[0].txt === '[ sewodnja ]' && z[1].m === 'letters' && z[1].txt === '[ segodnja ]' && z[2].m === 'off' && z[2].txt === '' && z[2].label === 'Transliteration aus' && z[3].m === 'speech';
    return { ok, info: z.map(x => x.label + ' ' + x.txt).join(' → ') };
  });
  await check('Einstellung bleibt nach Neuladen', async () => {
    await p.click('#transcription-btn'); await p.reload(); await p.waitForTimeout(300); const z = await zustand();
    return { ok: z.m === 'letters' && z.label === 'Buchstaben', info: z.label };
  });
  await check('alter Stand „aus“ wird übernommen', async () => {
    await ev(() => { const k = Object.keys(localStorage).find(k => /selection/i.test(k)) || 'vokabeltrainer-selection'; const d = JSON.parse(localStorage.getItem(k) || '{}'); delete d.transcriptionMode; d.showTranscription = false; localStorage.setItem(k, JSON.stringify(d)); });
    await p.reload(); await p.waitForTimeout(300); const z = await zustand(); return { ok: z.m === 'off', info: z.m };
  });
  await check('Buchstaben: gespeicherte Umschrift = Regel für jedes Wort', () => ev(() => {
    const ab = allVocabWords().filter(w => w.tr !== trLetters(w.ru)); return { ok: ab.length === 0, info: ab.length + ' Abweichungen: ' + ab.slice(0, 5).map(w => w.ru + ' ' + w.tr + '≠' + trLetters(w.ru)).join(', ') };
  }));
  await check('Aussprache: Beispiele', () => ev(() => {
    const soll = { 'хлеб': 'chlep', 'вокзал': 'wogsal', 'всё': 'fsjo', 'здравствуйте': 'sdrastwujte', 'солнце': 'sonze', 'учиться': 'utschiza', 'что': 'schto', 'нового': 'nowowo', 'много': 'mnogo', 'лёгкий': 'ljochkij', 'счастье': "schtschast'je", 'праздник': 'prasnik', 'гриб': 'grip', 'тридцать': "trizat'" };
    const ab = Object.entries(soll).filter(([r, t]) => trSpeech(r) !== t); return { ok: ab.length === 0, info: ab.map(([r, t]) => r + ' ' + trSpeech(r) + '≠' + t).join(', ') };
  }));
  await check('Vokabelliste zeigt die gewählte Art, Suche findet beide', () => ev(() => {
    transcriptionMode = 'letters'; openVocabList(); const inp = document.querySelector('#overlay-vocab input[type=search], #overlay-vocab input');
    const finde = q => { inp.value = q; inp.dispatchEvent(new Event('input')); return document.querySelector('#overlay-vocab').textContent; };
    const a = finde('segodnja'), c = finde('sewodnja'); closeOverlay('overlay-vocab'); transcriptionMode = 'speech';
    return { ok: a.includes('[ segodnja ]') && c.includes('сегодня'), info: '' };
  }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
