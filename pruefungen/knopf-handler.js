const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://' + APP_PATH);
const r=await p.evaluate(()=>{const html=document.documentElement.outerHTML+[...document.scripts].map(s=>s.textContent).join('\n');
 const names=new Set();for(const m of html.matchAll(/on(?:click|change|input|keydown)="([^"]*)"/g)){for(const f of m[1].matchAll(/(?:^|[;\s(!])([A-Za-z_$][\w$]*)\(/g)) names.add(f[1]);}
 for(const m of html.matchAll(/onclick=\\?"([^"\\]*)\\?"/g)){for(const f of m[1].matchAll(/(?:^|[;\s(!])([A-Za-z_$][\w$]*)\(/g)) names.add(f[1]);}
 const skip=new Set(['if','event','return','function']);
 return [...names].filter(n=>!skip.has(n)&&typeof window[n]!=='function'&&!(n in window));});
console.log('fehlende Handler:',r);await b.close();})();
