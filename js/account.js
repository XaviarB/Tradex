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
 background:radial-gradient(1200px 600px at 85% -10%,color-mix(in srgb,var(--acc) 22%,transparent),transparent 60%),radial-gradient(900px 500px at -10% 110%,color-mix(in srgb,var(--acc2) 18%,transparent),transparent 60%),var(--bg)}
#txa .fan{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#txa .fan i{position:absolute;width:150px;height:210px;border-radius:12px;opacity:.18;box-shadow:0 20px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15)}
#txa .fan i:nth-child(1){left:6%;top:12%;transform:rotate(-14deg);background:linear-gradient(160deg,#c9472f,#1c2422)}
#txa .fan i:nth-child(2){left:10%;top:18%;transform:rotate(-4deg);background:linear-gradient(160deg,#3b5b8c,#1c2422)}
#txa .fan i:nth-child(3){right:7%;bottom:10%;transform:rotate(12deg);background:linear-gradient(160deg,#b8862b,#1c2422)}
#txa .fan i:nth-child(4){right:11%;bottom:16%;transform:rotate(2deg);background:linear-gradient(160deg,#6b4a8a,#1c2422)}
#txa .bx{position:relative;width:min(420px,100%);background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:26px 24px 20px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
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
#txa .or{display:flex;align-items:center;gap:10px;color:var(--mut);font-size:12px;margin:14px 0}#txa .or:before,#txa .or:after{content:'';flex:1;height:1px;background:var(--line)}
#txa .spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:txs .7s linear infinite}@keyframes txs{to{transform:rotate(1turn)}}
#txa .rules{list-style:none;padding:0;margin:-4px 0 12px;font-size:12px;color:var(--mut)}#txa .rules li:before{content:'○ '}#txa .rules li.ok{color:var(--acc)}#txa .rules li.ok:before{content:'✓ '}
#txa .msg{font-size:13px;margin:12px 0 0;padding:10px 12px;border-radius:12px;background:var(--bg);border:1px solid var(--line);line-height:1.4}#txa .msg:empty{display:none}
#txa .msg.err{border-color:color-mix(in srgb,var(--acc2) 60%,transparent);color:var(--acc2)}#txa .msg.ok{border-color:color-mix(in srgb,var(--acc) 60%,transparent)}
#txa .msg .lnk{margin-left:4px}
#txa .big{font-size:40px;margin:0 0 8px}#txa .fine{font-size:12px;color:var(--mut);margin:16px 0 0;text-align:center}
@media(max-width:520px){#txa{padding:0;align-items:stretch}#txa .bx{border-radius:0;border:0;min-height:100%;padding:calc(28px + env(safe-area-inset-top,0px)) 20px 24px;box-shadow:none;background:transparent}#txa .fan i{opacity:.1}}
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
function screen(){const up=view==='up',fan='<div class="fan" aria-hidden="true"><i></i><i></i><i></i><i></i></div>',head='<div class="txlogo">Tradéx</div><p class="txtag">Your card collection, on every device.</p>';
 const emailF=`<div class="fld"><label for="txe">Email</label><input id="txe" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required value="${esc(email)}"></div>`;
 if(view==='in'||view==='up'){const pv=(BK.providers||[]).filter(p=>ICON[p]).map(p=>`<button type="button" class="go2" data-oauth="${p}">${ICON[p]}Continue with ${ttl(p)}</button>`).join('');
  return fan+`<form class="bx" id="txf" novalidate>${head}<div class="seg" role="tablist"><button type="button" role="tab" data-view="in" aria-selected="${!up}">Sign in</button><button type="button" role="tab" data-view="up" aria-selected="${up}">Create account</button></div>
  ${pv?pv+'<div class="or">or use email</div>':''}${emailF}
  <div class="fld"><label for="txp">Password</label><input id="txp" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="8" required><button type="button" class="eye" id="txeye" aria-label="Show password">Show</button></div>
  ${up?'<ul class="rules" id="txrules"><li data-r="len">At least 8 characters</li><li data-r="mix">A letter and a number</li></ul>':'<div class="txrow"><span></span><button type="button" class="lnk" data-view="reset">Forgot password?</button></div>'}
  <button class="go" type="submit" id="txgo">${up?'Create account':'Sign in'}</button>
  ${up?'':'<button type="button" class="go2" id="txl">✉️ Email me a sign-in link</button>'}
  <div class="msg" id="txmsg" role="status" aria-live="polite"></div>
  <p class="fine">${up?'Your cards are saved to your account and sync across your devices.':'Signing in keeps you signed in on this device until you sign out.'}</p></form>`}
 if(view==='reset')return fan+`<form class="bx" id="txf" novalidate>${head}<h2>Reset your password</h2><p class="sub">Enter your email and we’ll send you a link to choose a new password.</p>${emailF}
  <button class="go" type="submit" id="txgo">Send reset link</button><button type="button" class="go2" data-view="in">Back to sign in</button><div class="msg" id="txmsg" role="status" aria-live="polite"></div></form>`;
 if(view==='newpw')return fan+`<form class="bx" id="txf" novalidate>${head}<h2>Choose a new password</h2><p class="sub">You’ll stay signed in after you save it.</p>
  <div class="fld"><label for="txp">New password</label><input id="txp" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="eye" id="txeye" aria-label="Show password">Show</button></div>
  <ul class="rules" id="txrules"><li data-r="len">At least 8 characters</li><li data-r="mix">A letter and a number</li></ul>
  <button class="go" type="submit" id="txgo">Save new password</button><div class="msg" id="txmsg" role="status" aria-live="polite"></div></form>`;
 // 'sent': a link or confirmation email is on its way
 return fan+`<div class="bx">${head}<div class="big">📬</div><h2>Check your email</h2><p class="sub">${esc(note&&note.text||'')}</p>
  <p class="sub">It can take a minute. Check spam if you don’t see it.</p>
  ${note&&note.resend?`<button type="button" class="go2" id="txresend">Send it again</button>`:''}<button type="button" class="go2" data-view="in">Back to sign in</button><div class="msg" id="txmsg" role="status" aria-live="polite"></div></div>`}
function gate(msg,err){let g=$('#txa');if(!g){g=document.createElement('div');g.id='txa';document.body.appendChild(g)}
 g.innerHTML=screen();H.classList.remove('pend');if(msg)say(msg,err);
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
  if(view==='up'){if((await BK.signUp(email,password)).confirm){note={text:`We sent a confirmation link to ${email}. Open it to finish creating your account.`,resend:true};go('sent')}}
  else if(view==='in')await BK.signIn(email,password);
  else if(view==='reset'){await BK.resetPassword(email);note={text:`We sent a password reset link to ${email}.`};go('sent')}
  else if(view==='newpw'){await BK.updatePassword(password);const g=$('#txa');if(g)g.remove();recovering=false;if(user)status(state||'ok')}
 }catch(x){const[f,a]=friendly(x);say(f,true,a)}})});
