const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Content-Security-Policy: nichts nach außen, App funktioniert trotzdem vollständig
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const csp = []; p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text()) && !/example\.com/.test(m.text())) csp.push(m.text().slice(0, 160)); });
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = f => p.evaluate(f);
  await check('Richtlinie vorhanden', () => ev(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); return { ok: !!m && /default-src 'none'/.test(m.content) && /connect-src 'none'/.test(m.content), info: m && m.content.slice(0, 60) }; }));
  await check('Anfragen nach außen blockiert', () => ev(async () => { let f = 'erlaubt'; try { await fetch('https://example.com'); } catch (e) { f = 'blockiert'; } const img = new Image(); img.src = 'https://example.com/x.png'; await new Promise(r => { img.onerror = r; img.onload = r; setTimeout(r, 800); }); return { ok: f === 'blockiert' && !img.naturalWidth, info: 'fetch ' + f }; }));
  await check('Symbolschrift geladen', () => ev(() => document.fonts.check('16px tabler-icons')));
  await check('Sicherung herunterladen geht', async () => { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), ev(() => exportBackup())]); return !!dl; });
  await check('Alle Ansichten ohne CSP-Verstoß', () => ev(() => { openSettings(); closeOverlay('overlay-settings'); openLevelOverview(); closeOverlay('overlay-levels'); setAppView('grammar'); Object.keys(GRAMMAR_PANEL_OPENERS).forEach(t => GRAMMAR_PANEL_OPENERS[t]()); setAppView('listening'); setAppView('vocab'); return true; }).then(() => new Promise(r => setTimeout(r, 300))).then(() => ({ ok: !csp.length && !errs.length, info: csp.concat(errs).slice(0, 2).join(' | ') })));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
