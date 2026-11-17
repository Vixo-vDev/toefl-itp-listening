"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const L="ABCD";
const store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
const part=n=>n<=30?'A':n<=38?'B':'C';
const PART_NAME={A:'Part A · Short Conversations',B:'Part B · Extended Conversations',C:'Part C · Talks & Lectures'};
const ITEMS={};
let deferredPrompt=null;

async function load(id){
  if(ITEMS[id])return ITEMS[id];
  const r=await fetch(EXAMS[id].file);
  ITEMS[id]=parse(await r.text());
  return ITEMS[id];
}
const answers=id=>store.get('ans:'+id,{});
function tipsFor(it){
  const text=(it.sp.map(s=>s.text).join(' ')+' '+Object.values(it.q).join(' ')).toLowerCase();
  const out=[];
  for(const [re,t,d] of GLOSS){ if(new RegExp(re,'i').test(text)&&!out.find(o=>o.t===t))out.push({t,d}); }
  return out;
}
function tipsHtml(it){
  const t=tipsFor(it);
  if(!t.length)return '';
  return `<div class="tips"><h4>💡 Tips de este audio</h4>${t.map(x=>`<p><b>${esc(x.t)}</b> ${esc(x.d)}</p>`).join('')}</div>`;
}

/* ---------- Audio (mp3 opcional o voz del dispositivo) ---------- */
const player={playing:false,token:0,audio:null};
function stopAudio(){
  player.token++;player.playing=false;
  try{speechSynthesis.cancel()}catch{}
  if(player.audio){player.audio.pause();player.audio=null}
  setPlayUI(false);
}
function setPlayUI(on){const b=$('#play');if(b){b.textContent=on?'■ Detener':(b.dataset.again==='1'?'↻ Repetir':'▶ Reproducir');}}
function voices(){try{return speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang))}catch{return[]}}
function pickVoice(kind){
  const vs=voices();if(!vs.length)return null;
  const f=/female|woman|samantha|zira|victoria|karen|susan|serena|jenny|aria|google us english/i;
  const m=/\bmale\b|david|alex|daniel|mark|fred|guy|james|tom|google uk english male/i;
  const pool=vs.filter(v=>kind==='f'?f.test(v)&&!/\bmale\b/i.test(v.name):m.test(v.name));
  return (pool.find(v=>/en-US/i.test(v.lang))||pool[0]||vs.find(v=>/en-US/i.test(v.lang))||vs[0]);
}
function voiceFor(who){
  const w=who.toLowerCase();
  if(/woman|female|speaker 1|professor|instructor|coach|guide/.test(w)&&!/man$/.test(w))return ['f',1];
  if(/^man|speaker 2|male/.test(w))return ['m',1];
  return ['m',1];
}
async function playItem(id,it,part){
  stopAudio();const tk=++player.token;player.playing=true;setPlayUI(true);
  const rate=+($('#rate')?.value||1);
  const base=`audio/${id}-${it.nums[0]}.mp3`;
  if(it.hasAudio===undefined){try{const r=await fetch(base,{method:'HEAD'});it.hasAudio=r.ok}catch{it.hasAudio=false}}
  if(tk!==player.token)return;
  if(it.hasAudio){
    const a=new Audio(base);a.playbackRate=rate;player.audio=a;
    a.onended=()=>{if(tk===player.token){player.playing=false;$('#play').dataset.again='1';setPlayUI(false)}};
    a.onerror=()=>{it.hasAudio=false;playItem(id,it,part)};
    a.play().catch(()=>{});return;
  }
  if(!('speechSynthesis' in window)){alert('Este dispositivo no tiene voz integrada. Agrega archivos mp3 en /audio.');stopAudio();return}
  const lines=it.sp.map(s=>({text:s.text,k:voiceFor(s.who)[0],pitch:1}));
  if(part==='A'&&it.q[it.nums[0]])lines.push({text:it.q[it.nums[0]],k:'f',pitch:.85});
  let i=0;
  const next=()=>{
    if(tk!==player.token)return;
    if(i>=lines.length){player.playing=false;$('#play').dataset.again='1';setPlayUI(false);return}
    const l=lines[i++],u=new SpeechSynthesisUtterance(l.text);
    const v=pickVoice(l.k);if(v){u.voice=v;u.lang=v.lang}else u.lang='en-US';
    u.rate=rate;u.pitch=l.k==='f'?1.1:.85;if(l.pitch!==1)u.pitch=l.pitch;
    u.onend=()=>setTimeout(next,350);u.onerror=()=>setTimeout(next,50);
    speechSynthesis.speak(u);
  };
  next();
}
try{speechSynthesis.onvoiceschanged=()=>{}}catch{}