document.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
 if(t.closest('#txa')&&t.dataset.view){go(t.dataset.view);return}
 if(t.id==='txeye'){const p=$('#txp'),show=p.type==='password';p.type=show?'text':'password';t.textContent=show?'Hide':'Show';t.setAttribute('aria-label',show?'Hide password':'Show password');p.focus();return}
 if(t.id==='txl'){email=$('#txe').value.trim();if(!emailOk(email)){say('Enter your email first, then tap the link button.',true);$('#txe').focus();return}
  LS('tradex_last_email',email);try{await BK.emailLink(email);note={text:`We sent a sign-in link to ${email}. Open it on this device to sign in, no password needed.`};go('sent')}catch(x){const[f,a]=friendly(x);say(f,true,a)}return}
 if(t.id==='txresend'){t.disabled=true;await resend();setTimeout(()=>{t.disabled=false},30000);return}
 if(t.dataset.oauth){try{await BK.oauth(t.dataset.oauth)}catch(x){const[f,a]=friendly(x);say(f,true,a)}return}
 if(t.id==='txme'){e.stopPropagation();menu();return}
 if(t.id==='txout'){closeMenu();if(!await ask('Sign out of Tradéx on this device? Your cards stay saved in your account.',{ok:'Sign out',danger:true}))return;
  await run(async()=>{if(SY&&SY.dirty)await push()}).catch(()=>{});await BK.signOut();['tradex','tradex_sync'].forEach(k=>LS(k,null));location.reload();return}
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

// ---------- start ----------
async function signedIn(u){if(user&&user.id===u.id)return;user=u;if(u.email)LS('tradex_last_email',u.email);LS('tradex_auth_view','in');if(!recovering){const g=$('#txa');if(g)g.remove()}H.classList.remove('pend');me();
 try{await adopt()}catch(e){console.warn('Tradéx sync:',e);status(navigator.onLine?'error':'offline')}}
BK.ready().then(()=>{BK.onChange(signedIn,()=>{if(user)location.reload()},()=>{recovering=true;view='newpw';gate()});return BK.session()})
 .then(u=>{if(u)signedIn(u);else if(!user)gate()},e=>gate(e.message,true));
})();
