const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Seitenleiste in der Breite verstellbar: Ziehen, Tasten, Doppelklick, Speichern, Grenzen, Schmalansicht
const { chromium } = require('playwright');
// Die App startet auf „Heute“ – nach jedem Laden geht es hier in die Vokabeln.
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(300); await p.evaluate(() => setAppView('vocab'));
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const breite = () => p.evaluate(() => Math.round(document.getElementById('sidebar').getBoundingClientRect().width));
  const griff = async () => { const r = await p.locator('#sidebar-resizer').boundingBox(); return { x: r.x + r.width / 2, y: r.y + 200 }; };

  await check('Standardbreite 200 px', async () => ({ ok: (await breite()) === 200, info: await breite() + ' px' }));
  await check('Ziehen nach rechts verbreitert und wird gespeichert', async () => {
    const g = await griff(); await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x + 120, g.y, { steps: 6 }); await p.mouse.up();
    const w = await breite(); const s = await p.evaluate(() => localStorage.getItem('vokabeltrainer-sidebar-width'));
    return { ok: w >= 315 && w <= 325 && s === String(w), info: w + ' px, gespeichert ' + s };
  });
  await check('Kategorienamen danach nicht mehr abgeschnitten', () => p.evaluate(() => {
    const abg = [...document.querySelectorAll('#cat-nav *')].filter(e => e.offsetParent && e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis');
    return { ok: abg.length === 0, info: abg.slice(0, 3).map(e => e.textContent.trim()).join(', ') };
  }));
  await check('Breite bleibt nach Neuladen', async () => { await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => setAppView('vocab')); const w = await breite(); return { ok: w >= 315 && w <= 325, info: w + ' px' }; });
  await check('nicht breiter als erlaubt (480 px bzw. 45 % des Fensters)', async () => {
    const g = await griff(); await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x + 900, g.y, { steps: 4 }); await p.mouse.up();
    const w = await breite(); return { ok: w === 480, info: w + ' px' };
  });
  await check('nicht schmaler als 160 px', async () => {
    const g = await griff(); await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(5, g.y, { steps: 4 }); await p.mouse.up();
    const w = await breite(); return { ok: w === 160, info: w + ' px' };
  });
  await check('Tastatur: → verbreitert, ← verschmälert, Pos1 = Standard; die Pfeile blättern dabei nicht', async () => {
    await p.evaluate(() => { setAppView('vocab'); });
    const vorher = await p.evaluate(() => currentWord && currentWord.ru);
    await p.focus('#sidebar-resizer'); const a = await breite();
    await p.keyboard.press('ArrowRight'); const b2 = await breite(); await p.keyboard.press('ArrowLeft'); const c = await breite();
    await p.keyboard.press('Home'); const d = await breite();
    const nachher = await p.evaluate(() => currentWord && currentWord.ru);
    return { ok: b2 === a + 16 && c === a && d === 200 && vorher === nachher, info: [a, b2, c, d].join(' → ') + (vorher !== nachher ? ' · Karte gewechselt!' : '') };
  });
  await check('Doppelklick stellt die Standardbreite her und löscht den Eintrag', async () => {
    await p.evaluate(() => setSidebarWidth(300, true)); await p.dblclick('#sidebar-resizer');
    const w = await breite(); const s = await p.evaluate(() => localStorage.getItem('vokabeltrainer-sidebar-width'));
    return { ok: w === 200 && s === null, info: w + ' px, Eintrag ' + s };
  });
  await check('kaputter oder bösartiger Wert wird begrenzt', async () => {
    await p.evaluate(() => localStorage.setItem('vokabeltrainer-sidebar-width', '99999<img src=x>')); await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => setAppView('vocab'));
    const w1 = await breite();
    await p.evaluate(() => localStorage.setItem('vokabeltrainer-sidebar-width', 'abc')); await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => setAppView('vocab'));
    const w2 = await breite(); return { ok: w1 === 480 && w2 === 200, info: w1 + ' / ' + w2 };
  });
  await check('steht in der Sicherung', () => p.evaluate(() => BACKUP_KEYS.includes('vokabeltrainer-sidebar-width')));
  await check('Schmalansicht: kein Griff, Leiste volle Breite, kein Überlauf', async () => {
    await p.evaluate(() => localStorage.setItem('vokabeltrainer-sidebar-width', '400')); await p.setViewportSize({ width: 390, height: 800 }); await p.reload(); await p.waitForTimeout(300); await p.evaluate(() => setAppView('vocab'));
    return p.evaluate(() => {
      const rz = document.getElementById('sidebar-resizer'); const sb = document.getElementById('sidebar').getBoundingClientRect();
      const ok = getComputedStyle(rz).display === 'none' && Math.abs(sb.width - document.documentElement.clientWidth) < 2 && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      return { ok, info: Math.round(sb.width) + ' px' };
    });
  });
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
