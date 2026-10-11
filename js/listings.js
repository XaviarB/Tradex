/* Tradéx: marketplace listings modal. */
(()=>{
const E=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=document.getElementById('lsm'),B=document.getElementById('lsbody');
let cur=null;
const fm=(n,c)=>c==='EUR'?'€'+n.toFixed(2):'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=x=>({price:+x.price,ship:x.ship==null||x.ship===''?null:+x.ship,cond:x.cond||x.condition||'',finish:x.finish||'',seller:x.seller||'',rating:x.rating==null?null:+x.rating,sales:x.sales==null?null:x.sales,qty:x.qty==null?null:x.qty,note:x.note||'',url:x.url||'',cur:x.cur==='EUR'?'EUR':'USD',sample:!!x.sample});
const total=x=>x.price+(x.ship||0);
const close=()=>{M.classList.remove('on');cur=null};
function sampleFor(c,site){
  const src=(c.sources||[]).find(x=>x&&x.site===site),base=src&&isFinite(+src.price)&&+src.price>0?+src.price:10,cur0=src&&src.cur==='EUR'?'EUR':'USD';
  const conds=['Near Mint','Near Mint','Lightly Played','Lightly Played','Moderately Played','Heavily Played'],mult=[.97,1.05,.88,.93,.78,.62];
  return conds.map((cd,i)=>norm({price:+(base*mult[i]).toFixed(2),ship:i%2?3.99:0,cond:cd,finish:c.finish||'',seller:'Sample Seller '+(i+1),rating:[100,99.8,99.5,98.9,99.2,97.4][i],sales:[760,'50000+','10000+',2300,540,128][i],qty:[4,1,3,2,1,6][i],cur:cur0,sample:true,url:mkUrl(site,c)}));
}
function render(c,site,list,sample){
  const sortv=(document.getElementById('lss')||{}).value||'tot';
  let L=list.filter(x=>isFinite(x.price)&&x.price>0);
  L.sort((a,b)=>sortv==='price'?a.price-b.price:sortv==='rate'?(b.rating||0)-(a.rating||0):total(a)-total(b));
  const low=L.length?Math.min(...L.map(total)):null,shown=cur&&cur.n||10;
  const rows=L.slice(0,shown).map(x=>{
    const sh=x.ship===0?'Included':x.ship==null?'varies':'+'+fm(x.ship,x.cur);
    const cd=[x.cond,x.finish].filter(Boolean).join(' ');
    return `<div class="lsr"><div class="lst"><span class="lspr">${fm(x.price,x.cur)}</span><span class="lssh">Shipping: <i>${E(sh)}</i></span><span class="lscd">${E(cd||'Listing')}</span>${x.qty!=null?`<span class="lsq">${E(x.qty)} available</span>`:''}<a class="lsa" href="${E(x.url||mkUrl(site,c))}" target="_blank" rel="noopener">View listing ↗</a></div>${x.note?`<div class="lsn">${E(x.note)}</div>`:''}${x.seller?`<div class="lsf"><b>${E(x.seller)}</b>${x.rating!=null?`<span><em>★</em> ${E(x.rating)}%${x.sales!=null?' ('+E(x.sales)+' Sales)':''}</span>`:''}</div>`:''}</div>`}).join('');
  B.innerHTML=`<div class="lsh"><div><h2>${L.length} Listing${L.length===1?'':'s'}</h2><p>${low!=null?'As low as '+fm(low,L[0]&&L[0].cur)+' · ':''}${E(site)} · ${E(c.name)}</p></div><div class="lsc"><label for="lss">Sort By</label><select id="lss"><option value="tot"${sortv==='tot'?' selected':''}>Price + Shipping</option><option value="price"${sortv==='price'?' selected':''}>Price</option><option value="rate"${sortv==='rate'?' selected':''}>Seller rating</option></select></div></div>${sample?'<div class="lsw">SAMPLE PREVIEW — these are placeholder listings built around the current price, not real listings.</div>':''}<div class="lsb">${rows}${L.length>shown?'<button class="lsmore" id="lsmore">Show more</button>':''}</div>`;
  document.getElementById('lss').onchange=()=>render(c,site,list,sample);
  const mo=document.getElementById('lsmore');if(mo)mo.onclick=()=>{cur.n=shown+10;render(c,site,list,sample)};
}
function empty(c,site,msg){
  B.innerHTML=`<div class="lsh"><div><h2>${E(site)} listings</h2><p>${E(c.name)}</p></div></div><div class="lse">${msg}<br><a href="${E(mkUrl(site,c))}" target="_blank" rel="noopener">Open on ${E(site)} ↗</a><button id="lsprev">Preview layout with sample data</button></div>`;
  document.getElementById('lsprev').onclick=()=>render(c,site,sampleFor(c,site),true);
}
async function open_(site){
  const c=(typeof S!=='undefined'&&S.cards||[]).find(x=>String(x.id)===String(vid));if(!c)return;
  cur={site,n:10};M.classList.add('on');
  B.innerHTML=`<div class="lsh"><div><h2>${E(site)} listings</h2><p>Loading recent listings for ${E(c.name)}…</p></div></div>`;
  if(!window.TX_SERVER){empty(c,site,'Live listings load from your Tradéx server, which isn’t running on this page.');return}
  try{
    const q=new URLSearchParams({site,game:c.game||'',name:c.name||'',set:c.set||'',num:c.num||'',finish:c.finish||'',cond:c.cond||''});
    const r=await fetch('/api/listings?'+q,{headers:{'x-owner':localStorage.getItem('tradex_pw')||''}});
    if(!r.ok)throw 0;let d=await r.json();d=Array.isArray(d)?d:(d&&d.listings)||[];
    const L=d.map(norm).filter(x=>isFinite(x.price)&&x.price>0);
    if(!cur||cur.site!==site)return;
    if(!L.length){empty(c,site,'No recent listings came back for this card.');return}
    render(c,site,L,false);
  }catch(e){if(cur&&cur.site===site)empty(c,site,'Couldn’t load listings from the server right now.')}
}
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('.pc[data-ls]');
  if(a&&!(e.metaKey||e.ctrlKey||e.shiftKey||e.button)){e.preventDefault();e.stopPropagation();open_(a.dataset.ls);return}
  if(e.target===M||(e.target.closest&&e.target.closest('.lsx')))close();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M.classList.contains('on'))close()});
})();
