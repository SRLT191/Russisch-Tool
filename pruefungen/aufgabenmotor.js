const APP_PATH = require('path').resolve(__dirname, '..', 'index.html');
const TMP = require('os').tmpdir();
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://' + APP_PATH);
const r=await p.evaluate(()=>{
 setAppView('grammar');
 const T=[['Aspekt','openAspect()',ASPECT_DRILL],['Bewegung','openMotion();setMotionMode("pair")',MOTION_DRILL],['Umformen','openTransform()',TRANSFORM_DRILL],
  ['Zahl+Subst','openNumNoun()',NUMNOUN_DRILL],['Kasus Subst','openCaseForm("noun")',cfDrill('noun')],['Kasus Adj','openCaseAdj()',cfDrill('adj')],
  ['Pron umformen','openPronForm()',PRONFORM_DRILL],['Kurzform','openAdjForm()',ADJFORM_DRILL],['Rektion Form','openRektion();setRektionMode("form")',REKTION_DRILL]];
 return T.map(([name,open,c])=>{ try{ eval(open); const st=c.st; const inp=document.getElementById(c.p+'-input'); const o=[];
  const t0=c.task(); inp.value=''; gtCheck(c); o.push(c.task()===t0&&!st.answered?'leer ok':'leer XX');
  const d0=st.done||0; inp.value='qqq'; gtCheck(c); o.push(st.done===d0+1&&!st.lastCorrect?'falsch ok':'falsch XX');
  inp.value='qqq'; gtCheck(c); o.push(c.task()!==t0?'2.Druck ok':'2.Druck XX');
  const t1=c.task(); inp.value=gtAnswers(c,t1)[0]; gtCheck(c); const c1=st.correct; gtCheck(c); o.push(c.task()!==t1&&c1>=1?'richtig ok':'richtig XX');
  const t2=c.task(); gtReveal(c); const d2=st.done; inp.value=inp.value; gtCheck(c); o.push(c.task()!==t2&&st.done===d2?'Lösung ok':'Lösung XX');
  const t3=c.task(); const key=c.srs(t3), id=c.id(t3); gtNext(c); const e=(loadGrammarSrs()[key]||{})[id]; o.push(e?'Überspringen vermerkt':'Überspringen XX');
  if(name==='Rektion Form') setRektionMode('choose');
  return name+': '+o.join(' | ');}catch(err){return name+': FEHLER '+err.message;} });});
console.log(r.join('\n'),errs);await b.close();})();
