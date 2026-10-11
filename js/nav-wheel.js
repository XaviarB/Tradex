/* Tradéx: scroll wheel for the sidebar navigation on narrow screens. */
(()=>{
const t=document.getElementById('whlt'),kb=document.getElementById('whlk'),nv=document.getElementById('nav');if(!t||!kb||!nv)return;
const mx=()=>Math.max(0,nv.scrollWidth-nv.clientWidth);
function sync(){const m=mx(),tw=t.clientWidth,r=nv.scrollWidth?nv.clientWidth/nv.scrollWidth:1,w=Math.max(36,Math.min(tw,r*tw)),p=m?nv.scrollLeft/m:0;
 kb.style.width=w+'px';kb.style.left=(p*(tw-w))+'px';kb.style.opacity=m?1:.35;t.setAttribute('aria-valuenow',Math.round(p*100))}
nv.addEventListener('scroll',sync,{passive:true});addEventListener('resize',sync);
new MutationObserver(sync).observe(nv,{childList:true,subtree:true});sync();
let id=null;
function setTo(e){const tw=t.clientWidth,w=kb.offsetWidth,rc=t.getBoundingClientRect(),f=tw>w?(e.clientX-rc.left-w/2)/(tw-w):0;nv.scrollLeft=Math.min(1,Math.max(0,f))*mx()}
t.addEventListener('pointerdown',e=>{id=e.pointerId;try{t.setPointerCapture(id)}catch(x){}setTo(e)});
t.addEventListener('pointermove',e=>{if(e.pointerId===id)setTo(e)});
const end=e=>{if(e.pointerId===id)id=null};
t.addEventListener('pointerup',end);t.addEventListener('pointercancel',end);
t.addEventListener('keydown',e=>{const m={ArrowRight:80,ArrowDown:80,ArrowLeft:-80,ArrowUp:-80};
 if(e.key in m){nv.scrollLeft+=m[e.key];e.preventDefault()}else if(e.key==='Home'){nv.scrollLeft=0;e.preventDefault()}else if(e.key==='End'){nv.scrollLeft=mx();e.preventDefault()}});
})();
