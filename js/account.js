/* Tradéx: accounts and sync. When an accounts backend is configured (window.TXBackend, see js/backend-supabase.js),
   everyone signs in or signs up, and their collection is saved to their account so it appears on every device.
   The browser keeps a copy in localStorage (S) so the app stays instant and works offline; changes sync in the background.
   Without that config the app runs exactly as before, saving only in this browser. */
(()=>{
const BK=window.TXBackend;if(!BK)return;
const CHUNK=200,H=document.documentElement,uuid=()=>crypto.randomUUID();
let user=null,SY=null,busy=null,timer=null,state='';

// ---------- sync bookkeeping: what the server has, as of the last sync ----------
const SK='tradex_sync';
const loadSY=()=>{try{return JSON.parse(localStorage.getItem(SK)||'null')}catch(e){return null}};
const saveSY=()=>{try{localStorage.setItem(SK,JSON.stringify(SY))}catch(e){}};
const keep=()=>{try{localStorage.setItem('tradex',JSON.stringify(S))}catch(e){}};
// Stable stringify (sorted keys), so a row's hash doesn't depend on key order.
const canon=v=>v===undefined?'null':v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const hash=v=>{const s=canon(v);let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)+'.'+s.length};

// ---------- mapping between the app's card objects and database rows ----------
const COLS={name:'name',set:'set_name',num:'number',game:'game',rarity:'rarity',cond:'condition',finish:'finish',grader:'grader',grade:'grade',acquired:'acquired',collected:'collected_on',notes:'notes'};
const SKIP=new Set([...Object.keys(COLS),'uid','qty','paid','listed','img','binders']);
const nn=v=>v===undefined||v===''?null:v,num=v=>v==null||v===''||!isFinite(+v)?null:+v;
function cardRow(c){const r={id:c.uid,extra:{}};for(const k in COLS)r[COLS[k]]=nn(c[k]);r.name=String(c.name||'Untitled');
 r.qty=Math.max(1,parseInt(c.qty)||1);r.paid=num(c.paid);r.listed_price=num(c.listed);r.market_usd=num((c.hist||[])[(c.hist||[]).length-1]);r.image_url=nn(c.img);
 for(const k in c)if(!SKIP.has(k)&&c[k]!==undefined)r.extra[k]=c[k];return r}
function rowCard(r,names){const c=Object.assign({},r.extra||{});for(const k in COLS)if(r[COLS[k]]!=null)c[k]=r[COLS[k]];
 c.uid=r.id;c.qty=r.qty||1;c.paid=r.paid==null?0:+r.paid;if(r.listed_price!=null)c.listed=+r.listed_price;if(r.image_url)c.img=r.image_url;
 if(typeof c.id!=='number')c.id=Date.now()+Math.floor(Math.random()*1e6);if(!Array.isArray(c.hist)||!c.hist.length)c.hist=[r.market_usd==null?0:+r.market_usd];c.binders=names||[];return c}
const binderRow=n=>({id:S.bid[n],name:n,game:(S.bg||{})[n]||null,pages:(S.meta||{})[n]||null});
// What a card looks like to sync, including which binders it sits in.
const cardSig=c=>hash([cardRow(c),[...(c.binders||[])].sort()]);
const settingsOf=()=>({img:S.img||{}});

function ensureIds(){S.bid=S.bid||{};S.binders.filter(b=>b!=='Everything').forEach(b=>{if(!S.bid[b])S.bid[b]=uuid()});
 for(const n in S.bid)if(!S.binders.includes(n))delete S.bid[n];S.cards.forEach(c=>{if(!c.uid)c.uid=uuid()})}

const chunks=(a,n=CHUNK)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o};
const upload=async dataUrl=>BK.upload(await (await fetch(dataUrl)).blob());
const isData=v=>typeof v==='string'&&v.startsWith('data:');

// ---------- push: send local changes ----------
async function push(){ensureIds();let moved=false;
 // Photos leave localStorage: upload them and keep the link instead.
 for(const c of S.cards)if(isData(c.img)){c.img=await upload(c.img);moved=true}
 for(const k in S.img||{})if(isData(S.img[k])){S.img[k]=await upload(S.img[k]);moved=true}
 if(moved)keep();
 const bNow={};S.binders.filter(b=>b!=='Everything').forEach(n=>{const r=binderRow(n);bNow[r.id]=hash(r)});
 const bUp=Object.keys(bNow).filter(id=>SY.b[id]!==bNow[id]),bGone=Object.keys(SY.b).filter(id=>!(id in bNow));
 const byB=Object.fromEntries(Object.entries(S.bid).map(([n,id])=>[id,n]));
 for(const p of chunks(bUp))await BK.upsert('binders',p.map(id=>binderRow(byB[id])));
 const cNow={};S.cards.forEach(c=>{cNow[c.uid]=cardSig(c)});
 const cUp=S.cards.filter(c=>SY.c[c.uid]!==cNow[c.uid]),cGone=Object.keys(SY.c).filter(id=>!(id in cNow)),now=new Date().toISOString();
 for(const p of chunks(cUp)){await BK.upsert('cards',p.map(cardRow));
  await BK.setLinks(p.map(c=>c.uid),p.flatMap(c=>(c.binders||[]).filter(n=>S.bid[n]).map(n=>({binder_id:S.bid[n],card_id:c.uid}))))}
 for(const p of chunks(cGone))await BK.remove('cards',p,now);
 for(const p of chunks(bGone))await BK.remove('binders',p,now);
 const sh=hash(settingsOf());if(SY.s!==sh)await BK.setSettings(settingsOf());
 cUp.forEach(c=>{SY.c[c.uid]=cNow[c.uid]});cGone.forEach(id=>delete SY.c[id]);bUp.forEach(id=>{SY.b[id]=bNow[id]});bGone.forEach(id=>delete SY.b[id]);SY.s=sh;SY.dirty=false;saveSY()}

