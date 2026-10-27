const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// PC-Design: breite Fenster nutzen, Karte tiefer, Tastenhinweise, Logo „Ру“, beschriftete Statusknöpfe, Stufenmarke, Seitenleiste
const { chromium } = require('playwright');
const VORBEREITEN = () => {
  setAppView('vocab'); setMode('flip');
  const c = Object.keys(vocab).find(k => /Zeit & H/.test(k));
  selectedBlocksByCat[c] = new Set([0]); activeMain = c;
  getAllWordsOfCat(c).slice(0, 9).forEach(w => { scores[getKey(w)] = { correct: 3, wrong: 0, box: 3, lastSeen: Date.now() }; });
  buildNav(); updateProgress(); nextWord(); return c;
};
(async () => {
  const b = await chromium.launch();
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message.slice(0, 120)]); } };
  const seite = async (w, h, opt = {}) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h } }, opt)); const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto('file://' + APP_PATH); await p.waitForTimeout(300); await p.evaluate(VORBEREITEN);
    await p.locator('#main-row .tile', { hasText: 'Adjektive' }).first().click().catch(() => {});
    await p.evaluate(() => { const c = Object.keys(vocab).find(k => /Zeit & H/.test(k)); activeMain = c; buildNav(); updateProgress(); nextWord(); });
    await p.waitForTimeout(200); return p;
  };
  const mass = p => p.evaluate(() => {
    const r = id => document.getElementById(id).getBoundingClientRect();
    return { inner: Math.round(r('inner').width), wort: parseFloat(getComputedStyle(document.getElementById('russian-word')).fontSize), karteOben: Math.round(r('word-card').top),
      ueberlauf: document.documentElement.scrollWidth > innerWidth, lbl: document.querySelector('.status-lbl') ? getComputedStyle(document.querySelector('.status-lbl')).display : 'fehlt', h: innerHeight };
  });
  const breit = await seite(2000, 1090, { colorScheme: 'dark' }), mittel = await seite(1280, 800), schmal = await seite(1000, 700);
  const B = await mass(breit), M = await mass(mittel), S = await mass(schmal);
  await check('Breites Fenster: Lernbereich und Wort wachsen mit', () => ({ ok: B.inner >= 800 && B.wort >= 80 && M.inner >= 700 && M.wort >= 70 && S.inner <= 600, info: `2000: ${B.inner}px/${B.wort}px · 1280: ${M.inner}px/${M.wort}px · 1000: ${S.inner}px` }));
  await check('Breites Fenster: Karte rückt nach unten, bleibt im oberen Teil', () => ({ ok: B.karteOben > S.karteOben + 40 && B.karteOben < B.h * 0.4, info: `oben ${B.karteOben} (1000 px: ${S.karteOben}) von ${B.h}` }));
  await check('Kein waagrechter Überlauf (2000/1280/1000)', () => ({ ok: !B.ueberlauf && !M.ueberlauf && !S.ueberlauf, info: [B.ueberlauf, M.ueberlauf, S.ueberlauf].join(' ') }));
  await check('Statusknöpfe ab 1200 px beschriftet, sonst nur Symbol mit Namen', async () => {
    const n = await schmal.evaluate(() => [...document.querySelectorAll('#vocab-status .status-icon')].every(b => b.getAttribute('aria-label')));
    const t = await breit.evaluate(() => [...document.querySelectorAll('.status-lbl')].map(x => x.textContent).join(','));
    return { ok: B.lbl !== 'none' && S.lbl === 'none' && n && t === 'Stufen,Zurücksetzen', info: B.lbl + ' / ' + S.lbl + ' · ' + t };
  });
  await check('Logo zeigt „Ру“ wie das App-Symbol', () => mittel.evaluate(() => { const m = document.querySelector('.hdr-mark'); return { ok: m.textContent === 'Ру' && /Literata/.test(getComputedStyle(m).fontFamily), info: m.textContent + ' · ' + getComputedStyle(m).fontFamily }; }));
  await check('Tastenhinweise: Aufdecken ⏎, Gewusst 1, Nicht gewusst 2, Anhören ␣', () => mittel.evaluate(() => {
    const k = id => { const e = document.querySelector('#' + id + ' .gt-kbd'); return e ? e.textContent : ''; };
    const v = [k('flip-show-btn'), k('flip-known'), k('flip-unknown'), k('speak-btn')];
    const sicht = getComputedStyle(document.querySelector('#flip-show-btn .gt-kbd')).display !== 'none';
    return { ok: v.join(' ') === '⏎ 1 2 ␣' && sicht, info: v.join(' ') + ' · sichtbar ' + sicht };
  }));
  await check('Tasten passen zu den Hinweisen (⏎ deckt auf, 2 = nicht gewusst)', async () => {
    await mittel.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    const vor = await mittel.evaluate(() => currentWord.ru);
    await mittel.keyboard.press('Enter'); await mittel.waitForTimeout(80);
    const auf = await mittel.evaluate(() => document.getElementById('flip-judge').classList.contains('visible'));
    await mittel.keyboard.press('2'); await mittel.waitForTimeout(80);
    const w = await mittel.evaluate(ru => { const e = lifeVocabEntry(allVocabWords().find(x => x.ru === ru)); return e && e.w; }, vor);
    return { ok: auf && w === 1, info: 'aufgedeckt ' + auf + ' · falsch gezählt ' + w };
  });
  await check('Stufenmarke auf der Karte: größer und je Stufe gefärbt', () => mittel.evaluate(() => {
    const el = document.getElementById('card-level'), bd = el.querySelector('.lvl-badge'); if (!bd) return { ok: false, info: 'keine Marke' };
    const cs = getComputedStyle(bd), plain = document.createElement('span'); plain.className = 'lvl-badge'; document.body.appendChild(plain);
    const anders = getComputedStyle(plain).color !== cs.color; plain.remove();
    return { ok: el.dataset.lv === wordLevel(currentWord) && parseFloat(cs.fontSize) >= 11 && anders, info: el.dataset.lv + ' · ' + cs.fontSize + ' · ' + cs.color };
  }));
  await check('Seitenleiste: Standard 260 px, gewählte Blöcke als Marke statt „(1)“', () => mittel.evaluate(() => {
    const w = Math.round(document.getElementById('sidebar').getBoundingClientRect().width);
    const btn = [...document.querySelectorAll('.sub-btn')].find(x => /Zeit & H/.test(x.textContent));
    const name = btn.querySelector('.sub-btn-name').textContent, sel = btn.querySelector('.sub-btn-sel');
    return { ok: w === 260 && !/\(\d+\)/.test(name) && sel && sel.textContent === '1' && /1 von \d+ Blöcken gewählt/.test(btn.title) && /9 von 30 erledigt/.test(btn.title), info: w + 'px · ' + btn.title };
  }));
  await check('Seitenleiste: Fortschrittslinie je Kategorie, Zahl wird nicht abgeschnitten', () => mittel.evaluate(() => {
    const btn = [...document.querySelectorAll('.sub-btn')].find(x => /Zeit & H/.test(x.textContent));
    const c = btn.querySelector('.sub-btn-count');
    return { ok: btn.style.getPropertyValue('--sub-p') === '30%' && c.scrollWidth <= c.clientWidth + 1, info: btn.style.getPropertyValue('--sub-p') + ' · Zahl ' + c.textContent };
  }));
  // Handy unverändert
  const handy = await seite(390, 844, { hasTouch: true, isMobile: true });
  await check('Handy: Wortgröße und Leiste unverändert, keine Tastenhinweise', () => handy.evaluate(() => {
    const f = parseFloat(getComputedStyle(document.getElementById('russian-word')).fontSize);
    const kbd = [...document.querySelectorAll('#flip-row .gt-kbd, #speak-btn .gt-kbd')].every(k => getComputedStyle(k).display === 'none');
    return { ok: f === 34 && kbd && document.documentElement.scrollWidth <= innerWidth, info: f + 'px · Hinweise versteckt ' + kbd };
  }));
  await check('Keine JS-Fehler', () => { const e = [].concat(breit.errs, mittel.errs, schmal.errs, handy.errs); return { ok: !e.length, info: e.slice(0, 2).join(' | ') }; });
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
