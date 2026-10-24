const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Gesamtprüfung 25.10.2026: Funde 1–12 (Übersetzungen, Wortgruppen, neue Adjektivtabellen,
// GitHub-Prüfung sparsamer, alter Durchgangszähler, Transliterations-Knopf)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = (f, a) => p.evaluate(f, a);

  await check('1–6 Übersetzungen und Beispielsätze', () => ev(() => {
    const w = ru => allVocabWords().find(x => x.ru === ru); const s = ru => getWordSentence(w(ru)).de;
    const ok = w('дальний').de.includes('entfernt') && w('основной').de[0] === 'Haupt-' && w('бесконечный').de.includes('endlos') && w('небольшой').de[0].startsWith('klein')
      && /entfernter Verwandter/.test(s('дальний')) && /Hauptprodukt/.test(s('основной')) && /endloses Gespräch/.test(s('бесконечный')) && /Sternschnuppenschauer/.test(s('звёздный'))
      && /Herrenanzug/.test(s('мужской')) && /Geschäftsessen/.test(s('деловой')) && /Seitenausgang/.test(s('боковой')) && /Stahlbrücke/.test(s('стальной'));
    return { ok, info: s('звёздный') };
  }));
  await check('7 Wortgruppen: keine stumpfen Fragen, harten Telefone, dünnen Sofas, hellen Jahre', () => ev(() => {
    const bad = []; wgState.tool = 'wordgroup'; wgState.pairs = buildWordgroupPairs();
    for (const t of WG_PHRASE_TYPES) for (const number of ['sg', 'pl']) for (let i = 0; i < 300; i++) {
      Object.assign(wgState, { type: t, number, caseScope: 'all', difficulty: 'all' }); restartWordgroup();
      const de = wgState.current.promptDe;
      if (/stumpf\w* Frage|hart\w* (Telefon|Ticket|Wörterb|Schlüssel)|dünn\w* (Sofa|Schlüssel)|hell\w* (Jahr|Stunde)|bequem\w* Tag|fröhlich\w* Sprache|gütig\w* Antwort|antik\w* Wald/.test(de)) bad.push(de);
    }
    return { ok: bad.length === 0 && wgDeAdjStem('тупой', 'вопрос') === 'dumm' && wgDeAdjStem('удобный', 'день') === 'passend', info: bad.slice(0, 3).join(' | ') };
  }));
  await check('8 elf neue Adjektivtabellen, sechs davon in den Wortgruppen', () => ev(() => {
    const neu = ['следующий', 'небольшой', 'мужской', 'женский', 'иностранный', 'российский', 'центральный', 'южный', 'гражданский', 'медицинский', 'мировой'];
    const fehlt = neu.filter(a => !declensionData[a] || !allVocabWords().some(w => w.ru === a));
    const wg = ['небольшой', 'иностранный', 'центральный', 'южный', 'гражданский', 'медицинский'].filter(a => !WG_ADJ_FIT[a]);
    const t = declensionData['следующий'];
    return { ok: !fehlt.length && !wg.length && t.masc['Gen.'] === 'следующего' && t.neut['Nom.'] === 'следующее' && declensionData['мужской'].plural['Instr.'] === 'мужскими', info: fehlt.concat(wg).join(', ') };
  }));
  await check('9 „nicht gespeichert“ wird nur neu gerechnet, wenn sich der Lernstand geändert hat', () => ev(() => {
    const a = ghLocalHash(); const t0 = performance.now(); for (let i = 0; i < 50; i++) ghLocalHash(); const ms = (performance.now() - t0) / 50;
    lifeVocab('дом', true, 1); const c = ghLocalHash();
    return { ok: ms < 1 && a !== c, info: ms.toFixed(3) + ' ms je Aufruf' };
  }));
  await check('10 Zurücksetzen schreibt keinen Durchgangszähler mehr', () => ev(() => { const r0 = loadLifetime().run; resetProgress(); resetProgress(); return { ok: loadLifetime().run === r0, info: r0 + ' → ' + loadLifetime().run }; }));
  await check('12 Transliterations-Knopf: kein aria-pressed, Zustand in der Beschriftung', () => ev(() => {
    const btn = document.getElementById('transcription-btn'); const l1 = btn.getAttribute('aria-label'); toggleTranscription(); const l2 = btn.getAttribute('aria-label'); toggleTranscription(); toggleTranscription();
    return { ok: !btn.hasAttribute('aria-pressed') && /Aussprache/.test(l1) && /Buchstaben/.test(l2), info: l1 + ' / ' + l2 };
  }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