/* ---------- Vistas ---------- */
const app=()=>$('#app');
function header(title,back){
  return `<header class="top">${back?`<a class="back" href="${back}" aria-label="Volver">‹</a>`:'<span></span>'}<h1>${esc(title)}</h1><a class="back" href="#/tips" aria-label="Glosario">📖</a></header>`;
}
function viewHome(){
  stopAudio();
  const cards=Object.entries(EXAMS).map(([id,e])=>{
    const n=Object.keys(answers(id)).length;
    return `<a class="card exam" href="#/e/${id}"><div><b>${esc(e.name)}</b><small>50 preguntas · Parts A, B y C</small></div><span class="pill">${n}/50</span></a>`;
  }).join('');
  app().innerHTML=header('TOEFL ITP Listening')+`<main>
    <p class="lead">Practica el Listening Comprehension. Respondes todo sin ver resultados y el puntaje aparece hasta el final.</p>
    ${cards}
    <a class="card" href="#/tips"><div><b>📖 Glosario y tips</b><small>Phrasal verbs, modismos y patrones frecuentes</small></div><span>›</span></a>
    ${deferredPrompt?'<button id="install" class="btn ghost wide">Instalar app en el teléfono</button>':''}
    <p class="note">Funciona sin internet una vez cargada. Audio: voz del dispositivo (o mp3 si los agregas a /audio).</p>
  </main>`;
  $('#install')?.addEventListener('click',async()=>{deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;viewHome()});
}
async function viewMenu(id){
  stopAudio();
  const items=await load(id),ans=answers(id),ex=EXAMS[id];
  let html='';let cur='';
  items.forEach((it,k)=>{
    const p=part(it.nums[0]);
    if(p!==cur){cur=p;html+=`<h3 class="part">${PART_NAME[p]}</h3>`}
    const done=it.nums.filter(n=>ans[n]!=null).length;
    const lbl=it.nums.length>1?`Preguntas ${it.nums[0]}–${it.nums[it.nums.length-1]}`:`Pregunta ${it.nums[0]}`;
    html+=`<a class="row ${done===it.nums.length?'ok':done?'half':''}" href="#/e/${id}/i/${k}"><span>${lbl}</span><em>${done}/${it.nums.length}</em></a>`;
  });
  const total=Object.keys(ans).length;
  app().innerHTML=header(ex.name,'#/')+`<main>
    <div class="progress"><div style="width:${total*2}%"></div></div>
    <p class="note">${total}/50 respondidas</p>
    ${html}
    <button id="finish" class="btn wide">Terminar y ver puntaje</button>
    <button id="reset" class="btn ghost wide">Reiniciar este examen</button>
  </main>`;
  $('#finish').onclick=()=>{
    const miss=50-total;
    if(miss&&!confirm(`Te faltan ${miss} preguntas sin responder. ¿Ver puntaje de todos modos?`))return;
    location.hash=`#/e/${id}/r`;
  };
  $('#reset').onclick=()=>{if(confirm('¿Borrar todas tus respuestas de este examen?')){store.del('ans:'+id);viewMenu(id)}};
}
async function viewItem(id,k){
  stopAudio();
  const items=await load(id),it=items[k];
  if(!it){location.hash=`#/e/${id}`;return}
  const ex=EXAMS[id],ans=answers(id),p=part(it.nums[0]);
  const showQ=store.get('showQ',p!=='A');
  const qs=it.nums.map(n=>{
    const q=it.q[n]||'';
    return `<section class="q" data-n="${n}">
      <h4><span class="num">${n}</span>${showQ?esc(q):'<i>Escucha la pregunta en el audio</i>'}</h4>
      ${ex.o[n-1].map((o,i)=>`<button class="opt ${ans[n]===i?'sel':''}" data-n="${n}" data-i="${i}"><b>${L[i]}</b><span>${esc(o)}</span></button>`).join('')}
    </section>`;
  }).join('');
  const prev=k>0?`#/e/${id}/i/${k-1}`:`#/e/${id}`,nxt=k<items.length-1?`#/e/${id}/i/${k+1}`:`#/e/${id}`;
  app().innerHTML=header(`${ex.name}`,`#/e/${id}`)+`<main>
    <div class="partbar">${PART_NAME[p]} · ${it.nums.length>1?`Q${it.nums[0]}–${it.nums[it.nums.length-1]}`:`Q${it.nums[0]}`}</div>
    <div class="player">
      <button id="play" class="btn big" data-again="0">▶ Reproducir</button>
      <label>Velocidad <select id="rate"><option value=".8">0.8×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option></select></label>
    </div>
    <details class="tipsbox"><summary>Estrategia para ${p==='A'?'Part A':p==='B'?'Part B':'Part C'}</summary><ul>${PART_TIPS[p].map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>
    <label class="toggle"><input type="checkbox" id="showq" ${showQ?'checked':''}> Mostrar texto de la pregunta</label>
    ${qs}
    <nav class="pager"><a class="btn ghost" href="${prev}">‹ ${k>0?'Anterior':'Lista'}</a><a class="btn" href="${nxt}">${k<items.length-1?'Siguiente ›':'Lista'}</a></nav>
  </main>`;
  $('#play').onclick=()=>player.playing?stopAudio():playItem(id,it,p);
  $('#showq').onchange=e=>{store.set('showQ',e.target.checked);viewItem(id,k)};
  window.scrollTo(0,0);
}
async function viewResults(id){
  stopAudio();
  const items=await load(id),ans=answers(id),ex=EXAMS[id];
  const sc={A:[0,30],B:[0,8],C:[0,12]};let ok=0;
  for(let n=1;n<=50;n++){if(ans[n]!=null&&L[ans[n]]===ex.key[n-1]){ok++;sc[part(n)][0]++}}
  const pct=Math.round(ok*2);
  const detail=items.map(it=>{
    const rows=it.nums.map(n=>{
      const mine=ans[n],cor=L.indexOf(ex.key[n-1]);
      const good=mine===cor;
      return `<div class="rv ${good?'good':'bad'}"><b>${n}. ${esc(it.q[n]||'')}</b>
        <div>Tu respuesta: <span>${mine==null?'— sin responder':`${L[mine]}. ${esc(ex.o[n-1][mine])}`}</span></div>
        ${good?'':`<div>Correcta: <strong>${L[cor]}. ${esc(ex.o[n-1][cor])}</strong></div>`}</div>`;
    }).join('');
    const bad=it.nums.some(n=>ans[n]==null||L[ans[n]]!==ex.key[n-1]);
    return `<details class="item" ${bad?'open':''}><summary>${it.nums.length>1?`Preguntas ${it.nums[0]}–${it.nums[it.nums.length-1]}`:`Pregunta ${it.nums[0]}`} ${bad?'❌':'✅'}</summary>
      ${rows}
      <div class="tr"><h4>Transcripción</h4>${it.sp.map(s=>`<p><b>${esc(s.who)}:</b> ${esc(s.text)}</p>`).join('')}</div>
      ${tipsHtml(it)}</details>`;
  }).join('');
  const h=store.get('hist:'+id,[]);h.unshift({d:new Date().toISOString().slice(0,10),s:ok});store.set('hist:'+id,h.slice(0,10));
  app().innerHTML=header('Resultado',`#/e/${id}`)+`<main>
    <div class="score"><div class="big">${ok}<small>/50</small></div><p>${pct}% correcto</p></div>
    <div class="parts"><div><b>${sc.A[0]}/30</b><small>Part A</small></div><div><b>${sc.B[0]}/8</b><small>Part B</small></div><div><b>${sc.C[0]}/12</b><small>Part C</small></div></div>
    <p class="note">Revisa cada audio: transcripción y tips con los modismos que aparecieron.</p>
    ${detail}
    <button id="again" class="btn wide">Practicar de nuevo</button>
  </main>`;
  $('#again').onclick=()=>{store.del('ans:'+id);location.hash=`#/e/${id}`};
}
const GS={q:'',cat:'all',open:null,mode:'list',card:null,flip:false};
const learned=()=>store.get('learned',{});
function speakEn(t){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='en-US';u.rate=.9;const v=voices().find(v=>/en-US/i.test(v.lang));if(v)u.voice=v;speechSynthesis.speak(u)}catch{}}
function gFiltered(){
  const lr=learned(),q=GS.q.trim().toLowerCase();
  return GLOSARIO.filter(g=>{
    if(GS.cat==='todo'&&lr[g.t])return false;
    if(GS.cat==='ok'&&!lr[g.t])return false;
    if(['pv','id','pt','kw'].includes(GS.cat)&&g.c!==GS.cat)return false;
    return !q||(g.t+' '+g.es+' '+g.ex+' '+g.tr).toLowerCase().includes(q);
  });
}
function gCard(g,lr){
  const open=GS.open===g.t,k=g.c==='kw';
  return `<article class="gc ${g.c} ${open?'open':''} ${lr[g.t]?'learned':''}" data-t="${esc(g.t)}">
    <div class="gh"><span class="chip c-${g.c}">${CATS[g.c].i}</span><b>${esc(g.t)}</b><span class="chev">›</span></div>
    <p class="mean">${esc(g.es)}</p>
    <div class="gb">
      <div class="ex"><button class="spk" data-say="${esc(g.ex)}" aria-label="Escuchar">🔊</button><span>${esc(g.ex)}</span></div>
      <small class="tr">${esc(g.tr)}</small>
      ${k?'':''}
      <button class="know" data-know="${esc(g.t)}">${lr[g.t]?'✓ Ya la sé':'Marcar como aprendida'}</button>
    </div></article>`;
}
function gRender(){
  const lr=learned(),list=gFiltered(),done=GLOSARIO.filter(g=>lr[g.t]).length;
  $('#gprog').style.width=(done/GLOSARIO.length*100)+'%';
  $('#gcount').textContent=`${done}/${GLOSARIO.length} aprendidas`;
  $('#glist').innerHTML=list.length?list.map(g=>gCard(g,lr)).join(''):'<p class="note c">Nada encontrado.</p>';
  document.querySelectorAll('.fchip').forEach(b=>b.classList.toggle('on',b.dataset.cat===GS.cat));
}
function gPractice(){
  const lr=learned(),pool=GLOSARIO.filter(g=>g.c!=='kw'&&!lr[g.t]);
  const root=$('#gpractice');
  if(!pool.length){root.innerHTML='<div class="flash"><p>🎉 ¡Dominaste todo el glosario!</p><button class="btn ghost" data-act="close">Cerrar</button></div>';return}
  if(!GS.card||!pool.find(x=>x.t===GS.card.t))GS.card=pool[Math.floor(Math.random()*pool.length)];
  const g=GS.card;
  root.innerHTML=`<div class="flash ${GS.flip?'back':''}" data-act="flip">
    <small>${CATS[g.c].i} ${CATS[g.c].n} · quedan ${pool.length}</small>
    ${GS.flip?`<h2>${esc(g.es)}</h2><p class="fe">${esc(g.ex)}</p><p class="ft">${esc(g.tr)}</p>`:`<h2>${esc(g.t)}</h2><p class="hint">Toca para ver el significado</p>`}
  </div>
  <div class="fbtns"><button class="btn ghost" data-act="again">Repasar</button><button class="btn" data-act="got">La sabía ✓</button></div>
  <button class="btn ghost wide" data-act="close">Salir de práctica</button>`;
}
function viewTips(){
  stopAudio();
  const parts=['A','B','C'].map(p=>`<details class="tipsbox"><summary>${PART_NAME[p]}</summary><ul>${PART_TIPS[p].map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`).join('');
  const chips=[['all','Todo'],['pv','🔧 Phrasal'],['id','💬 Modismos'],['pt','🧩 Patrones'],['kw','🔑 Claves'],['todo','Por aprender'],['ok','Aprendidas']].map(([k,n])=>`<button class="fchip" data-cat="${k}">${n}</button>`).join('');
  app().innerHTML=header('Glosario y tips','#/')+`<main class="gl">
    <div class="gstats"><div><b id="gcount"></b><div class="progress"><div id="gprog"></div></div></div><button class="btn" data-act="practice">🎴 Practicar</button></div>
    <div id="gpractice" hidden></div>
    <div id="gmain">
      <input id="gq" type="search" placeholder="Buscar: give up, bank, never have I…" value="${esc(GS.q)}" autocomplete="off">
      <div class="chips">${chips}</div>
      <div id="glist"></div>
      <h3 class="part">Estrategia por parte</h3>${parts}
    </div></main>`;
  gRender();
}
document.addEventListener('click',e=>{
  if(!$('.gl'))return;
  const chip=e.target.closest('.fchip');if(chip){GS.cat=chip.dataset.cat;gRender();return}
  const spk=e.target.closest('.spk');if(spk){speakEn(spk.dataset.say);return}
  const kn=e.target.closest('.know');if(kn){const l=learned(),t=kn.dataset.know;l[t]?delete l[t]:l[t]=1;store.set('learned',l);gRender();return}
  const act=e.target.closest('[data-act]');
  if(act){
    const a=act.dataset.act,box=$('#gpractice'),main=$('#gmain');
    if(a==='practice'){GS.card=null;GS.flip=false;box.hidden=false;main.hidden=true;gPractice()}
    else if(a==='flip'){GS.flip=!GS.flip;gPractice()}
    else if(a==='again'){GS.card=null;GS.flip=false;gPractice()}
    else if(a==='got'){const l=learned();l[GS.card.t]=1;store.set('learned',l);GS.card=null;GS.flip=false;gPractice()}
    else if(a==='close'){box.hidden=true;main.hidden=false;gRender()}
    return;
  }
  const c=e.target.closest('.gc');
  if(c){const t=c.dataset.t;GS.open=GS.open===t?null:t;document.querySelectorAll('.gc').forEach(x=>x.classList.toggle('open',x.dataset.t===GS.open))}
});
document.addEventListener('input',e=>{if(e.target.id==='gq'){GS.q=e.target.value;gRender()}});

/* ---------- Router ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('.opt');if(!b)return;
  const id=currentExam();const a=answers(id);a[b.dataset.n]=+b.dataset.i;store.set('ans:'+id,a);
  b.parentElement.querySelectorAll('.opt').forEach(x=>x.classList.toggle('sel',x===b));
});
const currentExam=()=>(location.hash.match(/#\/e\/(\w+)/)||[])[1];
async function route(){
  const h=location.hash||'#/';let m;
  try{
    if(m=h.match(/^#\/e\/(\w+)\/i\/(\d+)$/))await viewItem(m[1],+m[2]);
    else if(m=h.match(/^#\/e\/(\w+)\/r$/))await viewResults(m[1]);
    else if(m=h.match(/^#\/e\/(\w+)$/))await viewMenu(m[1]);
    else if(h==='#/tips')viewTips();
    else viewHome();
  }catch(err){app().innerHTML=`<main><p class="note">No se pudo cargar el examen.</p></main>`;console.error(err)}
  if(!h.includes('/i/'))window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;if((location.hash||'#/')==='#/')viewHome()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
route();