// ---------- pull: bring in changes from other devices ----------
async function pull(){const since=SY.pulled,bs=await BK.list('binders',since),cs=await BK.list('cards',since);let last=since;
 const links={};for(const p of chunks(cs.map(r=>r.id)))(await BK.links(p)).forEach(l=>{(links[l.card_id]=links[l.card_id]||[]).push(l.binder_id)});
 S.bid=S.bid||{};S.bg=S.bg||{};S.meta=S.meta||{};let changed=false;
 for(const r of bs){last=!last||r.updated_at>last?r.updated_at:last;const old=Object.keys(S.bid).find(n=>S.bid[n]===r.id);
  if(old&&old!==r.name||r.deleted_at){S.binders=S.binders.filter(b=>b!==old);delete S.bid[old];delete S.bg[old];delete S.meta[old];S.cards.forEach(c=>{c.binders=(c.binders||[]).filter(b=>b!==old)})}
  if(r.deleted_at){delete SY.b[r.id];changed=true;continue}
  if(!S.binders.includes(r.name))S.binders.push(r.name);S.bid[r.name]=r.id;if(r.game)S.bg[r.name]=r.game;else delete S.bg[r.name];if(r.pages)S.meta[r.name]=r.pages;else delete S.meta[r.name];
  SY.b[r.id]=hash(binderRow(r.name));changed=true}
 const nameOf=Object.fromEntries(Object.entries(S.bid).map(([n,id])=>[id,n]));
 for(const r of cs){last=!last||r.updated_at>last?r.updated_at:last;const i=S.cards.findIndex(c=>c.uid===r.id),loc=i>=0?S.cards[i]:null;
  if(loc&&SY.c[r.id]&&cardSig(loc)!==SY.c[r.id])continue; // edited here since the last sync: this device's version is pushed next
  if(r.deleted_at){if(i>=0)S.cards.splice(i,1);delete SY.c[r.id];changed=true;continue}
  const c=rowCard(r,(links[r.id]||[]).map(id=>nameOf[id]).filter(Boolean));if(loc)c.id=loc.id;
  if(i>=0)S.cards[i]=c;else S.cards.push(c);SY.c[r.id]=cardSig(c);changed=true}
 if(!SY.dirty||SY.s==null){const st=await BK.getSettings();
  if(st.img&&hash(st)!==SY.s){S.img=st.img;SY.s=hash(settingsOf());changed=true}}
 SY.pulled=last;saveSY();if(changed){keep();try{setup();render()}catch(e){}}}

// ---------- the sync loop ----------
function run(fn){const p=(busy||Promise.resolve()).then(fn),done=p.catch(()=>{});busy=done;done.then(()=>{if(busy===done)busy=null});return p}
async function sync(){if(!user)return;status('saving');try{await run(async()=>{if(SY.dirty)await push();await pull();if(SY.dirty)await push()});status('ok')}
 catch(e){console.warn('Tradéx sync:',e);status(navigator.onLine?'error':'offline')}}
function later(ms=1200){clearTimeout(timer);timer=setTimeout(sync,ms)}
// storage.js calls this after every local save.
window.TXSync={changed(){if(!SY||!user)return;SY.dirty=true;saveSY();status('saving');later()}};
addEventListener('online',()=>later(100));
addEventListener('focus',()=>later(300));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)later(300)});
setInterval(()=>{if(user&&SY&&SY.dirty)sync()},30000);

// ---------- first sign-in on this device ----------
const DEMO=new Set(seed().cards.map(c=>c.id+'|'+c.name));
const mine=cs=>cs.filter(c=>!DEMO.has(c.id+'|'+c.name));
async function adopt(){SY=loadSY();if(SY&&SY.uid===user.id)return sync();
 // This browser has no synced copy of this account yet.
 const local=SY&&SY.uid?[]:mine(S.cards),localS=JSON.parse(JSON.stringify(S));
 if(local.length)try{localStorage.setItem('tradex_before_signin',JSON.stringify(S))}catch(e){}
 S={binders:['Everything'],cards:[],bid:{},bg:{},meta:{},img:{}};SY={uid:user.id,pulled:null,c:{},b:{},s:null,dirty:false};
 status('saving');await run(pull);
 if(local.length&&await ask(S.cards.length?`Add the ${local.length} card${local.length===1?'':'s'} saved in this browser to your account too?`:`Save the ${local.length} card${local.length===1?'':'s'} in this browser to your account?`,{ok:'Add them'})){
  local.forEach(c=>{c=JSON.parse(JSON.stringify(c));delete c.uid;c.binders=(c.binders||[]).filter(b=>b!=='Everything');c.binders.forEach(b=>{if(!S.binders.includes(b))S.binders.push(b);if(localS.bg&&localS.bg[b]&&!S.bg[b])S.bg[b]=localS.bg[b];if(localS.meta&&localS.meta[b]&&!S.meta[b])S.meta[b]=localS.meta[b]});S.cards.push(c)});
  if(!Object.keys(S.img||{}).length&&localS.img)S.img=localS.img;SY.dirty=true}
 keep();saveSY();setup();render();await sync()}

