/* Tradéx: live market data from the Tradéx server's card database (only on a Tradéx server, window.TX_SERVER).
   - Links cards to their TCGplayer printing (c.src.tcg and the price sub-type c.src.sub, e.g. Holofoil).
   - Updates each linked card's market price from the nightly TCGplayer prices.
   - Loads daily price history for the charts, and draws the collection value chart on the dashboard. */
const MKT={hist:{},range:365,busy:false};
const mkKey=c=>c&&c.src&&c.src.tcg?c.src.tcg+'|'+(c.src.sub||''):null;
const mkPost=(u,b)=>fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status)));
const dayOf=d=>String(d||'').slice(0,10);

// A card's prices over time: what this browser recorded (c.hist/c.histD) merged with the server's daily history,
// newest last. days limits it to the last n days.
function series(c,days){ensureD(c);const m=new Map(),own=c.hist.filter(x=>x>0).length;
 c.histD.forEach((d,i)=>{if(c.hist[i]>0||!own)m.set(dayOf(d),+c.hist[i])});
 const h=MKT.hist[mkKey(c)];if(h)h.d.forEach((d,i)=>{if(h.v[i]!=null)m.set(dayOf(d),+h.v[i])});
 let d=[...m.keys()].sort();if(days){const lo=new Date(Date.now()-days*864e5).toISOString().slice(0,10),k=d.filter(x=>x>=lo);d=k.length?k:d.slice(-1)}
 return{hist:d.map(k=>m.get(k)),histD:d}}

const RANGES=[[30,'1M'],[90,'3M'],[180,'6M'],[365,'1Y'],[0,'All']];
const rangeBar=()=>`<span class="rng" role="group" aria-label="Chart range">${RANGES.map(([d,l])=>`<button type="button" data-rng="${d}" class="${MKT.range===d?'on':''}" aria-pressed="${MKT.range===d}">${l}</button>`).join('')}</span>`;
const cardChart=c=>chart(c,{days:MKT.range});

// Value of the cards shown on the dashboard, day by day: each card's price on that day (or its nearest known price) × copies.
function valueSeries(L){const S2=L.map(c=>({q:c.qty||1,s:series(c,MKT.range)})).filter(x=>x.s.hist.length);
 const days=[...new Set(S2.flatMap(x=>x.s.histD))].sort();if(!days.length)return{hist:[],histD:[]};
 const tot=days.map(()=>0);for(const {q,s} of S2){let j=0;days.forEach((d,i)=>{while(j<s.histD.length-1&&s.histD[j+1]<=d)j++;tot[i]+=q*s.hist[j]})}
 return{hist:tot.map(x=>Math.round(x*100)/100),histD:days}}
function valueCard(L){if(!L.length)return'';const v=valueSeries(L);if(v.hist.length<2&&!S.cards.some(c=>c.src&&c.src.tcg))return'';
 const a=v.hist[0],b=v.hist[v.hist.length-1],p=a?(b-a)/a*100:0;
 return `<div class="vcard"><div class="vch"><div><small>COLLECTION VALUE</small><b class="n">${money(b)}</b>${v.hist.length>1?` <span class="${p>=0?'up':'down'}">${p>=0?'▲':'▼'}${Math.abs(p).toFixed(1)}%</span>`:''}</div>${rangeBar()}</div>
 <div class="vcb">${v.hist.length>1?chart(v,{W:innerWidth<760?480:900,H:230,label:'Collection value',axis:'Value (USD)'}):'<div class="note">Your collection’s value chart fills in as daily market prices come in.</div>'}</div>
 <p class="note">Value of the cards you own now, using TCGplayer market prices for linked cards and your own recorded prices for the rest.</p></div>`}

