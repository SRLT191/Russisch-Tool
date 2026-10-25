const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Einstellungen: PC mit Bereichen links (ein Bereich sichtbar), Handy mit aufklappbaren Gruppen
// und Kurzfassung; Farbschema Hell/Dunkel/System, Transliteration, Übungsstand zurücksetzen,
// GitHub-Felder zugeklappt, alle bisherigen Einstellungen genau einmal vorhanden.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  const ev = (f, a) => p.evaluate(f, a);
  const IDS = ['autoplay-toggle', 'cognate-toggle', 'maxlevel-select', 'levelorder-toggle', 'mylevel-select', 'cyrkbd-toggle', 'blocksize-select', 'sessiongoal-select', 'speakrate-select', 'lifedemote-toggle',
    'gh-sync-btn', 'gh-repo', 'gh-token', 'gh-device', 'gh-load-open', 'gh-warn-close', 'backup-file', 'lifetime-reset-btn', 'progress-reset-btn', 'theme-seg', 'translit-seg'];
  await check('jede Einstellung genau einmal und in genau einem Bereich', () => ev(IDS => {
    const fehlt = IDS.filter(id => document.querySelectorAll('#' + id).length !== 1 || !document.getElementById(id).closest('.set-sec'));
    return { ok: !fehlt.length && document.querySelectorAll('#overlay-settings .set-sec').length === 6, info: fehlt.join(', ') };
  }, IDS));
  await check('PC: Leiste links, nur ein Bereich sichtbar, Wechsel per Klick', async () => {
    await ev(() => openSettings());
    const a = await ev(() => [...document.querySelectorAll('.set-sec')].filter(s => s.offsetParent).map(s => s.dataset.sec));
    await p.click('.set-nav-btn[data-sec="speichern"]');
    const c = await ev(() => [...document.querySelectorAll('.set-sec')].filter(s => s.offsetParent).map(s => s.dataset.sec));
    const nav = await ev(() => getComputedStyle(document.querySelector('.set-nav')).display);
    return { ok: a.length === 1 && c.join() === 'speichern' && nav === 'flex', info: a + ' → ' + c };
  });
  await check('PC: gewählter Bereich bleibt nach Neuladen', async () => { await p.reload(); await p.waitForTimeout(300); return ev(() => { openSettings(); return document.querySelector('.set-nav-btn.active').dataset.sec === 'speichern'; }); });
  await check('Farbschema Hell/Dunkel/Wie das System', async () => {
    await ev(() => showSettingsTab('darstellung'));
    await p.click('#theme-seg [data-mode="dark"]'); const d = await ev(() => [document.documentElement.getAttribute('data-theme'), localStorage.getItem('vokabeltrainer-theme')]);
    await p.click('#theme-seg [data-mode="light"]'); const l = await ev(() => document.documentElement.getAttribute('data-theme'));
    await p.click('#theme-seg [data-mode="system"]'); const s = await ev(() => [localStorage.getItem('vokabeltrainer-theme'), document.querySelector('#theme-seg .on').dataset.mode]);
    return { ok: d.join() === 'dark,dark' && l === 'light' && s[0] === null && s[1] === 'system', info: JSON.stringify([d, l, s]) };
  });
  await check('Transliteration: Auswahl und Knopf auf der Karte bleiben gleich', async () => {
    await ev(() => showSettingsTab('aussprache')); await p.click('#translit-seg [data-mode="letters"]');
    const a = await ev(() => [transcriptionMode, document.getElementById('transcription-btn-label').textContent]);
    await ev(() => { closeOverlay('overlay-settings'); toggleTranscription(); openSettings(); });
    const c = await ev(() => document.querySelector('#translit-seg .on').dataset.mode);
    await ev(() => setTranscriptionMode('speech'));
    return { ok: a.join() === 'letters,Buchstaben' && c === 'off', info: a + ' / ' + c };
  });
  await check('Übungsstand zurücksetzen fragt nach', async () => {
    await ev(() => { const w = allVocabWords()[0]; updateScore(w, true); showSettingsTab('zuruecksetzen'); });
    p.once('dialog', d => d.dismiss()); await p.click('#progress-reset-btn'); await p.waitForTimeout(100);
    const n1 = await ev(() => Object.keys(scores).length);
    p.once('dialog', d => d.accept()); await p.click('#progress-reset-btn'); await p.waitForTimeout(100);
    const n2 = await ev(() => Object.keys(scores).length);
    return { ok: n1 > 0 && n2 === 0, info: n1 + ' → ' + n2 };
  });
  await check('GitHub: Felder offen ohne Verbindung, verbunden zugeklappt hinter „Verbindung ändern“', () => ev(() => {
    showSettingsTab('speichern'); const vis = id => !!document.getElementById(id).offsetParent;
    const ohne = vis('gh-fields') && !vis('gh-edit-btn');
    localStorage.setItem('vokabeltrainer-gh-settings', JSON.stringify({ repo: 'ich/lernstand' })); localStorage.setItem('vokabeltrainer-gh-token', 'github_pat_' + 'A'.repeat(40));
    closeOverlay('overlay-settings'); openSettings();
    const zu = !vis('gh-fields') && vis('gh-edit-btn'); ghToggleEdit(); const auf = vis('gh-fields');
    localStorage.removeItem('vokabeltrainer-gh-token'); localStorage.removeItem('vokabeltrainer-gh-settings'); closeOverlay('overlay-settings');
    return { ok: ohne && zu && auf, info: [ohne, zu, auf].join(' ') };
  }));
  await check('„Tastenkürzel“ in der Fußzeile öffnet die Übersicht', async () => { await ev(() => openSettings()); await p.click('.set-foot .lvl-link'); return ev(() => document.getElementById('overlay-shortcuts').classList.contains('open') && !document.getElementById('overlay-settings').classList.contains('open')); });
  await p.close();
  // ── Handy ──
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); m.on('pageerror', e => errs.push(e.message));
  await m.goto('file://' + APP_PATH); await m.waitForTimeout(300);
  await check('Handy: keine Leiste, sechs zugeklappte Gruppen mit Kurzfassung', () => m.evaluate(() => {
    openSettings(); const secs = [...document.querySelectorAll('.set-sec')];
    const ok = getComputedStyle(document.querySelector('.set-nav')).display === 'none' && secs.length === 6 && secs.every(s => !s.querySelector('.set-sec-body').offsetParent)
      && secs.every(s => document.getElementById('set-sum-' + s.dataset.sec).textContent.trim().length > 2) && secs.every(s => s.querySelector('.set-acc').getBoundingClientRect().height >= 44);
    return { ok, info: secs.map(s => document.getElementById('set-sum-' + s.dataset.sec).textContent).join(' | ').slice(0, 160) };
  }));
  await check('Handy: Gruppe auf- und zuklappen, offene Gruppen bleiben nach Neuladen', async () => {
    await m.click('.set-sec[data-sec="aussprache"] .set-acc'); const auf = await m.evaluate(() => !!document.getElementById('autoplay-toggle').offsetParent);
    await m.reload(); await m.waitForTimeout(300);
    const nach = await m.evaluate(() => { openSettings(); return !!document.getElementById('autoplay-toggle').offsetParent && document.querySelector('.set-sec[data-sec="aussprache"] .set-acc').getAttribute('aria-expanded') === 'true'; });
    await m.click('.set-sec[data-sec="aussprache"] .set-acc'); const zu = await m.evaluate(() => !document.getElementById('autoplay-toggle').offsetParent);
    return { ok: auf && nach && zu, info: [auf, nach, zu].join(' ') };
  });
  await check('Handy: Kurzfassung folgt der Einstellung', () => m.evaluate(() => { const s = document.getElementById('blocksize-select'); s.value = '20'; s.dispatchEvent(new Event('change', { bubbles: true })); const t = document.getElementById('set-sum-ueben').textContent; s.value = '10'; s.dispatchEvent(new Event('change', { bubbles: true })); return { ok: /20er/.test(t), info: t }; }));
  for (const w of [320, 360, 390]) await check('Handy ' + w + ' px: alle Gruppen offen, kein Überlauf', async () => {
    await m.setViewportSize({ width: w, height: 800 }); await m.waitForTimeout(200);
    return m.evaluate(() => { openSettings(); document.querySelectorAll('.set-sec').forEach(s => s.classList.add('open'));
      const box = document.querySelector('#overlay-settings .overlay-box'); const body = box.querySelector('.overlay-body');
      const raus = [...box.querySelectorAll('*')].filter(e => e.offsetParent && e.getBoundingClientRect().right > box.getBoundingClientRect().right + 1).map(e => e.id || e.className).slice(0, 3);
      return { ok: document.documentElement.scrollWidth <= document.documentElement.clientWidth && body.scrollWidth <= body.clientWidth + 1 && !raus.length, info: raus.join(', ') }; });
  });
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