// ---------- UI: sign-in screen and account menu ----------
const css=`#txa{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;visibility:visible;color:var(--ink);
 background:rgba(6,10,9,.38);-webkit-backdrop-filter:blur(9px) saturate(1.15);backdrop-filter:blur(9px) saturate(1.15);animation:txin .35s ease-out;
 transition:background .7s ease,backdrop-filter .7s ease,-webkit-backdrop-filter .7s ease}
#txa.clear{background:rgba(6,10,9,0);-webkit-backdrop-filter:blur(0) saturate(1);backdrop-filter:blur(0) saturate(1);pointer-events:none}
#txa.rip{transition-duration:1.1s;transition-delay:1.1s;overflow:hidden}#txa.rip .bx{pointer-events:none}
#txa.clear:not(.rip) .bx{transition:transform .35s ease-in,opacity .3s ease-in;transform:translateY(16px) scale(.97);opacity:0}
@media(prefers-reduced-motion:reduce){#txa,#txa.clear .bx{transition:none;animation:none}}
@keyframes txin{from{opacity:0}}@keyframes txup{from{transform:translateY(40px);opacity:0}}
#txa .x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--mut);cursor:pointer;font-size:16px;margin:0;padding:0}
#txa .bx{position:relative;width:min(420px,100%);background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:26px 24px 20px;box-shadow:0 30px 80px rgba(0,0,0,.45);animation:txup .3s ease-out}
#txa .txlogo{font:800 30px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 6px;padding:0;background:none}
#txa .txtag{font-size:14px;color:var(--mut);margin:0 0 18px;padding:0;background:none;border-radius:0}
#txa .seg{display:grid;grid-template-columns:1fr 1fr;background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:4px;margin:0 0 16px}
#txa .seg button{border:0;background:none;border-radius:10px;padding:9px;font-family:inherit;font-weight:600;font-size:14px;color:var(--mut);cursor:pointer;margin:0}
#txa .seg button[aria-selected=true]{background:var(--panel);color:var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.25)}
#txa h2{margin:0 0 6px;font-size:22px}#txa .sub{font-size:14px;color:var(--mut);margin:0 0 16px;line-height:1.45}
#txa label{display:block;font-size:13px;font-weight:600;margin:0 0 4px}
#txa .fld{position:relative;margin:0 0 12px}
#txa input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:inherit;font-family:inherit;font-size:16px}
#txa input:focus{border-color:var(--acc);outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 25%,transparent)}
#txa .eye{position:absolute;right:6px;bottom:6px;border:0;background:none;color:var(--mut);cursor:pointer;padding:6px 8px;font-family:inherit;font-weight:600;font-size:12px;margin:0;width:auto}
#txa .txrow{display:flex;justify-content:space-between;align-items:center;margin:-4px 0 12px;font-size:13px;color:var(--mut)}
#txa .lnk{border:0;background:none;color:var(--acc);cursor:pointer;font-family:inherit;font-weight:600;font-size:13px;padding:4px 0;margin:0;width:auto}
#txa .go{width:100%;padding:13px;border-radius:14px;border:0;background:var(--acc);color:var(--bg);font-family:inherit;font-weight:700;font-size:16px;cursor:pointer;margin:4px 0 0;display:flex;align-items:center;justify-content:center;gap:8px}
#txa .go:disabled{opacity:.7;cursor:wait}
#txa .go2{width:100%;padding:12px;border-radius:14px;border:1px solid var(--line);background:var(--bg);color:inherit;font-family:inherit;font-weight:600;font-size:15px;cursor:pointer;margin:8px 0 0;display:flex;align-items:center;justify-content:center;gap:10px}
#txa .go2 svg{width:18px;height:18px}
#txa .oauth{display:flex;justify-content:center;gap:54px;margin:10px 0 8px}
#txa .circ{width:min(146px,calc((100% - 54px) / 2));height:auto;aspect-ratio:1;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:inherit;display:grid;place-items:center;padding:0;margin:0;cursor:pointer;transition:transform .15s,border-color .15s}
#txa .circ:hover{border-color:var(--acc);transform:translateY(-1px)}#txa .circ:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 35%,transparent)}
#txa .circ svg{width:44%;height:44%}
#txv{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:10px;max-width:calc(100% - 24px);box-sizing:border-box;
 padding:10px 10px 10px 16px;border-radius:14px;background:var(--panel);border:1px solid var(--line);color:var(--ink);font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
@media(max-width:520px){#txv{width:calc(100% - 24px);font-size:13px}}#txv span{overflow-wrap:anywhere}
#txv.ok{padding:10px 16px;border-color:var(--acc);color:var(--acc);font-weight:600}
#txv button{border:0;background:none;color:var(--acc);font:inherit;font-weight:700;cursor:pointer;padding:6px 8px;margin:0;width:auto}#txv #txvx{color:var(--mut);font-weight:400}
#txa .or{display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px;margin:14px 0}#txa .or:before,#txa .or:after{content:'';flex:1;height:1px;background:var(--line)}
#txa .spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:txs .7s linear infinite}@keyframes txs{to{transform:rotate(1turn)}}
#txa .rules{list-style:none;padding:0;margin:-4px 0 12px;font-size:12px;color:var(--mut)}#txa .rules li:before{content:'○ '}#txa .rules li.ok{color:var(--acc)}#txa .rules li.ok:before{content:'✓ '}
#txa .msg{font-size:13px;margin:12px 0 0;padding:10px 12px;border-radius:12px;background:var(--bg);border:1px solid var(--line);line-height:1.4}#txa .msg:empty{display:none}
#txa .msg.err{border-color:color-mix(in srgb,var(--acc2) 60%,transparent);color:var(--acc2)}#txa .msg.ok{border-color:color-mix(in srgb,var(--acc) 60%,transparent)}
#txa .msg .lnk{margin-left:4px}
#txa .big{font-size:40px;margin:0 0 8px}#txa .fine{font-size:12px;color:var(--mut);margin:16px 0 0;text-align:center}
#txa .guest{display:block;width:100%;margin:14px 0 0;border:0;background:none;color:var(--mut);font-family:inherit;font-size:14px;cursor:pointer;padding:6px}#txa .guest b{color:var(--ink)}
@media(max-width:520px){#txa{padding:0;align-items:flex-end}#txa .bx{border-radius:22px 22px 0 0;border-bottom:0;max-height:92vh;overflow:auto;padding:22px 20px calc(18px + env(safe-area-inset-bottom,0px))}#txa .bx:before{content:'';display:block;width:40px;height:4px;border-radius:2px;background:var(--line);margin:-10px auto 14px}}
#txme.guest{background:var(--acc);border-color:var(--acc);color:var(--bg);font-weight:700}#txme.guest i{display:none}
#txme{white-space:nowrap}#txme i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:var(--acc,#4cc2ab);vertical-align:middle}
#txme[data-s=saving] i{background:#e0b341}#txme[data-s=offline] i,#txme[data-s=error] i{background:#ff8a8a}
#txmenu{position:fixed;z-index:9999;width:260px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.4);font-size:14px}
#txmenu b{display:block;word-break:break-all}#txmenu p{margin:6px 0 12px;color:var(--mut);font-size:13px}#txmenu button{width:100%;margin:4px 0 0;text-align:left}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}};
const ICON={google:'<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
 apple:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>'};
let view=LS('tradex_auth_view')==='up'?'up':'in',email=LS('tradex_last_email')||'',busyBtn=false,note=null;
const ttl=s=>s[0].toUpperCase()+s.slice(1);
function screen(){const up=view==='up',fan='',x=`<button type="button" class="x" id="txguest2" aria-label="Close and continue as guest">✕</button>`,head='<div class="txlogo">Tradéx</div><p class="txtag">Your card collection, on every device.</p>';
 const emailF=`<div class="fld"><label for="txe">Email</label><input id="txe" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required value="${esc(email)}"></div>`;
 if(view==='in'||view==='up'){const pv='<div class="oauth">'+['google','apple'].map(p=>`<button type="button" class="circ" data-oauth="${p}" aria-label="Continue with ${ttl(p)}" title="Continue with ${ttl(p)}">${ICON[p]}</button>`).join('')+'</div>';
  return fan+`<form class="bx" id="txf" novalidate>${x}${head}<div class="seg" role="tablist"><button type="button" role="tab" data-view="in" aria-selected="${!up}">Sign in</button><button type="button" role="tab" data-view="up" aria-selected="${up}">Create account</button></div>
  ${emailF}
  <div class="fld"><label for="txp">Password</label><input id="txp" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="8" required><button type="button" class="eye" id="txeye" aria-label="Show password">Show</button></div>
  ${up?'<ul class="rules" id="txrules"><li data-r="len">At least 8 characters</li><li data-r="mix">A letter and a number</li></ul>':'<div class="txrow"><span></span><button type="button" class="lnk" data-view="reset">Forgot password?</button></div>'}
  <button class="go" type="submit" id="txgo">${up?'Create account':'Sign in'}</button>
  <div class="or">or</div>${pv}
  <div class="msg" id="txmsg" role="status" aria-live="polite"></div>
  <button type="button" class="guest" id="txguest">Just looking? <b>Continue as guest →</b></button>
  <p class="fine">${up?'Your cards are saved to your account and sync across your devices.':'Guests can look around. Sign in to save your cards to your account.'}</p></form>`}
 if(view==='reset')return fan+`<form class="bx" id="txf" novalidate>${x}${head}<h2>Reset your password</h2><p class="sub">Enter your email and we’ll send you a link to choose a new password.</p>${emailF}
  <button class="go" type="submit" id="txgo">Send reset link</button><button type="button" class="go2" data-view="in">Back to sign in</button><div class="msg" id="txmsg" role="status" aria-live="polite"></div></form>`;
 if(view==='newpw')return fan+`<form class="bx" id="txf" novalidate>${head}<h2>Choose a new password</h2><p class="sub">You’ll stay signed in after you save it.</p>
  <div class="fld"><label for="txp">New password</label><input id="txp" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="eye" id="txeye" aria-label="Show password">Show</button></div>
  <ul class="rules" id="txrules"><li data-r="len">At least 8 characters</li><li data-r="mix">A letter and a number</li></ul>
  <button class="go" type="submit" id="txgo">Save new password</button><div class="msg" id="txmsg" role="status" aria-live="polite"></div></form>`;
 // 'sent': a link or confirmation email is on its way
 return fan+`<div class="bx">${x}${head}<div class="big">📬</div><h2>Check your email</h2><p class="sub">${esc(note&&note.text||'')}</p>
  <p class="sub">It can take a minute. Check spam if you don’t see it.</p>
  ${note&&note.resend?`<button type="button" class="go2" id="txresend">Send it again</button>`:''}<button type="button" class="go2" data-view="in">Back to sign in</button><div class="msg" id="txmsg" role="status" aria-live="polite"></div></div>`}
function gate(msg,err){let g=$('#txa');if(!g){g=document.createElement('div');g.id='txa';document.body.appendChild(g)}
 g.classList.remove('clear','rip');g.innerHTML=screen();H.classList.remove('pend');if(msg)say(msg,err);
 const f=$('#txe')&&!$('#txe').value?$('#txe'):$('#txp')||$('#txe');if(f&&matchMedia('(pointer:fine)').matches)f.focus();rules()}
function go(v){if($('#txe'))email=$('#txe').value.trim();view=v;if(v==='in'||v==='up')LS('tradex_auth_view',v);gate()}
// Messages can carry one action, e.g. "Reset password" or "Resend email".
function say(m,err,act){const e=$('#txmsg');if(!e)return;e.className='msg'+(err?' err':m?' ok':'');e.textContent=m||'';
 if(act){const b=document.createElement('button');b.type='button';b.className='lnk';b.textContent=act.label;b.onclick=act.run;e.append(' ',b)}}
function rules(){const p=$('#txp'),r=$('#txrules');if(!p||!r)return;const v=p.value;
 r.querySelector('[data-r=len]').classList.toggle('ok',v.length>=8);r.querySelector('[data-r=mix]').classList.toggle('ok',/[a-z]/i.test(v)&&/\d/.test(v))}
async function spin(fn){const b=$('#txgo');if(busyBtn)return;busyBtn=true;const t=b&&b.innerHTML;if(b){b.disabled=true;b.innerHTML='<span class="spin"></span>'+t}
 try{await fn()}finally{busyBtn=false;const b2=$('#txgo');if(b2&&b2===b){b2.disabled=false;b2.innerHTML=t}}}
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function friendly(x){const m=String(x&&x.message||x);
 if(/invalid login|invalid credentials/i.test(m))return['That email and password don’t match.',{label:'Reset password',run:()=>go('reset')}];
 if(/already (registered|exists)/i.test(m))return['You already have an account with this email.',{label:'Sign in instead',run:()=>go('in')}];
 if(/not confirmed/i.test(m))return['Confirm your email first. We sent you a link when you signed up.',{label:'Resend it',run:()=>resend()}];
 if(/rate limit|too many|seconds/i.test(m))return['Too many tries. Wait a minute and try again.'];
 if(/password/i.test(m)&&/(short|least|weak|characters)/i.test(m))return['Choose a longer password: at least 8 characters, with a letter and a number.'];
 if(/fetch|network|load failed/i.test(m))return['Can’t reach Tradéx right now. Check your connection and try again.'];
 return[m]}
async function resend(){try{await BK.resendConfirm(email);say('Sent. Check your inbox.')}catch(x){const[f,a]=friendly(x);say(f,true,a)}}
document.addEventListener('input',e=>{if(e.target.id==='txp')rules();if(e.target.id==='txe'){email=e.target.value.trim();LS('tradex_last_email',email)}});
document.addEventListener('submit',e=>{if(e.target.id!=='txf')return;e.preventDefault();const p=$('#txp'),password=p?p.value:'';if($('#txe'))email=$('#txe').value.trim();
 if($('#txe')&&!emailOk(email)){say('Enter a valid email address.',true);$('#txe').focus();return}
 if(p&&!password){say('Enter your password.',true);p.focus();return}
 if((view==='up'||view==='newpw')&&!(password.length>=8&&/[a-z]/i.test(password)&&/\d/.test(password))){say('Choose a password with at least 8 characters, including a letter and a number.',true);p.focus();return}
 LS('tradex_last_email',email);say('');
 spin(async()=>{try{
  if(view==='up'){if((await BK.signUp(email,password)).confirm){note={text:`We sent a confirmation link to ${email}. Open it to finish creating your account.`,resend:true};go('sent')}
   else{SS('tradex_verify_hide',null);BK.sendVerify(email).catch(e=>console.warn('Tradéx verify email:',e))}}
  else if(view==='in')await BK.signIn(email,password);
  else if(view==='reset'){await BK.resetPassword(email);note={text:`We sent a password reset link to ${email}.`};go('sent')}
  else if(view==='newpw'){await BK.updatePassword(password);lift(true);recovering=false;if(user)status(state||'ok')}
 }catch(x){const[f,a]=friendly(x);say(f,true,a)}})});
document.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
 if(t.closest('#txa')&&t.dataset.view){go(t.dataset.view);return}
 if(t.id==='txeye'){const p=$('#txp'),show=p.type==='password';p.type=show?'text':'password';t.textContent=show?'Hide':'Show';t.setAttribute('aria-label',show?'Hide password':'Show password');p.focus();return}
 if(t.id==='txresend'){t.disabled=true;await resend();setTimeout(()=>{t.disabled=false},30000);return}
 if(t.dataset.oauth){const p=t.dataset.oauth;say('');
  if(!(await BK.providers()).includes(p)){say(`${ttl(p)} sign-in isn’t switched on yet. Use your email for now.`,true);return}
  say(`Finish signing in with ${ttl(p)} in the window that opened…`);
  try{await BK.oauth(p);const u=await BK.session();if(u)signedIn(u);else say(`${ttl(p)} sign-in was closed before it finished.`,true)}catch(x){const[f,a]=friendly(x);say(f,true,a)}return}
 if(t.id==='txguest'||t.id==='txguest2'){guest(t.id==='txguest');return}
 if(t.id==='txme'){e.stopPropagation();if(!user){view='in';gate();return}menu();return}
 if(t.id==='txout'){closeMenu();if(!await ask('Sign out of Tradéx on this device? Your cards stay saved in your account.',{ok:'Sign out',danger:true}))return;
  await run(async()=>{if(SY&&SY.dirty)await push()}).catch(()=>{});await BK.signOut();['tradex','tradex_sync','tradex_guest'].forEach(k=>LS(k,null));location.reload();return}
 if(t.id==='txsyncnow'){closeMenu();sync();return}
 if(t.id==='txbk'){closeMenu();const b=$('#bkb');if(b)b.click();return}});
const SMSG={ok:'All changes are saved to your account.',saving:'Saving your changes…',offline:'You’re offline. Changes are kept on this device and sync when you’re back online.',error:'Couldn’t reach your account. Tradéx will keep retrying.'};
function menu(){if($('#txmenu'))return closeMenu();const b=$('#txme').getBoundingClientRect(),m=document.createElement('div');m.id='txmenu';m.setAttribute('role','dialog');m.setAttribute('aria-label','Account');
 m.innerHTML=`<b>${esc(user.email||'')}</b><p id="txms">${SMSG[state]||''}</p><button id="txsyncnow">↻ Sync now</button>${$('#bkb')?'<button id="txbk">⬇ Back up or export</button>':''}<button id="txout">Sign out</button>`;
 document.body.appendChild(m);m.style.top=Math.round(b.bottom+8)+'px';m.style.left=Math.max(8,Math.min(innerWidth-268,Math.round(b.right-260)))+'px'}
const closeMenu=()=>{const m=$('#txmenu');if(m)m.remove()};
document.addEventListener('click',e=>{if(!e.target.closest('#txmenu')&&!e.target.closest('#txme'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
function status(s){state=s;const b=$('#txme');if(b){b.dataset.s=s;b.title={ok:'Saved to your account',saving:'Saving…',offline:'Offline',error:'Sync problem'}[s]||'';b.setAttribute('aria-label','Account: '+(SMSG[s]||''))}const p=$('#txms');if(p)p.textContent=SMSG[s]||''}
function me(){let b=$('#txme');if(!b){b=document.createElement('button');b.id='txme';b.setAttribute('aria-haspopup','dialog');const imp=$('#impb');imp.parentElement.insertBefore(b,imp)}
 b.innerHTML='<i></i>'+esc((user.email||'Account').split('@')[0]);status(state||'ok')}
let recovering=false;
const isGuest=()=>LS('tradex_guest')==='1';
// Leaving the sign-in screen: the haze clears, and with rip=true the card is torn open like a booster pack
// (top strip rips off and flies away, then the rest is lifted and tossed off screen).
function lift(rip){const g=$('#txa');if(!g||g.classList.contains('clear'))return;
 const bx=g.querySelector('.bx'),still=matchMedia('(prefers-reduced-motion:reduce)').matches;
 if(!rip||still||!bx||!bx.animate){g.classList.add('clear');setTimeout(()=>{if(g.classList.contains('clear'))g.remove()},still?0:750);return}
 g.classList.add('clear','rip');
 const r=bx.getBoundingClientRect(),cut=Math.min(64,r.height*.12),n=Math.round(r.width/7),pts=[],R=Math.random;
 // a real tear wanders: a slow drift across the card, small fibre-sized wiggles, and the odd sharper snag
 let y=cut+(R()-.5)*6,dy=(R()-.5)*1.2;for(let i=0;i<=n;i++){dy=Math.max(-1.6,Math.min(1.6,dy*.8+(R()-.5)*1.1));y=Math.max(cut-9,Math.min(cut+9,y+dy));
  pts.push([i/n*100,+(y+(R()-.5)*1.6+(R()<.08?(R()-.4)*7:0)).toFixed(1)])}
 const edge=pts.map(([x,y])=>`${x}% ${y}px`),top=`polygon(0 0,100% 0,${edge.slice().reverse().join(',')})`,body=`polygon(${edge.join(',')},100% 100%,0 100%)`;
 const fray=()=>{const v=document.createElementNS('http://www.w3.org/2000/svg','svg');v.setAttribute('viewBox',`0 0 100 ${cut+12}`);v.setAttribute('preserveAspectRatio','none');
  v.style.cssText=`position:absolute;left:0;top:0;width:100%;height:${cut+12}px;pointer-events:none;overflow:visible`;
  v.innerHTML=`<polyline points="${pts.map(([x,y])=>x+','+y).join(' ')}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="bevel"/>`;return v};
 const at=x=>{for(let i=1;i<pts.length;i++)if(pts[i][0]>=x){const[a,b]=[pts[i-1],pts[i]];return b[0]===a[0]?b[1]:a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])}return pts[pts.length-1][1]};
 const wrap=document.createElement('div'),SW=580,W=r.width,PX=pts.map(([x,y])=>[x/100*W,y]);wrap.setAttribute('aria-hidden','true');
 Object.assign(wrap.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:W+'px',height:r.height+'px',pointerEvents:'none',zIndex:1,overflow:'visible',transformOrigin:`100% ${cut}px`});
 // The torn-off title strip stays one piece: the part not yet folded is the card itself, and the part folded over
 // is its mirror image across a slanted crease, drawn as the silver inside of the foil draping down over the right side.
 const shape=[[0,0],[W,0],[W,PX[PX.length-1][1]],...PX.slice().reverse(),[0,PX[0][1]]];
 const half=(poly,n,k)=>{const out=[],side=q=>n[0]*q[0]+n[1]*q[1]-k;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],sa=side(a),sb=side(b);
  if(sa>=0)out.push(a);if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}}return out};
 const front=bx.cloneNode(true);front.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
 Object.assign(front.style,{position:'absolute',left:0,top:0,width:W+'px',height:r.height+'px',margin:0,maxHeight:'none',animation:'none',boxSizing:'border-box'});
 const NS='http://www.w3.org/2000/svg',fl=document.createElementNS(NS,'svg');fl.setAttribute('width',W);fl.setAttribute('height',r.height);
 fl.style.cssText='position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(1px 5px 6px rgba(0,0,0,.45))';
 fl.innerHTML='<defs><linearGradient id="txfl" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8f9c97"/><stop offset=".05" stop-color="#f6fcfa"/><stop offset=".16" stop-color="#d3ddd9"/><stop offset=".6" stop-color="#a9b6b1"/><stop offset="1" stop-color="#7e8b87"/></linearGradient></defs><polygon fill="url(#txfl)"/><polyline fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-linejoin="bevel"/>';
 const [gr,flap,rim]=[fl.querySelector('linearGradient'),fl.querySelector('polygon'),fl.querySelector('polyline')];
 // crease slants so the folded end comes over at a downward angle and ends just past the right edge, hanging below the strip
 const A=.13,nv=[Math.cos(A),Math.sin(A)],kEnd=.5*W/nv[0],kOut=W*nv[0]+(innerWidth-r.left-W+80)/(2*nv[0]);
 const roll=e=>{const k=e*kEnd,f=half(shape,nv,k),back=half(shape,[-nv[0],-nv[1]],-k).map(([x,y])=>{const dd=nv[0]*x+nv[1]*y-k;return[x-2*dd*nv[0],y-2*dd*nv[1]]});
  front.style.clipPath=f.length>2?`polygon(${f.map(([x,y])=>x.toFixed(1)+'px '+y.toFixed(1)+'px').join(',')})`:'polygon(0 0,0 0,0 0)';
  const pt=back.map(([x,y])=>x.toFixed(1)+','+y.toFixed(1)).join(' ');flap.setAttribute('points',pt);rim.setAttribute('points',back.length?pt+' '+back[0].join(','):'');
  const q=[k*nv[0],k*nv[1]];gr.setAttribute('x1',q[0]);gr.setAttribute('y1',q[1]);gr.setAttribute('x2',q[0]+nv[0]*W*.55);gr.setAttribute('y2',q[1]+nv[1]*W*.55)};
 wrap.append(front,fl);front.scrollTop=bx.scrollTop;roll(0);
 g.appendChild(wrap);bx.style.clipPath=`polygon(${edge.join(',')},100% 100%,0 100%)`;bx.style.animation='none';
 // A spark of light runs slowly along the tear line, lighting the torn edge; the strip's left end is pulled along with it.
 const H=cut+24,P=pts.map(([x,y])=>[x/100*W,y]),d='M'+P.map(([x,y])=>x.toFixed(1)+' '+y).join(' L'),len=P.reduce((a,p,i)=>i?a+Math.hypot(p[0]-P[i-1][0],p[1]-P[i-1][1]):0,0);
 const lit=document.createElement('div');lit.setAttribute('aria-hidden','true');
 Object.assign(lit.style,{position:'absolute',left:0,top:0,width:W+'px',height:H+'px',pointerEvents:'none',overflow:'visible'});
 lit.innerHTML=`<svg width="${W}" height="${H}" style="overflow:visible;display:block"><defs><radialGradient id="txsp"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#e9fff6" stop-opacity=".9"/><stop offset="1" stop-color="#7fe0c0" stop-opacity="0"/></radialGradient>
  <filter id="txbl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
  <path d="${d}" fill="none" stroke="#bff5e2" stroke-width="5" stroke-opacity=".55" filter="url(#txbl)" stroke-dasharray="${len}" stroke-dashoffset="${len}"/>
  <path d="${d}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.6" stroke-linejoin="bevel" stroke-dasharray="${len}" stroke-dashoffset="${len}"/>
  <ellipse rx="34" ry="16" fill="url(#txsp)" opacity=".9"/><circle r="3.2" fill="#fff"/></svg>`;
 wrap.insertBefore(lit,fl);const [glowP,lineP]=lit.querySelectorAll('path'),[halo,dot]=[lit.querySelector('ellipse'),lit.querySelector('circle')],t0=performance.now();
 // One continuous pull: it starts gently, settles into a steady pace while the light runs along the tear, then keeps
 // accelerating through the right side without ever pausing, until the whole strip has flipped over and left the screen.
 const s0=.25,g1=1-s0/2,ac=1.6,need=g1*(kOut/kEnd-1),xs=(-1+Math.sqrt(1+4*ac*need))/(2*ac),pullEnd=SW*(1+xs);
 const gp=t=>{const v=t/SW;return v<s0?v*v/(2*s0):v<=1?v-s0/2:g1+(v-1)+ac*(v-1)*(v-1)};let lightOn=true;
 (function step(now){const t=now-t0,k=Math.min(kOut,kEnd*gp(t)/g1);roll(k/kEnd);
  if(lightOn){const tx=Math.min(W,2*k*nv[0]),pt=lineP.getPointAtLength(len*tx/W);glowP.style.strokeDashoffset=lineP.style.strokeDashoffset=len*(1-tx/W);
   halo.setAttribute('cx',pt.x);halo.setAttribute('cy',pt.y);dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);
   if(tx>=W){lightOn=false;bx.appendChild(fray());front.appendChild(fray());lit.animate([{opacity:1},{opacity:0}],{duration:260,fill:'forwards'})}}
  if(k<kOut)requestAnimationFrame(step)})(t0);
 const T=SW+260,E='cubic-bezier(.5,0,.75,0)',tot=T+650;
 // …and the opened pack shivers from the tear, lifts, and is tossed off the top left while the haze clears.
 const f=t=>t/tot;bx.animate([{transform:'none'},{transform:'rotate(.4deg)',offset:f(SW*.3)},{transform:'rotate(-.4deg)',offset:f(SW*.6)},{transform:'none',offset:f(SW*.9)},{transform:'none',offset:f(T)},
  {transform:'translateY(-22px) rotate(-2deg)',offset:f(T+200)},{transform:`translate(${-innerWidth*.7}px,${-innerHeight*1.1}px) rotate(-28deg)`}],{duration:tot,easing:E,fill:'forwards'});
 setTimeout(()=>{if(g.classList.contains('clear'))g.remove()},Math.max(tot,pullEnd)+80)}
