const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Hilfe-Schalter nach Neuladen: alle *HintVisible-Einstellungen aus TOOL_SETTINGS auf „aus“, dann jeden Schalter prüfen
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + APP_PATH);
const keys = await p.evaluate(() => TOOL_SETTINGS.map(x => x[0]).filter(k => /HintVisible$/.test(k)));
await p.evaluate(ks => { const d = JSON.parse(localStorage.getItem(TOOL_SETTINGS_KEY) || '{}'); ks.forEach(k => d[k] = false); d.rkMode='form'; localStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(d)); }, keys);
await p.reload(); await p.waitForTimeout(300);
const r = await p.evaluate(() => { setAppView('grammar'); const out = [];
  GRAMMAR_PANELS.forEach(n => { GRAMMAR_PANEL_OPENERS[n](); document.querySelectorAll('#overlay-' + n + ' .gt-toggle').forEach(t => {
    if (!t.getClientRects().length) return; out.push((t.getAttribute('aria-pressed') === 'false' ? 'OK ' : 'XX ') + n + ' ' + t.id + ' ' + t.getAttribute('aria-pressed')); }); });
  return out; });
console.log('Einstellungen:', keys.length, '\n' + r.join('\n')); await b.close(); })();
