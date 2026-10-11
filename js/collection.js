/* Tradéx: Main UI: dashboard, collection grid, binder spreads, game filter panel, cover images, confirm dialog. */
const OG=new Set(),GF={},TOP=4,CS=new Set(),PNL={open:false},resetGF=()=>{Object.assign(GF,{q:'',sort:'price',dir:'d',state:'all',notes:'all',slab:'all',sel:{}})};resetGF();let GCN=0,cur='dash',spread=0,editId=null,pend={},R=[];const PER=9;
function setup(){
 opts($('#fg'),'All games',[...new Set(S.cards.map(c=>c.game))]);
 opts($('#fr'),'All rarities',RAR);opts($('#fc'),'All conditions',CON);
}
const cb=c=>{const p=pct(c);return `<button class="card" data-id="${c.id}"><div class="face" style="${face(c)}"><span>${esc(c.set)} · ${esc(c.num)}</span><b>${esc(c.name)}</b>${c.qty>1?`<i class="qty">×${c.qty}</i>`:''}${c.grader?`<i class="slab">${esc(c.grader)}${c.grade?' '+esc(c.grade):''}</i>`:''}</div><div class="meta"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.rarity)}${c.finish?' · '+esc(c.finish):''}</span><strong>${money(val(c))} <span class="${p>=0?'up':'down'}">${p>=0?'▲':'▼'}${Math.abs(p).toFixed(0)}%</span></strong></div></button>`};
const pk=c=>c?`<button class="card pk" data-id="${c.id}" title="${esc(c.name)} · ${money(val(c))}"><div class="face" style="${face(c)}"><b>${esc(c.name)}</b>${c.qty>1?`<i class="qty">×${c.qty}</i>`:''}</div></button>`:'<div class="slot"></div>';
function render(){
 if(!isB(cur)&&cur!=='dash'&&cur!=='coll')cur='dash';
 const bin=isB(cur),nv=(v,l)=>`<button data-v="${esc(v)}" class="${cur===v?'on':''}">${esc(l)}</button>`;
 $('#nav').innerHTML=nv('dash','Dashboard')+nv('coll','Collection')+'<small>BINDERS</small>'+(()=>{const gs={};S.binders.filter(isB).forEach(b=>{const g=(S.bg||{})[b]||'Other';(gs[g]=gs[g]||[]).push(b)});return Object.keys(gs).sort().map(g=>`<small class="bgh">${esc(g)}</small>`+gs[g].map(b=>nv(b,b)).join('')).join('')})()+'<button id="nb">+ New binder</button>';
 $('#title').textContent=bin?cur:cur==='dash'?'Dashboard':'Collection';$('#crumb').textContent=bin?'Binders ›':'';
 $('#ft').hidden=$('#q').hidden=cur==='dash';
 {const gs=[...new Set(S.cards.filter(c=>!bin||c.binders.includes(cur)).map(c=>c.game))].sort(),cg=$('#fg').value,n=g=>S.cards.filter(c=>(!bin||c.binders.includes(cur))&&(!g||c.game===g)).reduce((a,c)=>a+c.qty,0);
  $('#gchips').hidden=cur==='dash'||bin||gs.length<2&&!cg;
  $('#gchips').innerHTML=`<button data-g="" class="${cg?'':'on'}">All games<small>${n('')}</small></button>`+gs.map(g=>`<button data-g="${esc(g)}" class="${cg===g?'on':''}">${esc(g)}<small>${n(g)}</small></button>`).join('')}if(cur==='dash')$('#fp').hidden=true;
 const q=$('#q').value.toLowerCase(),fg=bin?'':$('#fg').value,fr=$('#fr').value,fc=$('#fc').value,[sk,sd]=$('#sort').value.split('-'),gp=$('#grp').value,F=cur!=='dash';
 let L=S.cards.filter(c=>(cur!=='dash'||!OG.size||OG.has(c.game||'Other'))&&(!bin||c.binders.includes(cur))&&(!F||(!fg||c.game===fg)&&(!fr||c.rarity===fr)&&(!fc||c.cond===fc)&&(!q||[c.name,c.set,c.artist].join(' ').toLowerCase().includes(q))));
 const key={collected:c=>c.collected,qty:c=>c.qty,value:c=>val(c)*c.qty,name:c=>c.name,year:c=>c.year}[sk];
 L.sort((a,b)=>{const x=key(a),y=key(b);return(x>y?1:x<y?-1:0)*(sd==='d'?-1:1)});
 if(gp)L.sort((a,b)=>String(a[gp]??'').localeCompare(String(b[gp]??'')));
 const qty=L.reduce((s,c)=>s+c.qty,0),tv=L.reduce((s,c)=>s+val(c)*c.qty,0),tp=L.reduce((s,c)=>s+c.paid*c.qty,0),g=tv-tp;
 const top=[...L].sort((a,b)=>val(b)-val(a)).slice(0,2),most=[...L].sort((a,b)=>b.qty-a.qty)[0];
 const pages=bin?Math.max((S.meta||{})[cur]||10,Math.ceil(L.length/PER)):0,pockets=pages*PER,fill=bin?Math.round(L.length/pockets*100):0;
 $('#stats').innerHTML=`${bin?'':`<div class="sc"><small>Owned</small><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b class="n">${bin?L.length:qty}</b> <span style="color:var(--mut)">${bin?`of ${pockets} pockets`:`cards · ${L.length} unique`}</span></div>${bin?`<div class="ring" style="--p:${fill}"><span>${fill}%</span></div>`:''}</div>${bin?`<div class="r2"><span>Pages</span><span>${pages}</span></div>`:''}</div>`}
 <div class="sc"><small>Market value</small><b class="n">${money(tv)}</b>${top.map(c=>`<div class="r2"><span>${esc(c.name)} <span style="color:var(--mut)">${esc(c.set)}</span></span><b>${money(val(c))}</b></div>`).join('')}</div>
 <div class="sc"><small>Gain vs. paid</small><b class="n ${g>=0?'up':'down'}">${g>=0?'+':'−'}${money(Math.abs(g))}</b>${most?`<div class="r2"><span>Most owned</span><span>${esc(most.name)} ×${most.qty}</span></div>`:''}</div>`;$('#stats').classList.toggle('two',bin);
 let h='';
 if(cur==='dash'){h=L.length?(()=>{const gs={};L.forEach(c=>{const g=c.game||'Other';(gs[g]=gs[g]||[]).push(c)});
   return Object.keys(gs).sort().map(g=>{const all=gs[g].sort((x,y)=>val(y)-val(x)),open=OG.has(g);let a=all;
    if(open){a=all.filter(c=>gfPass(c,g));const m=GF.dir==='d'?-1:1;a=[...a].sort((x,y)=>{const p=SK(x,g),q=SK(y,g);return(p>q?1:p<q?-1:0)*m});GCN=a.length}
    const n=a.reduce((t,c)=>t+c.qty,0),tv=a.reduce((t,c)=>t+val(c)*c.qty,0),sh=open?a:a.slice(0,TOP);
    const nf=open?(GF.q?1:0)+(GF.state!=='all'?1:0)+(GF.notes!=='all'?1:0)+(GF.slab!=='all'?1:0)+Object.values(GF.sel).filter(x=>x.size).length:0;
    const cards=sh.map(cb).join('')||'<div class="empty" style="grid-column:1/-1">No cards match these filters.</div>';
    return `<div class="gh gx"><span class="gt">${esc(g)} <span class="gm">· ${n} card${n===1?'':'s'} · ${money(tv)}${open?'':` · top ${sh.length} by value`}</span></span><span class="gb"><button class="${open&&PNL.open?'pri':''}" data-gx="${esc(g)}">Filters${nf?` (${nf})`:''}</button>${open?`<button data-gxx="1">✕ All games</button>`:''}</span></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(${open?230:170}px,1fr))">${cards}</div>`}).join('')})():'<div class="empty">Add your first card to get started.</div>'}
 else if(bin){const maxS=Math.floor(pages/2);spread=Math.min(Math.max(spread,0),maxS);
  const pg=n=>n>pages?'<div class="pgbox"></div>':`<div class="pgbox">${Array.from({length:PER},(_,i)=>pk(L[(n-1)*PER+i])).join('')}</div>`;
  const left=spread===0?`<div class="pgbox cover"${cvs('b:'+cur)}><div><small>BINDER</small><h2>${esc(cur)}</h2><div>${L.length} cards · ${money(tv)}</div>${IMG('b:'+cur)?'':`<button data-img="b:${esc(cur)}" style="margin-top:14px">Add cover image</button>`}</div></div>`:pg(spread*2);
  h=`<div class="spread">${left}${pg(spread*2+1)}</div><div class="pager">${IMG('b:'+cur)?`<button data-img="b:${esc(cur)}">Change cover image</button><button data-imgclr="b:${esc(cur)}">Remove image</button>`:''}<button data-sp="-1" ${spread<=0?'disabled':''} aria-label="Previous">‹</button><span>${spread===0?'Cover – Page 1':`Pages ${spread*2} – ${spread*2+1}`}</span><button data-sp="1" ${spread>=maxS?'disabled':''} aria-label="Next">›</button><button id="rs">Resize binder</button></div>`}
 else if(!L.length)h='<div class="empty">Nothing here yet. Add a card, or clear your filters.</div>';
 else{let last=null;const cn={};if(gp)L.forEach(c=>cn[c[gp]]=(cn[c[gp]]||0)+c.qty);h='<div class="grid">';for(const c of L){if(gp&&c[gp]!==last){last=c[gp];h+=`<div class="gh">${esc(last||'Other')} <span style="color:var(--mut);font-weight:400">· ${cn[last]} card${cn[last]===1?'':'s'}</span></div>`}h+=cb(c)}h+='</div>'}
 if(cur==='coll'){const k=cur,u=IMG(k),nm='collection';h=`<div style="position:relative;border-radius:14px;overflow:hidden;margin:0 0 14px;min-height:${u?170:64}px;border:1px solid var(--line);${u?`background:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.45)),url('${esc(u)}') center/cover`:'background:var(--sleeve)'}"><div style="position:absolute;right:10px;bottom:10px;display:flex;gap:6px"><button data-img="${k}">${u?'Change':'Add'} ${nm} image</button>${u?`<button data-imgclr="${k}">Remove image</button>`:''}</div></div>`+h}
 const di=cur==='dash'&&IMG('dash');document.body.classList.toggle('dbg',!!di);bgpos();bgd.style.backgroundImage=di?`linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.55)),url('${di}')`:'none';
 $('#body').innerHTML=h;cnt();if(cur!=='dash'&&PNL.open){PNL.open=false;pnl()}
}

