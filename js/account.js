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
const css=`#txa{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg,#0d1110);visibility:visible}
#txa .bx{width:min(400px,100%);background:var(--panel,#151b19);border:1px solid var(--line,#2a3330);border-radius:18px;padding:22px}
#txa h2{margin:0 0 4px;font-size:24px}#txa p{font-size:13px;color:var(--mut,#9aa);margin:0 0 12px}
#txa input{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--line,#2a3330);border-radius:12px;background:var(--bg,#0d1110);color:inherit;font:16px inherit;margin:4px 0 10px}
#txa button{width:100%;margin:4px 0}#txa .alt{background:none;border:0;color:var(--acc,#4cc2ab);cursor:pointer;font-size:14px;padding:6px}
#txa .msg{min-height:18px;font-size:13px;margin:6px 0 0}#txa .err{color:#ff8a8a}
#txme{white-space:nowrap}#txme i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:var(--acc,#4cc2ab);vertical-align:middle}
#txme[data-s=saving] i{background:#e0b341}#txme[data-s=offline] i,#txme[data-s=error] i{background:#ff8a8a}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');
let mode='in';
function gate(msg,err){let g=$('#txa');if(!g){g=document.createElement('div');g.id='txa';document.body.appendChild(g)}
 const up=mode==='up',pv=(BK.providers||[]).map(p=>`<button class="sbtn" data-oauth="${p}">Continue with ${p[0].toUpperCase()+p.slice(1)}</button>`).join('');
 g.innerHTML=`<form class="bx" id="txf"><h2>${up?'Create your account':'Sign in to Tradéx'}</h2><p>${up?'Your collection is saved to your account, so it’s on every device you sign in on.':'Your collection is saved to your account and syncs across your devices.'}</p>
 <label style="font-size:13px">Email<input id="txe" type="email" autocomplete="email" required></label>
 <label style="font-size:13px">Password<input id="txp" type="password" autocomplete="${up?'new-password':'current-password'}" minlength="8" required></label>
 <button class="sbtn on" type="submit">${up?'Create account':'Sign in'}</button>${pv}
 ${up?'':'<button class="alt" type="button" id="txl">Email me a sign-in link instead</button>'}
 <button class="alt" type="button" id="txm">${up?'Already have an account? Sign in':'New to Tradéx? Create an account'}</button>
 <p class="msg ${err?'err':''}" id="txmsg">${esc(msg||'')}</p></form>`;H.classList.remove('pend')}
const say=(m,err)=>{const e=$('#txmsg');if(e){e.textContent=m;e.className='msg'+(err?' err':'')}};
document.addEventListener('submit',async e=>{if(e.target.id!=='txf')return;e.preventDefault();const email=$('#txe').value.trim(),password=$('#txp').value;say(mode==='up'?'Creating your account…':'Signing in…');
 try{if(mode==='up'){if((await BK.signUp(email,password)).confirm)say('Check your email to confirm your account, then sign in.')}
  else await BK.signIn(email,password)}catch(x){say(/invalid login/i.test(x.message)?'That email and password don’t match an account.':x.message,true)}});
document.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;
 if(t.id==='txm'){mode=mode==='up'?'in':'up';gate();return}
 if(t.id==='txl'){const email=$('#txe').value.trim();if(!email){say('Enter your email first.',true);return}
  try{await BK.emailLink(email);say('Check your email for a sign-in link.')}catch(x){say(x.message,true)}return}
 if(t.dataset.oauth){try{await BK.oauth(t.dataset.oauth)}catch(x){say(x.message,true)}return}
 if(t.id==='txme'){const st={ok:'All changes saved to your account.',saving:'Saving…',offline:'Offline. Changes are kept here and sync when you’re back online.',error:'Couldn’t reach your account. Retrying.'}[state]||'';
  if(await ask(user.email+' · '+st,{ok:'Sign out',danger:true})){await run(async()=>{if(SY&&SY.dirty)await push()}).catch(()=>{});await BK.signOut();
   ['tradex','tradex_sync'].forEach(k=>{try{localStorage.removeItem(k)}catch(x){}});location.reload()}}});
function status(s){state=s;const b=$('#txme');if(b){b.dataset.s=s;b.title={ok:'Saved to your account',saving:'Saving…',offline:'Offline',error:'Sync problem'}[s]||''}}
function me(){let b=$('#txme');if(!b){b=document.createElement('button');b.id='txme';const imp=$('#impb');imp.parentElement.insertBefore(b,imp)}
 b.innerHTML='<i></i>'+esc((user.email||'Account').split('@')[0]);status(state||'ok')}

// ---------- start ----------
async function signedIn(u){if(user&&user.id===u.id)return;user=u;const g=$('#txa');if(g)g.remove();H.classList.remove('pend');me();
 try{await adopt()}catch(e){console.warn('Tradéx sync:',e);status(navigator.onLine?'error':'offline')}}
BK.ready().then(()=>{BK.onChange(signedIn,()=>{if(user)location.reload()});return BK.session()})
 .then(u=>{if(u)signedIn(u);else if(!user)gate()},e=>gate(e.message,true));
})();
