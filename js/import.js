/* Tradéx: CSV import with automatic column mapping and duplicate merging. */
(()=>{
const $=s=>document.querySelector(s),N=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const AL={name:['simplename','name','cardname','card','productname','title','product'],set:['setname','set','edition','expansion','editionname','group','series'],setcode:['setcode','editioncode','setid','expansioncode'],num:['number','cardnumber','collectornumber','collectorsnumber','no','num','cardno','cardnum'],qty:['quantity','qty','count','owned','totalquantity','amount'],cond:['condition','cond','cardcondition'],finish:['finish','foil','printing','variance','variant','foiling','treatment','subtypename'],price:['marketprice','tcgmarketprice','market','currentprice','marketvalue','tcgplayermarketprice','tcgmarket','pricemarket','myprice','price','value','mid','priceeach'],paid:['purchaseprice','pricepaid','pricebought','averagecostpaid','avgcostpaid','paid','cost','acquiredprice','buyprice','paidprice','purchasecost'],rarity:['rarity'],artist:['artist'],year:['releasedate','year','releaseyear'],grader:['grader','gradingcompany','gradedby','gradingservice','gradecompany'],grade:['grade','gradevalue','graderating','gradenumber'],img:['imageurl','image','imageuri','picture','photourl','imagelink'],sid:['scryfallid'],game:['game','tcg','category','gamename','categoryname','tcgname']};
const GR=/\b(PSA|BGS|BVG|CGC|SGC|TAG|HGA|ACE|AGS|CSG|GMA|ISA|KSA|Ludex|MNT|PCA)\b\s*([\d.]+|[A-Za-z]+)?/i;
function parse(t){t=t.replace(/^\uFEFF/,'');const f0=t.split(/\r?\n/)[0]||'',d=[',',';','\t'].map(x=>[x,f0.split(x).length]).sort((a,b)=>b[1]-a[1])[0][0],rows=[];let r=[],f='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}else if(ch==='"')q=true;else if(ch===d){r.push(f);f=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(f);f='';if(r.some(x=>x.trim()))rows.push(r);r=[]}else f+=ch}
 r.push(f);if(r.some(x=>x.trim()))rows.push(r);return rows}
function map(h){const n=h.map(N),m={};for(const k in AL){for(const a of AL[k]){const i=n.findIndex((x,ix)=>x&&(x===a||(a.length>=8&&x.startsWith(a)))&&!Object.values(m).includes(ix));if(i>=0){m[k]=i;break}}}return m}
const ng=v=>{const x=N(v);return /magic|mtg/.test(x)?'Magic':/pokemon/.test(x)?'Pokémon':/yugi/.test(x)?'Yu-Gi-Oh!':/onepiece/.test(x)?'One Piece':String(v||'').trim()};
const nc=v=>{const x=N(v);return !x?'Near Mint':/^(mp|moderately|played|good|gd|vg)/.test(x)?'Moderately Played':/^(lp|lightly|slightly|sp|excellent|ex)/.test(x)?'Lightly Played':/^(hp|heavily|poor|fair)/.test(x)?'Heavily Played':/^(dmg|damaged)/.test(x)?'Damaged':'Near Mint'};
const nf=v=>{const x=String(v||'').trim().toLowerCase();if(!x||/^(no|false|normal|nonfoil|non-foil|0|n|none)$/.test(x))return'';if(/^(yes|true|1|foil|y)$/.test(x))return'Foil';return x.replace(/\b\w/g,c=>c.toUpperCase())};
const mn=v=>{let x=String(v||'');if(/^\D*\d+,\d{1,2}\D*$/.test(x))x=x.replace(',','.');const n=parseFloat(x.replace(/[^0-9.]/g,''));return isFinite(n)?n:0};
let ROWS=[],MAP={};
function build(){const dg=$('#img_').value,who=$('#imw').value.trim(),out=[];let skip=0;
 for(const r of ROWS){const g=k=>MAP[k]!=null?String(r[MAP[k]]||'').trim():'';const name=g('name');if(!name){skip++;continue}
  let grader=g('grader'),grade=g('grade'),gm=GR.exec(grade);if(gm){grader=grader||gm[1].toUpperCase();grade=gm[2]||''}else if(/^(ungraded|raw|none|n\/a|-)?$/i.test(grade))grade='';else if(!grader)grade=grade;
  if(/^(ungraded|raw|none)$/i.test(grader))grader='';
  let set=g('set');const game=g('game')?ng(g('game')):g('sid')?'Magic':dg;let sc=g('setcode');if(!sc&&game==='Magic'&&/^[a-z0-9]{2,5}$/i.test(set))sc=set;if(!set&&sc)set=sc.toUpperCase();
  const price=mn(g('price')),yr=g('year'),t=new Date().toISOString().slice(0,10);
  out.push({id:Date.now()+out.length,name,set,num:g('num'),year:/^\d{4}$/.test(yr)?yr+'-01-01':yr.slice(0,10),artist:g('artist'),game,rarity:g('rarity'),cond:nc(g('cond')),finish:nf(g('finish')),grader:grader,grade:grader?grade:'',qty:Math.max(1,parseInt(g('qty'))||1),paid:mn(g('paid')),hist:[price],histD:[t],collected:t,binders:[],notes:'',img:/^https?:/.test(g('img'))?g('img'):undefined,who:who||undefined,_sc:sc,_sid:g('sid')})}
 return{out,skip}}
const key=c=>[c.game,c.name,c.set,c.num,c.cond,c.finish,c.grader,c.grade].map(x=>String(x||'').toLowerCase()).join('|');
function preview(){const el=$('#imp');if(!ROWS.length){el.innerHTML='';$('#imgo').disabled=true;return}
 const {out,skip}=build(),names=Object.entries(MAP).map(([k,i])=>k+' ← “'+ROWS.hdr[i]+'”').join(', ');
 el.innerHTML=`<p style="font-size:13px"><b>${out.length}</b> cards found${skip?`, ${skip} blank rows skipped`:''}.</p><p style="font-size:12px;color:var(--mut);word-break:break-word">Matched columns: ${esc(names)||'none'}</p>${MAP.name==null?'<p style="color:#ff8a8a;font-size:13px">No card name column found. Check the first row of your file has headers.</p>':''}<div style="overflow-x:auto"><table><tr style="color:var(--mut)"><td>Card</td><td>Set</td><td>#</td><td>Qty</td><td>Cond.</td><td>Price</td></tr>${out.slice(0,6).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.set)}</td><td>${esc(c.num)}</td><td>${c.qty}</td><td>${esc(c.cond)}</td><td>${c.hist[0]?money(c.hist[0]):'—'}</td></tr>`).join('')}</table></div>`;
 $('#imgo').disabled=!out.length||MAP.name==null}
function load(t){const rows=parse(t);if(rows.length<2){ROWS=[];preview();return}const h=rows.shift();MAP=map(h);ROWS=rows;ROWS.hdr=h;preview()}
function open(){const d=$('#dImp'),gl=[...new Set([...Object.keys(GK),'Yu-Gi-Oh!',...S.cards.map(c=>c.game).filter(Boolean)])];
 d.innerHTML=`<h2 style="margin:0 0 6px">Import a collection</h2><p style="font-size:13px;color:var(--mut);margin:0 0 8px">Export a CSV from any collection app (TCGplayer, Collectr, ManaBox, Moxfield, Deckbox, Dragon Shield and most others), then drop it here. Columns are matched automatically.</p>
 <input type="file" id="imf" accept=".csv,.tsv,.txt,text/csv,text/plain"><textarea id="imt" rows="3" placeholder="…or paste the CSV text here"></textarea>
 <label style="font-size:13px;color:var(--mut)">Game, when the file doesn’t say</label><select id="img_" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:inherit;font-size:16px;margin:4px 0 8px">${gl.map(g=>`<option>${esc(g)}</option>`).join('')}</select>
 <label style="font-size:13px;color:var(--mut)">Customer or source name (optional)</label><input id="imw" placeholder="e.g. Sam’s trade binder">
 <label style="font-size:13px;display:flex;gap:8px;align-items:center;margin:4px 0 8px"><input type="checkbox" id="imm" checked style="width:auto;margin:0"> Merge duplicates (add quantities)</label>
 <div id="imp"></div><p id="imst" style="font-size:12px;color:var(--mut);margin:6px 0"></p><div class="r"><button class="sbtn on" id="imgo" disabled>Import</button><button class="sbtn g" id="imx">Close</button></div>`;
 ROWS=[];d.showModal()}
async function enrich(cs){const st=$('#imst');
 if(!window.TX_SERVER){st.textContent='Imported. Card images, rules text and live prices fill in automatically when you run the Tradéx server.';return}
 let done=0;for(let i=0;i<cs.length;i+=40){const part=cs.slice(i,i+40);st.textContent='Looking up card details… '+done+' / '+cs.length;
  try{const r=await fetch('/api/enrich',{method:'POST',headers:{'content-type':'application/json','x-owner':localStorage.getItem('tradex_pw')||''},body:JSON.stringify({cards:part.map(c=>({game:c.game,name:c.name,set:c.set,setcode:c._sc,num:c.num,sid:c._sid,finish:c.finish}))})}).then(x=>x.json());
   (r.cards||[]).forEach((e,j)=>{const c=part[j];if(!e)return;['img','type','cost','text','flavor','moves','artist','year','sources'].forEach(k=>{if(e[k]&&!c[k])c[k]=e[k]});if(e.rarity&&!c.rarity)c.rarity=e.rarity;if(e.set&&(!c.set||c.set.toLowerCase()===(c._sc||'').toLowerCase()))c.set=e.set;if(!c.num&&e.num)c.num=e.num;c.src={game:e.game,id:e.id};if(!c.hist[0]&&e.price)c.hist=[e.price]})}catch(x){}
  done+=part.length;save();render()}
 st.textContent='Done. Added card details and prices where a match was found.'}
async function refresh(c){const r=await fetch('/api/enrich',{method:'POST',headers:{'content-type':'application/json','x-owner':localStorage.getItem('tradex_pw')||''},body:JSON.stringify({cards:[{game:c.game,name:c.name,set:c.set,num:c.num,finish:c.finish,sid:c.src&&c.src.id&&c.game==='Magic'?c.src.id:undefined}]})}).then(x=>x.json()),e=(r.cards||[])[0];if(!e)throw new Error('No match found');
 if(e.sources&&e.sources.length){c.sources=e.sources;c.srcAt=Date.now()}if(e.img&&!c.img)c.img=e.img;if(e.flavor&&!c.flavor)c.flavor=e.flavor;if(e.price){c.hist.push(e.price);(c.histD=c.histD||[]).push(new Date().toISOString().slice(0,10))}save()}
document.addEventListener('click',async e=>{
 const mk=e.target.closest('[data-mkr]');if(mk&&!window.TX_SERVER){const m=$('#rfm');if(m){m.textContent='Live refresh runs on your Tradéx server';setTimeout(()=>{m.textContent=''},2600)}return}if(mk){const c=S.cards.find(x=>String(x.id)===mk.dataset.mkr);if(!c)return;const m=$('#rfm');if(m)m.textContent='';mk.disabled=true;try{await refresh(c);$('#vp').innerHTML=panel(c);render()}catch(x){mk.disabled=false;if(m)m.textContent='Couldn’t refresh: '+x.message}return}
 if(e.target.closest('#impb')){open();return}
 if(e.target.closest('#imx')){$('#dImp').close();return}
 if(e.target.closest('#imgo')){const {out}=build(),merge=$('#imm').checked,fresh=[];let merged=0;
  for(const c of out){const ex=merge&&(S.cards.find(x=>key(x)===key(c)&&!!x.who===!!c.who&&(x.who||'')===(c.who||''))||fresh.find(x=>key(x)===key(c)));if(ex){ex.qty+=c.qty;merged++}else fresh.push(c)}
  S.cards.push(...fresh);fresh.forEach(c=>{c.binders=[]});save();render();
  $('#imp').innerHTML=`<p style="color:var(--acc)">Imported ${fresh.length} new card${fresh.length===1?'':'s'}${merged?`, merged ${merged} duplicate${merged===1?'':'s'}`:''}.</p>`;$('#imgo').disabled=true;enrich(fresh)}});
document.addEventListener('change',async e=>{if(e.target.id==='imf'&&e.target.files[0]){load(await e.target.files[0].text())}else if(e.target.id==='img_')preview()});
document.addEventListener('input',e=>{if(e.target.id==='imt')load(e.target.value);else if(e.target.id==='imw')preview()});
})();