function guest(rip){LS('tradex_guest','1');lift(rip);H.classList.remove('pend');guestBtn()}
function guestBtn(){let b=$('#txme');if(!b){b=document.createElement('button');b.id='txme';const imp=$('#impb');imp.parentElement.insertBefore(b,imp)}
 b.className='guest';b.textContent='Sign in';b.setAttribute('aria-label','Sign in or create an account to save your cards')}
// The Google/Apple popup lands back on this page; there it only finishes sign-in and closes.
const POP=window.name==='tradex-auth'&&!!window.opener;
addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.tx==='auth')BK.session().then(u=>{if(u)signedIn(u)})});

// ---------- email verification ----------
// New accounts go straight into the app; a bar at the bottom asks them to open the link we emailed, until they do.
function SS(k,v){try{if(v===undefined)return sessionStorage.getItem(k);v===null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v)}catch(e){}}
function verifyBar(msg){let b=$('#txv');if(!user||user.verified||SS('tradex_verify_hide')){if(b)b.remove();return}
 if(!b){b=document.createElement('div');b.id='txv';b.setAttribute('role','status');document.body.appendChild(b)}
 b.innerHTML=`<span>${msg?esc(msg):`Verify your email: we sent a link to <b>${esc(user.email)}</b>.`}</span><button type="button" id="txvr">Resend</button><button type="button" id="txvx" aria-label="Hide">✕</button>`}
