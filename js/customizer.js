/* Tradéx: Customize panel (theme, fonts, colors), saved to tradex_custom. */
(()=>{
const K='tradex_custom',$=s=>document.querySelector(s);
const D0=()=>({mode:'dark',vars:{},font:'',size:'',round:''});
let E=D0(),on=false;
try{const j=localStorage.getItem(K);if(j)Object.assign(E,JSON.parse(j));else{const o=JSON.parse(localStorage.getItem('tradex_edit')||'null');if(o&&o.vars)E.vars=o.vars}}catch(e){}
const store=()=>{try{localStorage.setItem(K,JSON.stringify(E))}catch(e){}};
if(E.mode!=='light')E.mode='dark';delete E.name;

const FONTS=['Bricolage Grotesque','Inter','Poppins','Space Grotesk','Fredoka','Playfair Display','Lora','Caveat','JetBrains Mono'];
const COLORS=[['--acc','Accent color'],['--bg','Page background'],['--panel','Panels'],['--ink','Text color']];

const sty=document.createElement('style');document.head.appendChild(sty);
function loadFont(n){if(!n||n==='Bricolage Grotesque')return;let l=$('#ed-font');if(!l){l=document.createElement('link');l.id='ed-font';l.rel='stylesheet';document.head.appendChild(l)}
 l.href='https://fonts.googleapis.com/css2?family='+n.replace(/ /g,'+')+':wght@400;600&display=swap'}
function apply(){
 const r=document.documentElement;
 r.setAttribute('data-theme',E.mode);
 let o='';const v=Object.entries(E.vars);
 if(v.length)o+=':root{'+v.map(([k,x])=>`${k}:${x}!important`).join(';')+'}';
 let b='';
 if(E.font){loadFont(E.font);b+=`font-family:"${E.font}",system-ui,sans-serif!important;`}
 if(E.size)b+=`font-size:${E.size}px!important;`;
 if(b)o+='body{'+b+'}';
 if(E.round!==''){const n=+E.round;
  o+=`button,.bar input,.bar select,.fp select,.f input,.f select,.f textarea,.card,.sc,.pgbox,.box,.pc,.mv,dialog{border-radius:${n}px!important}.face,.slot,.pk{border-radius:${Math.max(n-4,0)}px!important}.step button{border-radius:50%!important}`}
 sty.textContent=o;
}
const hex=c=>{c=(c||'').trim();if(/^#[0-9a-f]{6}$/i.test(c))return c;if(/^#[0-9a-f]{3}$/i.test(c))return'#'+[...c.slice(1)].map(x=>x+x).join('');return'#000000'};

// ---------- panel ----------
const pe=$('#edp');
pe.innerHTML=`<h3>Customize <button data-act="close" aria-label="Close">✕</button></h3>
<small>Make it yours. Changes save automatically in this browser.</small>
<h4>Mode</h4><div class="row"><button data-mode="dark">Dark</button><button data-mode="light">Light</button></div>
<h4>Colors</h4>${COLORS.map(([k,l])=>`<label>${l}<input type="color" data-v="${k}"></label>`).join('')}
<h4>Text</h4>
<label>Font<select id="ed-f">${FONTS.map(f=>`<option value="${f==='Bricolage Grotesque'?'':f}">${f==='Bricolage Grotesque'?'Default':f}</option>`).join('')}</select></label>
<div class="sl"><div><span>Text size</span><output id="ed-fs-o"></output></div><input type="range" id="ed-fs" min="12" max="20" step="1"></div>
<h4>Shape</h4>
<div class="sl"><div><span>Roundness</span><output id="ed-rd-o"></output></div><input type="range" id="ed-rd" min="0" max="24" step="1"></div>
<h4>Background image</h4><small>Shows behind the Dashboard.</small>
<div class="row"><button data-act="bgimg">Upload image</button><button data-act="bgclr">Remove image</button></div>
<h4>Reset</h4><button data-act="reset" style="color:#ff8a6b">Reset all</button>`;

function sl(el,u){const p=(el.value-el.min)/(el.max-el.min)*100;el.style.setProperty('--p',p+'%');const o=$('#'+el.id+'-o');if(o)o.textContent=el.value+u}
function fill(){
 const cs=getComputedStyle(document.documentElement);
 pe.querySelectorAll('[data-v]').forEach(i=>i.value=hex(cs.getPropertyValue(i.dataset.v)));
 $('#ed-f').value=E.font;
 $('#ed-fs').value=E.size||parseInt(getComputedStyle(document.body).fontSize)||15;
 $('#ed-rd').value=E.round===''?10:E.round;
 pe.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===E.mode));sl($('#ed-fs'),'px');sl($('#ed-rd'),'px');
}
function tog(v){on=v;document.body.classList.toggle('ed-on',v);const b=$('#edb');if(b)b.setAttribute('aria-expanded',v);if(v)fill()}
function act(a,b){switch(a){
 case'close':tog(false);break;
 case'bgimg':pickImg('dash');break;
 case'bgclr':if(S.img)delete S.img.dash;save();render();break;
 case'reset':if(b.dataset.arm){E=D0();store();apply();try{if(S.img)delete S.img.dash;save();render()}catch(e){}fill();b.textContent='Reset all';delete b.dataset.arm}
  else{b.dataset.arm=1;b.textContent='Click again to confirm';setTimeout(()=>{delete b.dataset.arm;b.textContent='Reset all'},3000)}break}}
pe.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
 if(t.dataset.act)act(t.dataset.act,t);
 else if(t.dataset.mode){E.mode=t.dataset.mode;E.vars={};store();apply();fill()}});
pe.addEventListener('input',e=>{const t=e.target;
 if(t.dataset.v){E.vars[t.dataset.v]=t.value}
 else if(t.id==='ed-f')E.font=t.value;
 else if(t.id==='ed-fs'){E.size=t.value;sl(t,'px')}
 else if(t.id==='ed-rd'){E.round=t.value;sl(t,'px')}
 else return;
 store();apply()});
$('#edb').onclick=()=>tog(!on);
apply();
})();
