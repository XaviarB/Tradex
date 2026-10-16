/* Tradéx: the "Add cards" search bar. Searches the Tradéx server's card database (every TCGplayer game, with
   today's market prices) and adds a card to the collection or a binder in one tap. Without a Tradéx server it
   is just an "Add card" button that opens the form. */
const TXF={'Pokémon':{Normal:'Non-Holo',Holofoil:'Holo','Reverse Holofoil':'Reverse Holo'},Magic:{Normal:'Non-Foil',Foil:'Foil'},'One Piece':{Normal:'Standard',Foil:'Foil'}};
/* the app's finish name for a TCGplayer price sub-type (Holofoil → Holo for Pokémon); server/games.js has the same table */
const finishFor=(g,sub)=>{if(!sub)return'';const m=TXF[g]||{};if(m[sub])return m[sub];const b=sub.replace(/^(1st Edition|Unlimited|Limited)\s+/,'');return m[b]?(sub.startsWith('1st Edition')?'1st Edition '+m[b]:m[b]):sub};
/* market boxes for a search result in the chosen finish */
const srcOf=(c,sub)=>{const p=(c.prices||{})[sub]||{},o=[];if(p.market!=null)o.push({site:'TCGplayer',label:'Market'+(sub&&sub!=='Normal'?' · '+sub:''),price:p.market,cur:'USD'});if(p.low!=null)o.push({site:'TCGplayer low',label:'Lowest listing',price:p.low,cur:'USD'});return o.length?o:(c.sources||[])};
const txCache=new Map();
async function txSearch(q,game){const k=(game||'')+'|'+q.toLowerCase();if(txCache.has(k))return txCache.get(k);
 const r=await fetch('/api/search?'+new URLSearchParams({q,game:game||''})).then(x=>x.ok?x.json():x.json().then(j=>Promise.reject(new Error(j.error||'Search failed'))));
 if(txCache.size>60)txCache.delete(txCache.keys().next().value);txCache.set(k,r);return r}

(()=>{
const top=document.querySelector('.main .top');if(!top)return;
const box=document.createElement('div');box.className='txa';box.id='txa';
if(!window.TX_SERVER){const b=document.createElement('button');b.type='button';b.textContent='＋ Add card';b.onclick=()=>edit(0);top.lastElementChild.prepend(b);return}
box.innerHTML=`<div class="txin"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
 <input id="txq" type="search" autocomplete="off" spellcheck="false" placeholder="Add cards: search by name, set or number" aria-label="Search every trading card game to add cards" aria-controls="txr" aria-expanded="false">
 <select id="txg" aria-label="Game"><option value="">All games</option>${TXG.map(g=>`<option>${esc(g)}</option>`).join('')}</select></div>
 <div class="txr" id="txr" hidden></div>`;
top.after(box);
const Q=$('#txq'),G=$('#txg'),P=$('#txr');let res=[],seq=0,tmr=null,from='';
const pr=n=>n==null?'—':'$'+(+n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const owned=c=>S.cards.filter(x=>x.src&&String(x.src.tcg)===String(c.tcg)&&c.tcg).reduce((a,x)=>a+x.qty,0);
const dests=c=>{const here=isB(cur)&&(!(S.bg||{})[cur]||S.bg[cur]===c.game)?cur:'';
 const bs=S.binders.filter(b=>isB(b)&&(!(S.bg||{})[b]||S.bg[b]===c.game));
 return `<option value="">Collection</option>${bs.map(b=>`<option value="${esc(b)}" ${b===here?'selected':''}>${esc(b)}</option>`).join('')}<option value="+">＋ New binder…</option>`};
const subs=c=>{const k=Object.keys(c.prices||{});return k.length?k:[c.sub||'']};
function item(c,i){const n=owned(c),ss=subs(c),meta=[c.set,c.num,c.rarity].filter(Boolean).map(esc).join(' · ');
 return `<div class="txi" data-i="${i}" role="option"><span class="txth">${c.imgSm||c.img?`<img src="${esc(c.imgSm||c.img)}" alt="" loading="lazy">`:`<i style="background:${COL[c.game]||COL.Other}"></i>`}</span>
 <div class="txm"><b>${esc(c.name)}</b><small>${meta||'&nbsp;'}</small><small class="txgm"><i style="background:${COL[c.game]||COL.Other}"></i>${esc(c.game)}${c.year?' · '+esc(String(c.year).slice(0,4)):''}${n?` · <em>You own ${n}</em>`:''}</small></div>
 <div class="txc"><select class="txf" aria-label="Finish and price">${ss.map(s=>`<option value="${esc(s)}" ${s===c.sub?'selected':''}>${esc(finishFor(c.game,s)||'Price')} · ${pr(((c.prices||{})[s]||{}).market??(s===c.sub?c.price:null))}</option>`).join('')}</select>
 <select class="txd" aria-label="Add to">${dests(c)}</select><button type="button" class="pri txb">Add</button></div></div>`}
function show(html){P.innerHTML=html;P.hidden=false;Q.setAttribute('aria-expanded','true')}
function hide(){P.hidden=true;Q.setAttribute('aria-expanded','false')}
const SRC={catalog:'TCGplayer prices, updated nightly',live:'Live from Scryfall, the Pokémon TCG API and YGOPRODeck'};
function list(){if(!res.length)return show(`<div class="txe">No cards match “${esc(Q.value.trim())}”. Try fewer words, or <button type="button" class="txh">add it by hand</button>.</div>`);
 show(`<div class="txh0"><span>${res.length} card${res.length===1?'':'s'}${from?' · '+SRC[from]:''}</span><button type="button" class="txh">Add by hand</button></div>${res.map(item).join('')}`)}
async function run(){const q=Q.value.trim(),my=++seq;if(q.length<2){hide();return}
 show('<div class="txe">Searching…</div>');
 try{const r=await txSearch(q,G.value);if(my!==seq)return;res=r.cards||[];from=r.from||'';list()}
 catch(e){if(my===seq)show(`<div class="txe">Couldn’t search right now (${esc(e.message)}). <button type="button" class="txh">Add by hand</button></div>`)}}
Q.addEventListener('input',()=>{clearTimeout(tmr);tmr=setTimeout(run,280)});
Q.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(tmr);run()}else if(e.key==='Escape'){hide();Q.blur()}});
Q.addEventListener('focus',()=>{if(res.length&&Q.value.trim().length>=2)list()});
G.addEventListener('change',()=>{if(Q.value.trim())run()});
document.addEventListener('pointerdown',e=>{if(!P.hidden&&!box.contains(e.target))hide()});
P.addEventListener('change',e=>{const s=e.target.closest('.txd');if(s&&s.value==='+')newBinder(s)});
async function newBinder(sel){const c=res[+sel.closest('.txi').dataset.i],n=await ask('Name your new '+c.game+' binder',{input:1,ok:'Create'});
 if(!n||isB(n)&&(S.bg||{})[n]&&S.bg[n]!==c.game){sel.value='';return}
 if(!S.binders.includes(n)){S.binders.push(n);(S.bg=S.bg||{})[n]=c.game;save();render()}
 sel.innerHTML=dests(c);sel.value=n}
