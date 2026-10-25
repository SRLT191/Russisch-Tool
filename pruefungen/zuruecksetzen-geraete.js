const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
// Zurücksetzen (+) und „Gesamtstand löschen“ über Geräte hinweg: der alte Stand darf weder aus
// Tool-Save (GitHub, nachgestellt) noch von einem zweiten Gerät noch aus einer alten Sicherung
// zurückkommen; was danach geübt wurde, bleibt.
const { chromium } = require('playwright');
const TOKEN = 'github_pat_' + 'A'.repeat(40);
(async () => {
  const b = await chromium.launch();
  const gh = { file: null, sha: 0, puts: 0 };
  const enc = s => Buffer.from(s, 'utf8').toString('base64'), dec = s => Buffer.from(s, 'base64').toString('utf8');
  const errs = [];
  const geraet = async name => {
    const ctx = await b.newContext();
    await ctx.route('https://api.github.com/**', async route => {
      const req = route.request(); const url = new URL(req.url());
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, PUT' } });
      if (url.pathname === '/repos/ich/lernstand') return json(200, { private: true });
      if (req.method() === 'GET') return gh.file === null ? json(404, {}) : json(200, { sha: 's' + gh.sha, encoding: 'base64', content: enc(gh.file) });
      const body = JSON.parse(req.postData()); gh.puts++;
      if (gh.file !== null && body.sha !== 's' + gh.sha) return json(409, {});
      gh.file = dec(body.content); gh.sha++; return json(200, {});
    });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('dialog', d => d.accept());
    await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
    await p.evaluate(async T => { localStorage.setItem('vokabeltrainer-gh-settings', JSON.stringify({ repo: 'ich/lernstand', device: 'x' })); localStorage.setItem('vokabeltrainer-gh-token', T); }, TOKEN);
    return p;
  };
  const A = await geraet('A'), B = await geraet('B');
  const R = []; const check = async (n, f) => { try { const r = await f(); const ok = typeof r === 'object' ? r.ok : r; R.push([ok ? 'OK ' : 'XX ', n, r && r.info || '']); } catch (e) { R.push(['XX ', n, e.message]); } };
  const lerne = (p, ru) => p.evaluate(ru => { const w = allVocabWords().find(x => x.ru === ru); updateScore(w, true); progressMark('gender', ru, true); }, ru);
  const sync = p => p.evaluate(() => ghSync()).then(() => p.waitForLoadState('load')).then(() => p.waitForTimeout(700));
  const stand = p => p.evaluate(() => ({ s: Object.keys(JSON.parse(localStorage.getItem('vokabeltrainer-scores') || '{}')), g: Object.keys((JSON.parse(localStorage.getItem('vokabeltrainer-grammar-srs') || '{}').gender) || {}), l: Object.keys((JSON.parse(localStorage.getItem('vokabeltrainer-lifetime') || '{}').v) || {}) }));
  const remote = () => { const d = JSON.parse(gh.file).data; return { s: Object.keys(JSON.parse(d['vokabeltrainer-scores'] || '{}')), l: Object.keys(JSON.parse(d['vokabeltrainer-lifetime'] || '{}').v || {}) }; };
  const warte = ms => new Promise(r => setTimeout(r, ms));

  await check('Ausgangslage: A und B haben gelernt, beide abgeglichen', async () => {
    await lerne(A, 'дом'); await lerne(A, 'кот'); await sync(A); await lerne(B, 'лес'); await sync(B); await sync(A);
    const r = remote(); return { ok: ['дом', 'кот', 'лес'].every(w => r.s.includes(w) && r.l.includes(w)), info: r.s.join(',') };
  });
  // alte Sicherung von A aufheben (vor dem Zurücksetzen)
  const alteSicherung = await A.evaluate(() => JSON.stringify(ghBuildPayload()));
  await warte(20);
  await check('A setzt zurück (+): Tool-Save wird sofort bereinigt', async () => {
    const n = gh.puts; await A.evaluate(() => resetProgress()); await A.waitForTimeout(800);
    const r = JSON.parse(JSON.parse(gh.file).data['vokabeltrainer-scores'] || '{}'); const g = JSON.parse(JSON.parse(gh.file).data['vokabeltrainer-grammar-srs'] || '{}');
    return { ok: gh.puts > n && Object.keys(r).length === 0 && !Object.keys(g.gender || {}).length && remote().l.length === 3, info: 'Uploads ' + (gh.puts - n) + ', Übungsstand auf GitHub ' + Object.keys(r).length };
  });
  await check('B (alter Stand) öffnet: Übungsstand leer, nichts kommt zurück, keine Schleife', async () => {
    await warte(20); await lerne(B, 'море');   // nach dem Zurücksetzen auf A geübt → bleibt
    let navs = 0; B.on('framenavigated', f => { if (f === B.mainFrame()) navs++; });
    await B.reload(); await B.waitForTimeout(1500); const s = await stand(B);
    return { ok: s.s.length === 1 && s.s[0] === 'море' && s.g.join() === 'море' && navs === 1, info: JSON.stringify(s.s) + ' Seitenaufrufe ' + navs };
  });
  await check('B gleicht ab, danach auf A: nur das neu Geübte von B', async () => { await sync(B); await sync(A); await A.reload(); await A.waitForTimeout(1200); const s = await stand(A); return { ok: s.s.join() === 'море', info: s.s.join() }; });
  await check('Gesamtstand bleibt beim Zurücksetzen erhalten', async () => { const s = await stand(A); return { ok: ['дом', 'кот', 'лес', 'море'].every(w => s.l.includes(w)), info: s.l.join(',') }; });
  await check('A löscht den Gesamtstand: Tool-Save sofort bereinigt', async () => {
    await warte(20); await A.evaluate(() => resetLifetime()); await A.waitForTimeout(800);
    return { ok: remote().l.length === 0, info: remote().l.join(',') };
  });
  await check('B: alter Gesamtstand verschwindet, danach Geübtes bleibt', async () => {
    await warte(20); await lerne(B, 'река'); await B.reload(); await B.waitForTimeout(1500); const s = await stand(B);
    return { ok: s.l.join() === 'река', info: s.l.join(',') };
  });
  await check('alte Sicherung einlesen bringt nichts Gelöschtes zurück', async () => {
    await sync(B); await A.reload(); await A.waitForTimeout(1200);
    const r = await A.evaluate(raw => { mergeAllFromBackup(JSON.parse(raw).data); return { s: Object.keys(JSON.parse(localStorage.getItem('vokabeltrainer-scores') || '{}')), l: Object.keys(JSON.parse(localStorage.getItem('vokabeltrainer-lifetime') || '{}').v || {}) }; }, alteSicherung);
    return { ok: !r.s.some(w => ['дом', 'кот', 'лес'].includes(w)) && !r.l.some(w => ['дом', 'кот', 'лес', 'море'].includes(w)) && r.l.includes('река'), info: JSON.stringify(r) };
  });
  await check('Einlesen der alten Sicherung weist auf das Zurücksetzen hin', async () => {
    const f = require('path').join(require('os').tmpdir(), 'alte-sicherung-test.json'); require('fs').writeFileSync(f, alteSicherung);
    let msg = ''; const h = d => { msg = d.message(); }; A.on('dialog', h);
    await A.evaluate(() => openSettings()); await (await A.$('#backup-file')).setInputFiles(f); await A.waitForTimeout(1500); A.off('dialog', h);
    return { ok: /Hinweis: Seit dieser Sicherung wurde Vokabeln zurückgesetzt .*Gesamtstand gelöscht/.test(msg), info: msg.split('\n').pop().slice(0, 120) };
  });
  await check('Zeitpunkte stehen in der Sicherung, Abgleich bricht nach dem Zurücksetzen nicht ab', async () => {
    const r = await A.evaluate(() => { const m = parseResetMarks(localStorage.getItem(RESET_MARKS_KEY)); return { ok: BACKUP_KEYS.includes(RESET_MARKS_KEY) && m.v > 0 && m.g > 0 && m.life > 0, st: '' }; });
    await A.evaluate(() => ghSync()); const st = await A.evaluate(() => document.getElementById('gh-status').textContent);
    return { ok: r.ok && !/Abgebrochen/.test(st), info: st };
  });
  await check('kaputte Zeitpunkte werden ignoriert', () => A.evaluate(() => { const m = parseResetMarks('{"v":"<b>","g":-5,"life":1e999}'); return m.v === 0 && m.g === 0 && m.life === 0; }));
  await check('keine JS-Fehler', () => ({ ok: errs.length === 0, info: errs.slice(0, 3).join(' | ') }));
  R.forEach(r => console.log(r[0], r[1], r[2] ? '· ' + r[2] : ''));
  console.log('\n' + R.filter(r => r[0] === 'OK ').length + ' von ' + R.length + ' bestanden');
  if (R.some(r => r[0] !== 'OK ')) process.exitCode = 1;
  await b.close();
})();
