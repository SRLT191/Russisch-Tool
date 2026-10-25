const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Gesamtprüfung-Fixes 10–13
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
  await p.evaluate(() => localStorage.setItem('vokabeltrainer-strict-mode', '0')); await p.reload(); await p.waitForTimeout(300);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  await check('10 память = Speicher, Gedächtnis (beide angenommen)', () => ev(async () => { const w = allVocabWords().find(x => x.ru === 'память'); setMode('free'); setDirection('ru-de'); renderCard(w); document.getElementById('answer-input').value = 'Gedächtnis'; await checkAnswer(); return { ok: w.de.join('/') === 'Speicher/Gedächtnis' && srsDone(scores['память']), info: w.de.join('/') }; }));
  await check('11 восхищаться = woschischtschat\'sja', () => ev(() => allVocabWords().find(x => x.ru === 'восхищаться').tr === "woschischtschat'sja"));
  await check('12 Reste entfernt, alter Schlüssel aufgeräumt', () => ev(() => typeof formatRelativeTime === 'undefined' && !BACKUP_KEYS.includes('vokabeltrainer-strict-mode') && localStorage.getItem('vokabeltrainer-strict-mode') === null));
  await check('12 Symbolschrift: jedes benutzte Symbol hat ein Zeichen', () => ev(async () => { await document.fonts.ready; const used = new Set([...document.querySelectorAll('[class*="ti-"]')].flatMap(e => [...e.classList].filter(c => c.startsWith('ti-')))); const leer = [...used].filter(c => { const e = document.createElement('i'); e.className = 'ti ' + c; document.body.appendChild(e); const ct = getComputedStyle(e, '::before').content; e.remove(); return !ct || ct === 'none' || ct === 'normal'; }); return { ok: leer.length === 0, info: used.size + ' Symbole im Startbild, ohne Regel: ' + leer.join(',') }; }));
  await check('13 Tastenkürzel nennen den Einstufungstest', () => ev(() => /Einstufungstest/.test(document.getElementById('set-sec-kuerzel').textContent)));
  await check('13 Sicherungshinweis zählt beide Richtungen', () => ev(() => { updateScore(allVocabWords()[3], true); setDirection('de-ru'); updateScore(allVocabWords()[7], true); const o = URL.createObjectURL; URL.createObjectURL = () => 'blob:x'; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = () => {}; exportBackup(); URL.createObjectURL = o; HTMLAnchorElement.prototype.click = c; setDirection('ru-de'); const t = document.getElementById('backup-info').textContent; return { ok: /, 3 Wörter mit Lernstand \(beide Richtungen\)/.test(t), info: t }; }));
  await check('13 Bildschirmleser: ✓ x/5 und Haken beschriftet', () => ev(() => { lifeVocab('мама', true, 1); openVocabList(); document.getElementById('vocab-search').value = 'мама'; renderVocabTable(); const e = document.querySelector('#vocab-table-body .ever-ok'); const a = e && e.getAttribute('role') === 'img' && /Wiederholt: /.test(e.getAttribute('aria-label')); closeOverlay('overlay-vocab'); openLevelOverview(); const h = [...document.querySelectorAll('#lvl-plan .lvl-box, #lvl-plan .lvl-ok')].every(x => x.getAttribute('role') === 'img' && x.getAttribute('aria-label') || x.closest('.lvl-plan-status')); closeOverlay('overlay-levels'); return { ok: a && h, info: e && e.getAttribute('aria-label') }; }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