const FC={'Pokémon':[['ctype','Card type',['Pokémon','Trainer','Energy']],['etype','Energy type',['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Fairy','Dragon','Colorless']],['ttype','Trainer type',['Supporter','Item','Tool','Stadium','Technical Machine']],['stage','Stage',['Basic','Stage 1','Stage 2','VMAX','VSTAR','V','ex']]],
'Magic':[['ctype','Card type',['Creature','Artifact','Instant','Sorcery','Enchantment','Land','Planeswalker']],['color','Color',['White','Blue','Black','Red','Green','Colorless']]],
'Yu-Gi-Oh!':[['ctype','Card type',['Monster','Spell','Trap']],['attr','Attribute',['Dark','Light','Earth','Water','Fire','Wind','Divine']],['mtype','Monster type',['Dragon','Spellcaster','Warrior','Fiend','Machine','Zombie','Beast','Fairy','Aqua','Pyro']]],
'One Piece':[['color','Color',['Red','Green','Blue','Purple','Black','Yellow']],['ctype','Card type',['Leader','Character','Event','Stage']]],
'Sports':[['sport','Sport',['Baseball','Basketball','Football','Hockey','Soccer']]]};
const KN={'Charizard':{ctype:['Pokémon'],etype:['Fire'],stage:['Stage 2']},'Blastoise':{ctype:['Pokémon'],etype:['Water'],stage:['Stage 2']},'Pikachu Illustrator':{ctype:['Trainer'],ttype:['Item']},'Blue-Eyes White Dragon':{ctype:['Monster'],attr:['Light'],mtype:['Dragon']},'Black Lotus':{ctype:['Artifact'],color:['Colorless']},'Llanowar Elves':{ctype:['Creature'],color:['Green']}};
const MCL={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
function fv(c,k,opts){const kn=(KN[c.name]||{})[k];if(kn)return kn;const t=c.type||'';
 if(k==='color'&&c.game==='Magic'){const x=[...new Set((c.cost||'').replace(/[^WUBRG]/g,''))].map(z=>MCL[z]);return x.length?x:['Colorless']}
 const r=opts.filter(o=>new RegExp('(^|[^a-z])'+o+'([^a-z]|$)','i').test(t));if(k==='ctype'&&c.moves&&!r.length&&c.game==='Pokémon')return['Pokémon'];return r}
function gfPass(c,g){const F=FC[g]||[];
 if(GF.q&&![c.name,c.set,c.artist,c.num].join(' ').toLowerCase().includes(GF.q.toLowerCase()))return false;
 if(GF.state==='dup'&&c.qty<2||GF.state==='single'&&c.qty>1||GF.state==='up'&&pct(c)<0||GF.state==='down'&&pct(c)>=0)return false;
 if(GF.notes==='has'&&!c.notes||GF.notes==='none'&&c.notes)return false;
 if(GF.slab==='slab'&&!c.grader||GF.slab==='raw'&&c.grader)return false;
 for(const [k,v] of Object.entries(GF.sel)){if(!v.size)continue;let x;if(k==='rarity')x=[c.rarity];else if(k==='cond')x=[c.cond];else if(k==='finish')x=[c.finish||''];else if(k==='set')x=[c.set];else if(k==='grader')x=[c.grader||''];else if(k==='grade')x=[c.grade||''];else{const f=F.find(f=>f[0]===k);x=f?fv(c,k,f[2]):[]}if(!x.some(y=>v.has(y)))return false}
 return true}
const SK=(c,g)=>{const s=GF.sort;return s==='release'?c.year||'':s==='name'?c.name:s==='artist'?c.artist||'':s==='num'?parseInt(c.num)||0:s==='price'?val(c):s==='qty'?c.qty:(fv(c,s,((FC[g]||[]).find(f=>f[0]===s)||[0,0,[]])[2])[0]||'')};
function cnt(){const b=$('#gcount');if(b)b.textContent='Show Results ('+GCN+')'}
function pnl(){const g=[...OG][0],el=$('#gfp');if(!g||!PNL.open||cur!=='dash'){PNL.open=false;el.hidden=true;document.body.classList.remove('gf-on');return}
 const all=S.cards.filter(c=>(c.game||'Other')===g),F=FC[g]||[],sc=(el.querySelector('.pb')||{}).scrollTop||0;
 const chip=(on,at,l,n,dis)=>`<button class="ch${on?' on':''}${dis?' dim':''}" ${at} ${dis?'disabled':''}>${esc(l)}${n!=null?`<small>${n}</small>`:''}</button>`;
 const sec=(id,t,body)=>`<div class="gs"><button class="gsh" data-cs="${id}" aria-expanded="${!CS.has(id)}">${t}<span>${CS.has(id)?'▾':'▴'}</span></button>${CS.has(id)?'':`<div class="chs">${body}</div>`}</div>`;
 const ms=(k,opts,get)=>opts.map(o=>{const n=all.filter(c=>get(c).includes(o)).length;return chip((GF.sel[k]||new Set()).has(o),`data-ms="${k}" data-v="${esc(o)}"`,o,n,!n)}).join('');
 const one=(k,arr)=>arr.map(([v,l])=>chip(GF[k]===v,`data-s="${k}" data-v="${v}"`,l)).join('');
 const so=[['release','Release date'],['name','Name'],['artist','Artist'],['num','Number'],['price','Price'],['qty','Quantity'],...(F[1]?[[F[1][0],F[1][1]]]:[])];
 el.innerHTML=`<div class="ph"><h2>Filters <small>${esc(g)}</small></h2><button data-pc="x" aria-label="Close">✕</button></div><div class="pb"><input type="search" id="gq" placeholder="Search name, set, artist" value="${esc(GF.q)}">`+
 sec('sort','SORT BY',so.map(([k,l])=>chip(GF.sort===k,`data-sort="${k}"`,l+(GF.sort===k?(GF.dir==='d'?' ↓':' ↑'):''))).join('')+'<p class="hint">Tap the selected field again to flip the order.</p>')+
 sec('state','CARD STATE',one('state',[['all','All'],['dup','Duplicate cards owned'],['single','Single copies'],['up','Gaining value'],['down','Losing value']]))+
 sec('slab','SLABS & GRADING',one('slab',[['all','All'],['slab','Slabs only'],['raw','Raw only']])+'<p class="hint" style="width:100%;margin:8px 0 2px">Grading company (BGS = Beckett)</p>'+ms('grader',GRADERS,c=>[c.grader||''])+'<p class="hint" style="width:100%;margin:8px 0 2px">Grade</p>'+(()=>{const gl=[...new Set(all.map(c=>c.grade).filter(Boolean))].sort((a,b)=>(parseFloat(b)||0)-(parseFloat(a)||0)||a.localeCompare(b));return gl.length?ms('grade',gl,c=>[c.grade||'']):'<span class="hint">No graded cards yet. Add a company and grade when editing a card.</span>'})())+
 sec('notes','NOTES',one('notes',[['all','All'],['has','Has notes'],['none',"Doesn't have notes"]]))+
 F.map(f=>sec(f[0],f[1].toUpperCase(),ms(f[0],f[2],c=>fv(c,f[0],f[2])))).join('')+
 sec('rarity','RARITY',ms('rarity',RAR,c=>[c.rarity]))+sec('cond','CONDITION',ms('cond',CON,c=>[c.cond]))+
 sec('finish',g==='Magic'?'FOIL':'FINISH',ms('finish',finOf(g),c=>[c.finish||'']))+sec('set','SET',ms('set',[...new Set(all.map(c=>c.set))].sort(),c=>[c.set]))+
 `</div><div class="pf"><button class="pri" data-pc="x" id="gcount"></button><button data-pc="clear">Clear Filters</button></div>`;
 el.hidden=false;document.body.classList.add('gf-on');el.querySelector('.pb').scrollTop=sc;cnt()}
const bgd=document.createElement('div');bgd.id='dbgimg';bgd.setAttribute('data-ed-ui','');document.body.appendChild(bgd);
const bgpos=()=>{const sd=document.querySelector('.side'),w=sd&&!matchMedia('(max-width:760px)').matches?sd.getBoundingClientRect().width:0;bgd.style.left=w+'px'};addEventListener('resize',bgpos);
const cvs=k=>IMG(k)?` style="background:linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.6)),url('${esc(IMG(k))}') center/cover"`:'';
const fi=document.createElement('input');fi.type='file';fi.accept='image/*';fi.hidden=true;document.body.appendChild(fi);let imgKey=null;
function pickImg(k){imgKey=k;fi.value='';fi.click()}
fi.onchange=()=>{const f=fi.files[0];if(!f||!imgKey)return;const k=imgKey,mx=k==='dash'?1800:k==='coll'?1400:900,r=new FileReader();
 r.onload=()=>{const im=new Image();im.onload=()=>{const sc=Math.min(1,mx/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*sc);cv.height=Math.round(im.height*sc);
  const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height);
  S.img=S.img||{};const old=S.img[k];S.img[k]=cv.toDataURL('image/jpeg',.82);
  try{localStorage.setItem('tradex',JSON.stringify(S))}catch(e){if(old)S.img[k]=old;else delete S.img[k];alert('That image is too big to save in this browser. Try a smaller one.');return}
  render()};im.onerror=()=>alert('Could not read that image.');im.src=r.result};r.readAsDataURL(f)};
function ask(t,o={}){return new Promise(res=>{const d=$('#dAsk'),i=$('#aI'),ok=$('#aO'),end=v=>{d.close();res(v)};
 $('#aT').textContent=t;i.hidden=!o.input;i.value=o.def||'';ok.textContent=o.ok||'OK';ok.style.background=ok.style.borderColor=o.danger?'var(--acc2)':'';
 ok.onclick=()=>end(o.input?i.value.trim():true);$('#aC').onclick=()=>end(null);i.onkeydown=e=>{if(e.key==='Enter')ok.click()};d.oncancel=()=>res(null);d.showModal();if(o.input)i.focus()})}
