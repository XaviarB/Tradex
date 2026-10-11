/* Tradéx: iOS device preview (renders the app in an iframe). */
(()=>{
if(window.name==='ios-preview'){
 if(!window.claude){let n=0;const w={};
  addEventListener('message',e=>{const d=e.data;if(d&&d.t==='io-sample-r'&&w[d.id]){d.ok?w[d.id][0](d.v):w[d.id][1](new Error('sample failed'));delete w[d.id]}});
  const sm=()=>Promise.reject(new Error('use sm.json'));
  sm.json=(p,o)=>new Promise((ok,no)=>{const id=++n;w[id]=[ok,no];parent.postMessage({t:'io-sample',id:id,p:p,o:{modelTier:o&&o.modelTier}},'*')});
  window.claude={use:async k=>k==='sample'?sm:k==='user'?{isOwner:()=>true}:null}}
 return}
const DEV={'iPhone 16 (393×852)':[393,852,59,34,1],'iPhone 16 Pro Max (440×956)':[440,956,62,34,1],'iPhone 13 mini (375×812)':[375,812,50,34,0],'iPhone SE (375×667)':[375,667,20,0,0]};
const $=s=>document.querySelector(s),btn=$('#iosbtn'),ui=$('#iosui'),sel=$('#iodev');
let land=false,snap='';
sel.innerHTML=Object.keys(DEV).map(k=>`<option>${k}</option>`).join('');
const keys=()=>{try{return(localStorage.getItem('tradex')||'')+'|'+(localStorage.getItem('tradex_custom')||'')}catch(e){return''}};
function build(top,bot,side){
 const c=document.documentElement.cloneNode(true);
 c.querySelectorAll('#iosbtn,#iosui').forEach(n=>n.remove());
 c.querySelectorAll('dialog[open]').forEach(d=>d.removeAttribute('open'));
 const b=c.querySelector('body');if(b)b.classList.remove('ed-on','gf-on');
 /* the styles live in css/*.css now: inline them so the safe-area values below can be swapped for the device's */
 c.querySelectorAll('link[rel=stylesheet][href^="css/"]').forEach(l=>{const s=[...document.styleSheets].find(x=>x.ownerNode&&x.ownerNode.getAttribute('href')===l.getAttribute('href'));
  try{const st=document.createElement('style');if(l.id)st.id=l.id;st.textContent=[...s.cssRules].map(r=>r.cssText).join('\n');l.replaceWith(st)}catch(e){}});
 const m={top:top,bottom:bot,left:side,right:side};
 return '<!DOCTYPE html>'+c.outerHTML.replace(/env\(safe-area-inset-(top|bottom|left|right),\s*0px\)/g,(x,k)=>m[k]+'px');
}
function lay(){
 const [w,h,top,bot,isl]=DEV[sel.value];
 const W=land?h:w,H=land?w:h,side=land&&isl?59:0,t=land?0:top,b=land?(bot?21:0):bot;
 const scr=$('#ioscr'),fr=$('#ioframe'),dev=$('#iodevbox'),wrap=$('#iowrap');
 scr.style.cssText=`width:${W}px;height:${H}px;border-radius:${isl?(land?44:52):(land?10:6)}px`;
 fr.style.cssText=`width:${W}px;height:${H}px`;
 dev.style.borderRadius=(isl?(land?54:62):(land?18:16))+'px';
 const bw=W+28,bh=H+28,st=$('.io-stage').getBoundingClientRect();
 const k=Math.min(1,(st.height-16)/bh,(st.width-16)/bw);
 dev.style.transform=`scale(${k})`;wrap.style.width=bw*k+'px';wrap.style.height=bh*k+'px';
 const sb=!land&&top>0;
 $('#iotime').style.display=$('#iobat').style.display=sb?'flex':'none';
 $('#iotime').style.height=$('#iobat').style.height=(isl?54:20)+'px';
 $('#ioisl').style.display=isl&&!land?'block':'none';
 $('#iohome').style.display=bot?'block':'none';$('#iohome').style.bottom=land?'6px':'8px';
 fr.srcdoc=build(t,b,side);
}
function setOpen(v){
 ui.hidden=!v;btn.setAttribute('aria-pressed',v);btn.textContent=v?'📱 Close preview':'📱 iOS preview';
 document.body.style.overflow=v?'hidden':'';
 if(v){snap=keys();lay()}else{$('#ioframe').srcdoc='';if(keys()!==snap)location.reload()}
}
btn.onclick=()=>setOpen(ui.hidden);
$('#ioclose').onclick=()=>setOpen(false);
$('#iorel').onclick=lay;
$('#iorot').onclick=function(){land=!land;this.classList.toggle('on',land);lay()};
addEventListener('message',async e=>{const f=$('#ioframe'),d=e.data;if(!f||e.source!==f.contentWindow||!d||d.t!=='io-sample')return;
 let r;try{const sm=window.claude&&await window.claude.use('sample');if(!sm)throw 0;r={ok:1,v:await sm.json(d.p,d.o||{})}}catch(x){r={ok:0}}
 try{f.contentWindow.postMessage(Object.assign({t:'io-sample-r',id:d.id},r),'*')}catch(x){}});
sel.onchange=lay;
addEventListener('resize',()=>{if(!ui.hidden)lay()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!ui.hidden)setOpen(false)});
})();