P.addEventListener('click',e=>{
 if(e.target.closest('.txh')){hide();return edit(0)}
 const b=e.target.closest('.txb');if(!b)return;const row=b.closest('.txi'),c=res[+row.dataset.i];
 add(c,row.querySelector('.txf').value,row.querySelector('.txd').value);
 row.querySelector('.txm small:last-child').innerHTML=`<i style="background:${COL[c.game]||COL.Other}"></i>${esc(c.game)} · <em>You own ${owned(c)}</em>`;
 b.textContent='Added ✓';b.disabled=true;setTimeout(()=>{b.textContent='Add';b.disabled=false},1400)});

function add(c,sub,dest){const p=((c.prices||{})[sub]||{}).market??c.price??0,fin=finishFor(c.game,sub);
 if(dest&&!S.binders.includes(dest)){S.binders.push(dest);(S.bg=S.bg||{})[dest]=c.game}
 let x=c.tcg&&S.cards.find(y=>y.src&&y.src.tcg===c.tcg&&(y.src.sub||'')===(sub||'')&&y.cond==='Near Mint'&&!y.grader);
 if(x){x.qty++;if(dest&&!x.binders.includes(dest))x.binders.push(dest)}
 else{x={id:Date.now(),name:c.name,set:c.set||'',num:c.num||'',year:c.year||'',artist:c.artist||'',game:c.game,rarity:c.rarity||'',cond:'Near Mint',finish:fin,grader:'',grade:'',qty:1,paid:0,acquired:'',
  hist:[p||0],histD:[today()],collected:today(),notes:'',binders:dest?[dest]:[],img:c.img||c.imgSm,type:c.type,cost:c.cost,text:c.text,moves:c.moves&&c.moves.length?c.moves:undefined,flavor:c.flavor,
  src:{game:c.game,id:c.id,tcg:c.tcg||undefined,sub:sub||undefined},sources:srcOf(c,sub)};
  Object.keys(x).forEach(k=>x[k]===undefined&&delete x[k]);S.cards.push(x)}
 save();setup();render();toast(x,dest);
 // Fill in rules text, artist and other markets in the background, and load its price history.
 fetch('/api/enrich',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cards:[{game:x.game,name:x.name,set:x.set,num:x.num,finish:x.finish,tcg:x.src.tcg,sub:x.src.sub}]})})
  .then(r=>r.ok?r.json():null).then(r=>{const e=r&&r.cards&&r.cards[0];if(e){mkFill(x,e);save()}}).catch(()=>{}).finally(()=>{if(typeof mkSync==='function')mkSync()})}

let tt=null;
function toast(c,dest){let t=$('#txt');if(!t){t=document.createElement('div');t.id='txt';t.setAttribute('role','status');document.body.appendChild(t)}
 t.innerHTML=`<span>Added <b>${esc(c.name)}</b> to ${esc(dest||'your collection')}${c.qty>1?` (now ×${c.qty})`:''}</span><button type="button" data-tv="${c.id}">View</button>`;
 t.className='on';clearTimeout(tt);tt=setTimeout(()=>{t.className=''},4200)}
document.addEventListener('click',e=>{const v=e.target.closest&&e.target.closest('[data-tv]');if(v){$('#txt').className='';hide();view(+v.dataset.tv)}});
})();