document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-rng]');if(!b)return;MKT.range=+b.dataset.rng;try{localStorage.setItem('tradex_rng',MKT.range)}catch(x){}
 if($('#dView').open&&vid!=null){const c=cur_();if(c&&$('#phb')){$('#phb').innerHTML=cardChart(c);$('#vp').querySelectorAll('[data-rng]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)})}}
 if(cur==='dash')render()});
try{const r=localStorage.getItem('tradex_rng');if(r!=null&&RANGES.some(x=>String(x[0])===r))MKT.range=+r}catch(e){}

// Links cards without a TCGplayer printing (typed in, imported, or from before the card database) to one, 40 at a time.
async function mkLink(){const L=S.cards.filter(c=>c.name&&!(c.src&&c.src.tcg)&&c.srcTry!==today()).slice(0,200);let n=0;
 for(let i=0;i<L.length;i+=40){const part=L.slice(i,i+40);let r;try{r=await mkPost('/api/enrich',{cards:part.map(c=>({game:c.game,name:c.name,set:c.set,num:c.num,finish:c.finish}))})}catch(e){return n}
  (r.cards||[]).forEach((e,j)=>{const c=part[j];if(!e||!e.tcg){c.srcTry=today();return}
   c.src={...(c.src||{}),game:e.game,tcg:e.tcg,sub:e.sub};delete c.srcTry;n++;
   if(e.img&&!c.img)c.img=e.img;if(e.sources&&e.sources.length)c.sources=e.sources;
   if(e.price&&!(val(c)>0)){c.hist=[e.price];c.histD=[today()]}})}
 return n}

// Today's market price for every linked card. A new price is added to the card's own history.
async function mkPrices(){const L=S.cards.filter(c=>c.src&&c.src.tcg);if(!L.length)return 0;
 const r=await mkPost('/api/prices',{items:L.map(c=>({tcg:c.src.tcg,sub:c.src.sub}))});let n=0;
 for(const c of L){const p=(r.prices||{})[mkKey(c)];if(!p||p.market==null)continue;ensureD(c);
  const last=c.histD[c.histD.length-1],d=dayOf(p.day)||today();
  if(c.hist.length===1&&!(c.hist[0]>0)){c.hist=[p.market];c.histD=[d];n++}
  else if(c.hist[c.hist.length-1]!==p.market){if(dayOf(last)<d){c.hist.push(p.market);c.histD.push(d)}else c.hist[c.hist.length-1]=p.market;n++}
  const t=(c.sources||[]).find(x=>x.site==='TCGplayer');if(t){if(t.price!==p.market){t.price=p.market;n++}}else{(c.sources=c.sources||[]).unshift({site:'TCGplayer',label:'Market',price:p.market,cur:'USD'});n++}}
 return n}

async function mkHistory(){const L=S.cards.filter(c=>c.src&&c.src.tcg);if(!L.length)return;
 const seen=new Set(),items=L.map(c=>({tcg:c.src.tcg,sub:c.src.sub})).filter(x=>{const k=x.tcg+'|'+x.sub;return!seen.has(k)&&seen.add(k)});
 const r=await mkPost('/api/history',{items,days:3650});const out={};
 // A card whose finish has no history of its own uses the product's main history.
 for(const x of items){const k=x.tcg+'|'+(x.sub||''),s=r.series||{};out[k]=s[k]||s[x.tcg+'|Normal']||Object.entries(s).find(([q])=>q.startsWith(x.tcg+'|'))?.[1]}
 MKT.hist=out}

// Runs on load, when the tab comes back after a while, and after cards are added.
async function mkSync(){if(!window.TX_SERVER||MKT.busy)return;MKT.busy=true;
 try{let ch=await mkLink();ch+=await mkPrices().catch(()=>0);if(ch)save();await mkHistory().catch(()=>{});
  render();if($('#dView').open&&vid!=null&&$('#phb')){const c=cur_();if(c)$('#phb').innerHTML=cardChart(c)}}
 catch(e){}finally{MKT.busy=false;MKT.at=Date.now()}}
if(window.TX_SERVER){setTimeout(mkSync,600);setTimeout(mkSync,8000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-(MKT.at||0)>30*60e3)mkSync()})}
