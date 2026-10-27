const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Startseite kurz vor Mitternacht in der Woche nach der Zeitumstellung: Tage in Folge, Woche und „gestern“
// zählen Kalendertage (vorher „jetzt minus n × 24 h“ → ein Tag doppelt, einer fehlte)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const R = []; const errs = [];
  const lauf = async (name, zeit, tage) => {
    const ctx = await b.newContext({ timezoneId: 'Europe/Berlin', viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(zeit) });
    await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
    const r = await p.evaluate(tage => {
      const log = {}; tage.forEach(k => { log[k] = [4, 3]; });
      localStorage.setItem('vokabeltrainer-daylog', JSON.stringify(log)); daylogMem = null;
      const s = homeStats(); const keys = s.week.map(d => d.k);
      return { streak: s.streak, keys, heute: dayKey() };
    }, tage);
    await ctx.close(); return r;
  };
  const ok = (n, c, i) => R.push([c ? 'OK ' : 'XX ', n, i || '']);
  // Herbst: Umstellung So 25.10.2026; Di 27.10. 23:50 MEZ
  let r = await lauf('herbst', '2026-10-27T23:50:00+01:00', ['2026-10-27', '2026-10-26', '2026-10-25', '2026-10-23']);
  ok('Herbst 23:50: heute ist der 27.10.', r.heute === '2026-10-27', r.heute);
  ok('Herbst 23:50: Tage in Folge = 3 (24.10. fehlt)', r.streak === 3, String(r.streak));
  ok('Herbst 23:50: Woche = 21.–27.10., jeder Tag einmal', r.keys.join() === '2026-10-21,2026-10-22,2026-10-23,2026-10-24,2026-10-25,2026-10-26,2026-10-27', r.keys.join(' '));
  // Frühjahr: Umstellung So 29.03.2026; Mo 30.03. 00:30 MESZ
  r = await lauf('fruehjahr', '2026-03-30T00:30:00+02:00', ['2026-03-30', '2026-03-29', '2026-03-28', '2026-03-26']);
  ok('Frühjahr 00:30: Tage in Folge = 3', r.streak === 3, String(r.streak));
  ok('Frühjahr 00:30: Woche = 24.–30.03., jeder Tag einmal', r.keys.join() === '2026-03-24,2026-03-25,2026-03-26,2026-03-27,2026-03-28,2026-03-29,2026-03-30', r.keys.join(' '));
  ok('Keine JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
  R.forEach(x => console.log(x[0], x[1], x[2] ? '· ' + x[2] : ''));
  console.log('\n' + R.filter(x => x[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  await b.close();
})();