document.addEventListener('click',async e=>{const t=e.target.closest('#txvr,#txvx');if(!t)return;
 if(t.id==='txvx'){SS('tradex_verify_hide','1');verifyBar();return}
 t.disabled=true;try{await BK.sendVerify(user.email);verifyBar(`Sent again to ${user.email}. Check your inbox.`)}catch(x){verifyBar(friendly(x)[0])}});
async function verifiedReturn(){const q=new URLSearchParams(location.search);if(q.get('verified')!=='1')return;
 q.delete('verified');history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
 try{await BK.markVerified();user.verified=true;verifyBar();const b=document.createElement('div');b.id='txv';b.className='ok';b.textContent='Email verified ✓';document.body.appendChild(b);setTimeout(()=>b.remove(),3000)}catch(e){console.warn('Tradéx verify:',e)}}

// ---------- start ----------
async function signedIn(u){if(POP){try{window.opener.postMessage({tx:'auth'},location.origin)}catch(e){}window.close();return}
 if(user&&user.id===u.id)return;LS('tradex_guest',null);user=u;if(u.email)LS('tradex_last_email',u.email);LS('tradex_auth_view','in');if(!recovering)lift(true);H.classList.remove('pend');me();verifyBar();verifiedReturn();
 try{await adopt()}catch(e){console.warn('Tradéx sync:',e);status(navigator.onLine?'error':'offline')}}
BK.ready().then(()=>{BK.onChange(signedIn,()=>{if(user)location.reload()},()=>{recovering=true;view='newpw';gate()});return BK.session()})
 .then(u=>{if(u)signedIn(u);else if(POP){document.body.innerHTML='<p style="font:16px system-ui;padding:40px;text-align:center">Signing you in…</p>';H.classList.remove('pend')}
  else if(!user){if(isGuest()){H.classList.remove('pend');guestBtn()}else gate()}},e=>gate(e.message,true));
})();
