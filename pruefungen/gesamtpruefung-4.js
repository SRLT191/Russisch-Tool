const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Gesamtprüfung 24.10.2026, zweite Runde: Fixes 1–28
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = (f, a) => p.evaluate(f, a);
  // alle Satzbau-Aufgaben eines Typs einsammeln (Antwort → Varianten)
  const sbTasks = (type, tense) => ev(([type, tense]) => {
    const out = {}; wgState.tool = 'sentence'; wgState.type = type; wgState.tense = tense;
    if (!wgState.pairs) wgState.pairs = buildWordgroupPairs();
    for (let i = 0; i < 300; i++) { restartWordgroup(); out[wgState.current.answer] = [wgState.current.altAnswers, wgState.current.promptDe]; }
    return out;
  }, [type, tense]);

  await check('1 мама: Akkusativ Plural = мам (belebt)', () => ev(() => nounDeclensionData['мама'].pl['Akk.'] === 'мам'));
  await check('2 тесть ist männlich, Infotext nennt die Ausnahme', () => ev(() => {
    const g = genderOf('тесть'); return { ok: g && g.g === 'm' && /тесть m/.test(document.getElementById('gender-info-panel').textContent), info: g && g.why };
  }));
  await check('3/21/22 площадь, храм, скучный', () => ev(() => {
    const w = ru => allVocabWords().find(x => x.ru === ru);
    return w('площадь').de.includes('Platz') && w('храм').de[0] === 'Gotteshaus' && w('скучный').tr === 'skutschnyj';
  }));
  await check('4 надо und нужно gelten gegenseitig', async () => {
    const t = await sbTasks('dative', 'present'); const S = s => s.toLowerCase();
    const a = t['Мне нужно работать'], c = t['Тебе надо отдыхать'];
    return { ok: !!a && !!c && a[0].map(S).includes('мне надо работать') && c[0].map(S).includes('тебе нужно отдыхать'), info: Object.keys(t).length + ' Dativ-Sätze' };
  });
  await check('5 Besitz mit есть zählt (nur Präsens)', async () => {
    const t = await sbTasks('possession', 'present'); const v = Object.entries(t);
    return { ok: v.length > 0 && v.every(([ans, [alt]]) => alt.some(x => x === ans.replace(/^(У \S+) /, '$1 есть '))), info: v.length + ' Besitzsätze' };
  });
  await check('6–8 Wortgruppen: keine „niedrigen Studenten“, „fiten“, „Unterrichte“', () => ev(() => {
    const bad = []; wgState.tool = 'wordgroup'; wgState.pairs = buildWordgroupPairs();
    for (const t of WG_PHRASE_TYPES) for (const number of ['sg', 'pl']) for (let i = 0; i < 300; i++) {
      Object.assign(wgState, { type: t, number, caseScope: 'all', difficulty: 'all' }); restartWordgroup();
      const de = wgState.current.promptDe; if (/\bfit|Unterricht|\b(niedrig|hoh)\w* (Student|Arzt|Ärzt|Vater|Väter|Bruder|Brüder|Mutter|Mütter|Schwester|Tochter|Töchter|Mama)/.test(de)) bad.push(de);
    }
    return { ok: bad.length === 0 && WG_DE_NOUNS['урок'][2] === 'Stunde', info: bad.slice(0, 3).join(' | ') };
  }));
  await check('9 узкая юбка heißt überall „enger Rock“', () => ev(() => {
    const s = ['present', 'past', 'future'].map(z => sbOwnerSentence('У неё', 'узкий', 'юбка', 'sg', z, false) + ' ' + sbOwnerSentence('У неё', 'узкий', 'юбка', 'sg', z, true));
    return { ok: s.every(x => /engen Rock/.test(x) && !/schmal/.test(x)), info: s[1] };
  }));
  await check('10–20 korrigierte Beispielsätze', () => ev(() => {
    const txt = JSON.stringify(SENTENCE_OVERRIDES) + JSON.stringify(SENTENCE_PAIRS);
    const alt = ['Die ___ zerstörte mehrere', 'ganze ___ Menschen', 'Heute Morgen ist ___', 'gerade noch geschafft', 'zweite Stockwerk', 'im dritten Stock', 'bei der Tür',
      'Игра и информация', 'Итог и набор', 'Этот спор ___', 'Этот транспорт ___', 'Dieses Haus ist benachbart', 'Лодка начала', 'auf dem Schild gezeigt', 'Kartoffel und', 'Fürsorge um'];
    const rest = alt.filter(x => txt.includes(x));
    const s = ru => getWordSentence(allVocabWords().find(x => x.ru === ru));
    const ok = /Der Tornado/.test(s('торнадо / смерч').de) && /Wind/.test(s('ветер').de) && /Wärme/.test(s('тепло').de) && /kaum/.test(s('едва').de);
    return { ok: ok && rest.length === 0, info: rest.join(', ') };
  }));
  await check('25 toter Code entfernt', () => ev(() => ['sentenceInputMode', 'currentSentenceRandWord', '_wordByRuCache', 'prepositionTokens']
    .every(n => { try { eval(n); return false; } catch (e) { return true; } }) && !('hard' in CAT_ICONS)));
  await check('26 Tippflächen: Kartensymbole und Einzel-Lösung vergrößert', () => ev(() => {
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('');
    return /#speak-btn::after/.test(css) && /\.conj-reveal-one-btn::after/.test(css) && /\.tool-btn, \.mode-btn \{ min-width: 44px; \}/.test(css);
  }));
  await check('27 Dialoge mit Rolle und Titel, keine id doppelt, Titel der Vokabelliste behält sein Symbol', () => ev(() => {
    const ohne = [...document.querySelectorAll('.overlay')].map(o => o.querySelector('.overlay-box') || o).filter(x => x.getAttribute('role') !== 'dialog' || !document.getElementById(x.getAttribute('aria-labelledby') || '-'));
    openVocabList(); const icon = !!document.querySelector('#overlay-vocab .overlay-title i'); closeOverlay('overlay-vocab');
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const doppelt = ids.filter((x, i) => ids.indexOf(x) !== i);
    return { ok: ohne.length === 0 && doppelt.length === 0 && icon, info: (icon ? '' : 'Symbol im Titel der Vokabelliste weg; ') + ohne.map(o => o.id).concat(doppelt.map(x => 'doppelt: ' + x)).join(', ') };
  }));
  await check('28 ⓘ heißt überall „Erklärung anzeigen“', () => ev(() => [...document.querySelectorAll('.conj-info-btn')].every(x => x.getAttribute('aria-label') === 'Erklärung anzeigen')));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
