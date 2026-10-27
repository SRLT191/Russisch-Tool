const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Stimmenwahl: russische und deutsche Stimme je Gerät, Probe, Rückfall auf die erste passende, Hinweise PC/Android
const { chromium } = require('playwright');
const FAKE = (stimmen) => {
  window.__sp = [];
  const voices = stimmen.map(v => Object.assign({ default: false, localService: true }, v));
  const fake = { speaking: false, pending: false, paused: false, getVoices: () => voices, cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {}, onvoiceschanged: null,
    speak(u) { window.__sp.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name }); if (u.onend) setTimeout(() => u.onend(), 5); } };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};
const VIELE = [{ name: 'Microsoft Irina', lang: 'ru-RU', voiceURI: 'irina' }, { name: 'Microsoft Pavel', lang: 'ru-RU', voiceURI: 'pavel' }, { name: 'Microsoft Hedda', lang: 'de-DE', voiceURI: 'hedda' }, { name: 'Microsoft Stefan', lang: 'de-DE', voiceURI: 'stefan' }, { name: 'English', lang: 'en-US', voiceURI: 'en' }];
(async () => {
  const b = await chromium.launch();
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message.slice(0, 140)]); } };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(FAKE, VIELE);
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await check('Auswahl zeigt alle russischen bzw. deutschen Stimmen, nicht Englisch', () => p.evaluate(() => {
    openSettings(); const o = id => [...document.getElementById(id).options].map(x => x.textContent);
    const ru = o('voice-ru-select'), de = o('voice-de-select');
    return { ok: ru.length === 3 && /Automatisch \(Microsoft Irina\)/.test(ru[0]) && ru.includes('Microsoft Pavel') && de.length === 3 && de.includes('Microsoft Stefan') && !ru.concat(de).some(t => /English/.test(t)) && document.getElementById('voice-hint').hidden, info: ru.join(', ') + ' | ' + de.join(', ') };
  }));
  await check('Ohne Wahl liest die erste russische Stimme', () => p.evaluate(async () => { closeOverlay('overlay-settings'); __sp.length = 0; speak('мама'); return { ok: __sp[0] && __sp[0].voice === 'Microsoft Irina', info: JSON.stringify(__sp[0]) }; }));
  await check('Pavel wählen: Probe läuft sofort, Karte liest danach mit Pavel', () => p.evaluate(async () => {
    openSettings(); __sp.length = 0; const sel = document.getElementById('voice-ru-select'); sel.value = 'pavel'; sel.dispatchEvent(new Event('change'));
    const probe = __sp[0]; __sp.length = 0; speak('мама');
    return { ok: probe && probe.text === 'Привет! Как дела?' && probe.voice === 'Microsoft Pavel' && __sp[0].voice === 'Microsoft Pavel' && localStorage.getItem('vokabeltrainer-voice-ru') === 'pavel', info: JSON.stringify(probe) };
  }));
  await check('Deutsche Stimme Stefan: Probe und Hörtrainer nutzen sie', () => p.evaluate(async () => {
    __sp.length = 0; const sel = document.getElementById('voice-de-select'); sel.value = 'stefan'; sel.dispatchEvent(new Event('change'));
    const probe = __sp[0]; __sp.length = 0; speakHoertrainer('Mutter', 'de-DE', germanVoice, () => {});
    return { ok: probe && probe.voice === 'Microsoft Stefan' && probe.lang === 'de-DE' && __sp[0].voice === 'Microsoft Stefan', info: JSON.stringify(probe) };
  }));
  await check('Knopf „Probe“ liest ohne Wechsel vor', () => p.evaluate(async () => {
    __sp.length = 0; document.querySelector('#voice-ru-row .tool-btn').click(); return { ok: __sp.length === 1 && __sp[0].voice === 'Microsoft Pavel', info: JSON.stringify(__sp[0]) };
  }));
  await check('Wahl bleibt nach Neuladen, Zusammenfassung nennt die Stimme', async () => {
    await p.reload(); await p.waitForTimeout(300);
    return p.evaluate(() => { openSettings(); const v = document.getElementById('voice-ru-select').value, sum = document.getElementById('set-sum-aussprache').textContent; closeOverlay('overlay-settings'); __sp.length = 0; speak('да');
      return { ok: v === 'pavel' && /Microsoft Pavel/.test(sum) && __sp[0].voice === 'Microsoft Pavel', info: v + ' · ' + sum }; });
  });
  await check('„Automatisch“ löscht die Wahl', () => p.evaluate(() => {
    openSettings(); const sel = document.getElementById('voice-ru-select'); sel.value = ''; sel.dispatchEvent(new Event('change')); closeOverlay('overlay-settings');
    __sp.length = 0; speak('да'); return { ok: localStorage.getItem('vokabeltrainer-voice-ru') === null && __sp[0].voice === 'Microsoft Irina', info: __sp[0].voice };
  }));
  await check('Stimmenwahl steht in der Sicherung', () => p.evaluate(() => BACKUP_KEYS.includes('vokabeltrainer-voice-ru') && BACKUP_KEYS.includes('vokabeltrainer-voice-de')));
  // Gerät, auf dem die gewählte Stimme fehlt (z. B. Sicherung vom PC am Handy eingelesen)
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.addInitScript(FAKE, [{ name: 'Microsoft Irina', lang: 'ru-RU', voiceURI: 'irina' }, { name: 'Microsoft Hedda', lang: 'de-DE', voiceURI: 'hedda' }]);
  await p2.goto('file://' + APP_PATH); await p2.evaluate(() => { localStorage.setItem('vokabeltrainer-voice-ru', 'pavel'); localStorage.setItem('vokabeltrainer-voice-ru', '<img src=x onerror=window.__x=1>'); }); await p2.reload(); await p2.waitForTimeout(300);
  await check('Gewählte Stimme fehlt: Rückfall auf die erste, Hinweis für Windows, kein Schadcode', () => p2.evaluate(() => {
    openSettings(); __sp.length = 0; speak('да'); const h = document.getElementById('voice-hint'), sel = document.getElementById('voice-ru-select');
    return { ok: __sp[0].voice === 'Microsoft Irina' && !h.hidden && /Windows/.test(h.textContent) && sel.disabled && !window.__x, info: h.textContent.slice(0, 60) };
  }));
  // Android: eine Stimme je Sprache
  const p3 = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Vivaldi/7.0' })).newPage(); const e3 = []; p3.on('pageerror', e => e3.push(e.message));
  await p3.addInitScript(FAKE, [{ name: 'Russisch Russland', lang: 'ru_RU', voiceURI: 'ru' }, { name: 'Deutsch Deutschland', lang: 'de_DE', voiceURI: 'de' }]);
  await p3.goto('file://' + APP_PATH); await p3.waitForTimeout(300);
  await check('Android: Hinweis auf die Android-Einstellungen, Stimme mit „ru_RU“ wird erkannt', () => p3.evaluate(() => {
    openSettings(); showSettingsTab('aussprache'); const h = document.getElementById('voice-hint'); __sp.length = 0; speak('да');
    return { ok: !h.hidden && /Android-Einstellungen/.test(h.textContent) && __sp[0].voice === 'Russisch Russland' && document.documentElement.scrollWidth <= innerWidth, info: h.textContent.slice(0, 50) + ' · ' + __sp[0].voice };
  }));
  // ohne Sprachausgabe
  const p4 = await (await b.newContext()).newPage(); const e4 = []; p4.on('pageerror', e => e4.push(e.message));
  await p4.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
  await p4.goto('file://' + APP_PATH); await p4.waitForTimeout(300);
  await check('Ohne Sprachausgabe: Stimmenzeilen ausgeblendet, keine Fehler', () => p4.evaluate(() => { openSettings(); return { ok: document.getElementById('voice-ru-row').style.display === 'none' && document.getElementById('voice-de-row').style.display === 'none', info: '' }; }));
  await check('Keine JS-Fehler', () => { const e = errs.concat(e2, e3, e4); return { ok: !e.length, info: e.slice(0, 2).join(' | ') }; });
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
