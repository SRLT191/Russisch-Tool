const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// GitHub-Speicher mit nachgestelltem GitHub: Verbinden, Abgleichen, Laden beim Öffnen,
// Konflikt, beschädigte Datei, kein Netz, falscher Token, öffentliches Repo, Warnung, Trennen
const { chromium } = require('playwright');
const TOKEN = 'github_pat_' + 'A'.repeat(40);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // ── nachgestelltes GitHub ──
  const gh = { repos: { 'ich/lernstand': { private: true }, 'ich/offen': { private: false } }, file: null, sha: 0, offline: false, puts: 0, gets: 0, beforePut: null, auth: [] };
  const enc = s => Buffer.from(s, 'utf8').toString('base64');
  const dec = s => Buffer.from(s, 'base64').toString('utf8');
  await ctx.route('https://api.github.com/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/contents\/lernstand\.json)?$/);
    if (gh.offline) return route.abort('internetdisconnected');
    gh.auth.push(req.headers()['authorization'] || '');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, PUT' } });
    if (req.headers()['authorization'] !== 'Bearer ' + TOKEN) return json(401, { message: 'Bad credentials' });
    if (!m || !gh.repos[m[1]]) return json(404, { message: 'Not Found' });
    if (!m[2]) return json(200, { full_name: m[1], private: gh.repos[m[1]].private });
    if (req.method() === 'GET') { gh.gets++; return gh.file === null ? json(404, { message: 'Not Found' }) : json(200, { sha: 's' + gh.sha, encoding: 'base64', content: enc(gh.file) }); }
    if (req.method() === 'PUT') {
      if (gh.beforePut) { const f = gh.beforePut; gh.beforePut = null; f(); }
      const body = JSON.parse(req.postData()); gh.puts++;
      if (gh.file !== null && body.sha !== 's' + gh.sha) return json(409, { message: 'sha mismatch' });
      if (gh.file === null && body.sha) return json(422, { message: 'sha' });
      gh.file = dec(body.content); gh.sha++; gh.lastMessage = body.message; return json(200, { content: { sha: 's' + gh.sha } });
    }
    return json(405, {});
  });
  let navs = 0; p.on('framenavigated', f => { if (f === p.mainFrame()) navs++; });
  await p.goto('file://' + APP_PATH); await p.waitForTimeout(400);
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const ev = (f, a) => p.evaluate(f, a);
  const status = () => ev(() => document.getElementById('gh-status').textContent);
  const verbinde = async (repo, token) => ev(async ([repo, token]) => { openSettings(); document.getElementById('gh-repo').value = repo; document.getElementById('gh-token').value = token; await ghConnect(); return document.getElementById('gh-status').textContent; }, [repo, token]);
  const lerne = (wort, n) => ev(([wort, n]) => { scores[wort] = { correct: n, wrong: 0, box: n, lastSeen: Date.now() }; saveScores(); }, [wort, n]);
  const remote = () => JSON.parse(gh.file);
  const remoteScores = () => JSON.parse(remote().data['vokabeltrainer-scores'] || '{}');

  await check('Schutz: Netz nur zu api.github.com, alles andere gesperrt', () => ev(async () => {
    const c = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    let f = 'erlaubt'; try { await fetch('https://example.com'); } catch (e) { f = 'blockiert'; }
    return { ok: /connect-src https:\/\/api\.github\.com;/.test(c) && f === 'blockiert', info: 'example.com ' + f };
  }));
  await check('ohne Verbindung: keine Anfrage, Knopf „Jetzt abgleichen“ gesperrt', () => ev(() => { openSettings(); return document.getElementById('gh-sync-btn').disabled; }).then(d => ({ ok: d && gh.auth.length === 0, info: gh.auth.length + ' Anfragen' })));
  await check('falscher Repo-Name wird abgewiesen', async () => { const s = await verbinde('kein repo', TOKEN); return { ok: /ungültig/.test(s) && !(await ev(() => ghToken())), info: s }; });
  await check('falscher Token: Fehlermeldung, Token wird nicht behalten', async () => { const s = await verbinde('ich/lernstand', 'github_pat_' + 'B'.repeat(40)); return { ok: /Token ungültig/.test(s) && !(await ev(() => ghToken())), info: s }; });
  await check('öffentliches Repo wird abgelehnt', async () => { const s = await verbinde('ich/offen', TOKEN); return { ok: /öffentlich/.test(s) && !(await ev(() => ghToken())) && gh.puts === 0, info: s }; });
  await check('Verbinden (auch mit kopierter Adresse) legt lernstand.json an', async () => {
    await lerne('дом', 2);
    const s = await verbinde('https://github.com/ich/lernstand', TOKEN);
    const d = remote();
    return { ok: /Gespeichert/.test(s) && d.app === 'russisch-sprachtool' && remoteScores()['дом'].correct === 2 && (await ev(() => ghSettings().repo)) === 'ich/lernstand', info: s };
  });
  await check('Token steht weder in der Datei noch in der Sicherung noch im Formular', async () => {
    const backup = await ev(() => JSON.stringify(ghBuildPayload())); const feld = await ev(() => document.getElementById('gh-token').value);
    return { ok: !gh.file.includes(TOKEN) && !backup.includes(TOKEN) && feld === '' && !(await ev(() => BACKUP_KEYS.some(k => /gh-/.test(k)))) };
  });
  await check('nach dem Abgleich kein Punkt, keine Warnung beim Schließen', () => ev(() => {
    ghUpdateIndicator(); const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e);
    return { ok: !document.querySelector('.tile-tool.gh-dirty') && !e.defaultPrevented };
  }));
  await check('nach dem Lernen: Punkt an „Einstellungen“, Hinweis, Warnung beim Schließen', async () => {
    await lerne('кот', 1);
    return ev(() => { ghUpdateIndicator(); ghIdleStatus(); const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e);
      return { ok: !!document.querySelector('.tile-tool.gh-dirty') && /Nicht gespeichert/.test(document.getElementById('gh-status').textContent) && e.defaultPrevented, info: document.getElementById('gh-status').textContent }; });
  });
  await check('Warnung lässt sich abschalten', () => ev(() => { ghSetOption('warnClose', false); const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); ghSetOption('warnClose', true); return !e.defaultPrevented; }));
  await check('„Jetzt abgleichen“ lädt hoch, Punkt verschwindet', async () => {
    const n = gh.puts; await ev(() => ghSync()); await ev(() => ghUpdateIndicator());
    return { ok: gh.puts === n + 1 && remoteScores()['кот'].correct === 1 && !(await ev(() => !!document.querySelector('.tile-tool.gh-dirty'))) && /Lernstand/.test(gh.lastMessage), info: gh.lastMessage };
  });
  await check('Konflikt: anderes Gerät speichert dazwischen → neu zusammengeführt, nichts verloren', async () => {
    await lerne('лес', 3);
    gh.beforePut = () => { const d = remote(); const s = JSON.parse(d.data['vokabeltrainer-scores']); s['море'] = { correct: 4, wrong: 1, box: 3, lastSeen: 1 }; d.data['vokabeltrainer-scores'] = JSON.stringify(s); gh.file = JSON.stringify(d); gh.sha++; };
    const vorher = navs; await ev(() => ghSync()).catch(() => {}); await p.waitForLoadState('load'); await p.waitForTimeout(500);
    const rs = remoteScores(); const lokal = await ev(() => JSON.parse(localStorage.getItem('vokabeltrainer-scores')));
    return { ok: rs['лес'] && rs['море'] && lokal['море'] && lokal['лес'] && navs === vorher + 1, info: 'Neuladen: ' + (navs - vorher) };
  });
  await check('nach dem Neuladen: Hinweis, kein zweites Neuladen, nichts offen', async () => {
    const n = navs; await p.waitForTimeout(800); await ev(() => openSettings()); const s = await status();
    return { ok: navs === n && /anderen Gerät/.test(s) && !(await ev(() => ghDirty())), info: s };
  });
  await check('Laden beim Öffnen: neuer Stand eines anderen Geräts kommt an', async () => {
    const d = remote(); const s = JSON.parse(d.data['vokabeltrainer-scores']); s['река'] = { correct: 5, wrong: 0, box: 4, lastSeen: 2 }; d.data['vokabeltrainer-scores'] = JSON.stringify(s); gh.file = JSON.stringify(d); gh.sha++;
    const n = navs; await p.reload(); await p.waitForTimeout(1500);
    const lokal = await ev(() => scores['река'] && scores['река'].correct);
    return { ok: lokal === 5 && navs === n + 2 && !(await ev(() => ghDirty())), info: 'Seitenaufrufe ' + (navs - n) };
  });
  await check('Laden beim Öffnen abschaltbar', async () => {
    await ev(() => ghSetOption('loadOnOpen', false)); const g = gh.gets; await p.reload(); await p.waitForTimeout(800);
    const ok = gh.gets === g; await ev(() => ghSetOption('loadOnOpen', true)); return ok;
  });
  await check('beschädigte Datei auf GitHub wird nicht überschrieben', async () => {
    const alt = gh.file = '{kaputt'; const n = gh.puts; await lerne('сад', 1); await ev(() => ghSync()); const s = await status();
    return { ok: gh.file === alt && gh.puts === n && /beschädigt/.test(s) && (await ev(() => ghDirty())), info: s };
  });
  await check('ohne Netz: Meldung, App arbeitet lokal weiter', async () => {
    gh.file = JSON.stringify({ app: 'russisch-sprachtool', version: 1, data: {} }); gh.offline = true;
    await ev(() => ghSync()); const s = await status(); gh.offline = false;
    const weiter = await ev(() => { nextWord(); return !!currentWord; });
    return { ok: /Keine Verbindung/.test(s) && weiter, info: s };
  });
  await check('danach geht das Abgleichen wieder, alter Stand plus neues Wort', async () => { await ev(() => ghSync()); const rs = remoteScores(); return { ok: !!rs['сад'] && !!rs['дом'] && !(await ev(() => ghDirty())) }; });
  await check('Sicherungsdatei „Einlesen“ akzeptiert lernstand.json', () => ev(f => ghValidPayload(JSON.parse(f)) && APP_ID_ACCEPTED.includes(JSON.parse(f).app), gh.file));
  await check('Schmalansicht: Einstellungen ohne Überlauf', async () => {
    await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(400); await ev(() => openSettings());
    return ev(() => { const box = document.querySelector('#overlay-settings .overlay-box'); const f = document.querySelector('.gh-fields').getBoundingClientRect();
      return { ok: document.documentElement.scrollWidth <= document.documentElement.clientWidth && box.scrollWidth <= box.clientWidth + 1 && f.width > 200, info: Math.round(f.width) + ' px, Seite ' + document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth + ', Dialog ' + box.scrollWidth + '/' + box.clientWidth }; });
  });
  await check('Trennen löscht den Token, danach keine Anfragen mehr', async () => {
    await ev(() => ghDisconnect()); const n = gh.auth.length; await p.reload(); await p.waitForTimeout(800);
    return { ok: !(await ev(() => ghToken())) && gh.auth.length === n && !(await ev(() => ghDirty())) };
  });
  await check('nur Anfragen mit Token an GitHub, keine leeren', () => ({ ok: gh.auth.every(a => /^Bearer github_pat_/.test(a)), info: gh.auth.length + ' Anfragen' }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
