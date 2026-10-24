const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://' + APP_PATH);
const tools=process.argv[2]==='g'?[['Geschlecht','openGender()','GENDER_CHOICE']]:[['Kasus','openCaseDrill();setCaseMode("abstract")','CASE_CHOICE'],['Bewegung','openMotion();setMotionMode("quiz")','MOTION_CHOICE'],['Rektion','openRektion();setRektionMode("choose")','RK_CHOICE'],['Geschlecht','openGender()','GENDER_CHOICE']];
for (const [n,open,c] of tools){
 await p.evaluate(o=>{setAppView('grammar');eval(o);document.activeElement.blur();},open);
 const r=await p.evaluate(c=>{const C=eval(c);const o={};const it0=C.item();
   // falsch
   const wrong=[...document.querySelectorAll('#'+C.opts+' .case-opt')].map(b=>b.dataset.k).find(k=>k!==C.right(it0));
   gtChoose(C,wrong); o.falschWartet=C.answered; return o;},c);
 await p.waitForTimeout(1300);
 r.nachPause=await p.evaluate(c=>{const C=eval(c);return C.answered;},c);
 await p.keyboard.press('Enter');
 r.enterWeiter=await p.evaluate(c=>!eval(c).answered,c);
 const it1=await p.evaluate(c=>{const C=eval(c);const it=C.item();gtChoose(C,C.right(it));return JSON.stringify(C.srs(it));},c);
 await p.waitForTimeout(1200);
 r.richtigAuto=await p.evaluate(c=>!eval(c).answered,c);
 await p.keyboard.press('3'); r.taste3=await p.evaluate(c=>eval(c).answered && !!document.querySelector('#'+eval(c).opts+' .correct'),c);
 await p.evaluate(c=>gtChoiceNext(eval(c)),c);
 // Ansichtswechsel nach richtiger Antwort
 await p.evaluate(c=>{const C=eval(c);gtChoose(C,C.right(C.item()));setAppView('vocab');},c);
 await p.waitForTimeout(1200);
 r.wartetNachWechsel=await p.evaluate(c=>eval(c).answered,c);
 await p.evaluate(()=>setAppView('grammar'));
 console.log(n, JSON.stringify(r));
}
console.log(errs);await b.close();})();
