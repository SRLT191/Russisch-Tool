const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
// Sprachausgabe in allen Grammatikwerkzeugen – Werkzeuge und Knöpfe werden aus der App gelesen
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(() => { window.__sp=[]; const fake={speaking:false,pending:false,paused:false,getVoices:()=>[{lang:'ru-RU',name:'RU'}],cancel(){},pause(){},resume(){},addEventListener(){},removeEventListener(){},onvoiceschanged:null,speak(u){window.__sp.push(u.text);}}; Object.defineProperty(window,'speechSynthesis',{value:fake,configurable:true}); window.SpeechSynthesisUtterance=function(t){this.text=t;}; });
await p.goto('file://' + APP_PATH); await p.waitForTimeout(300);
const r = await p.evaluate(async () => { const out=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); setAppView('grammar');
  for (const n of GRAMMAR_PANELS) { GRAMMAR_PANEL_OPENERS[n](); const panel=document.getElementById('overlay-'+n);
    // Modi nacheinander (Knöpfe der Modus-Zeile)
    const modes=[...panel.querySelectorAll('.gt-modes .mode-btn')]; const runs=modes.length?modes:[null];
    for (const m of runs) { if (m) m.click(); await sleep(30);
      const btns=[...panel.querySelectorAll('button[onclick*="speak"], button[onclick*="play"]')].filter(x=>x.getClientRects().length);
      if (!btns.length) { if (!m || !/Liste/.test(m.textContent)) out.push('-- '+n+(m?' / '+m.textContent.trim():'')+': kein Anhören-Knopf'); continue; }
      for (const bt of btns) { if (bt.disabled) { revealCurrentTool(); } __sp.length=0; bt.click(); await sleep(60);
        out.push((__sp.length?'OK ':'XX ')+n+(m?' / '+m.textContent.trim():'')+': '+(__sp[0]||'nichts')); } } }
  return out; });
console.log(r.join('\n'), errs); await b.close(); })();
