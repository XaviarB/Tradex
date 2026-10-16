/* Tradéx: backup and export. Download the collection as JSON (everything) or CSV (one row per card), and restore a JSON backup. */
(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const SET=['tradex_custom','tradex_dx','tradex_sb'],FMT='tradex-backup',VER=1,day=()=>new Date().toISOString().slice(0,10);
const ls=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
function dl(name,text,type){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function backup(){const st={};SET.forEach(k=>{const v=ls(k);if(v!=null)st[k]=v});return{format:FMT,version:VER,exported:new Date().toISOString(),cards:S.cards.length,data:S,settings:st}}
// CSV headers are chosen so Tradéx's own importer (and most collection apps) map them automatically.
const COLS=[['Name',c=>c.name],['Set',c=>c.set],['Card Number',c=>c.num],['Game',c=>c.game],['Rarity',c=>c.rarity],['Condition',c=>c.cond],['Finish',c=>c.finish],['Grader',c=>c.grader],['Grade',c=>c.grade],['Quantity',c=>c.qty],['Purchase Price',c=>c.paid],['Market Price',c=>(c.hist||[])[c.hist.length-1]],['Seller Price',c=>c.listed],['Release Date',c=>c.year],['Artist',c=>c.artist],['How Acquired',c=>c.acquired],['Date Collected',c=>c.collected],['Binders',c=>(c.binders||[]).join('; ')],['Source',c=>c.who],['Notes',c=>c.notes],['Image URL',c=>/^https?:/.test(c.img||'')?c.img:'']];
const cell=v=>{v=v==null?'':String(v);return /[",\r\n]/.test(v)||/^\s|\s$/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=cs=>'﻿'+[COLS.map(c=>c[0]),...cs.map(c=>COLS.map(([,f])=>f(c)))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
// Accepts a Tradéx backup file, or a bare collection object (what Tradéx keeps in localStorage).
function readBackup(t){let j;try{j=JSON.parse(String(t).replace(/^﻿/,''))}catch(e){throw new Error('That file isn’t valid JSON.')}
 const d=j&&j.format===FMT?j.data:j;if(!d||!Array.isArray(d.cards))throw new Error('That file isn’t a Tradéx backup (no cards list found).');
 if(j.format===FMT&&j.version>VER)throw new Error('This backup was made by a newer version of Tradéx.');
 // Only repair what would break the app; everything else is kept exactly as saved.
 const cards=d.cards.filter(c=>c&&typeof c==='object'&&String(c.name||'').trim()).map((c,i)=>{const x=Object.assign({},c,{id:c.id??Date.now()+i,name:String(c.name),qty:Math.max(1,parseInt(c.qty)||1),paid:Number(c.paid)||0,binders:Array.isArray(c.binders)?c.binders.map(String):[]});
  if(!Array.isArray(x.hist)||!x.hist.length||x.hist.some(n=>typeof n!=='number'||!isFinite(n))){x.hist=Array.isArray(x.hist)&&x.hist.length?x.hist.map(n=>isFinite(+n)?+n:0):[0];x.histD=x.hist.map(()=>day())}return x});
 const binders=Array.isArray(d.binders)?[...new Set(d.binders.map(String))]:[...new Set(['Everything',...cards.flatMap(c=>c.binders)])],obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const data=Object.assign({},d,{cards,binders});['bg','meta','img'].forEach(k=>{if(d[k]!=null)data[k]=obj(d[k])});
 return{data,settings:j.format===FMT?obj(j.settings):{},exported:j.exported,skipped:d.cards.length-cards.length}}
function merge(cur,inc){const out=JSON.parse(JSON.stringify(cur)),ids=new Set(out.cards.map(c=>String(c.id))),sig=c=>JSON.stringify([c.game,c.name,c.set,c.num,c.cond,c.finish,c.grader,c.grade,c.qty,c.collected]);
 const have=new Set(out.cards.map(sig));let added=0,dup=0,n=0;
 for(const c of inc.cards){if(have.has(sig(c))){dup++;continue}const x=Object.assign({},c);if(ids.has(String(x.id)))x.id=Date.now()+(++n)*7919;ids.add(String(x.id));out.cards.push(x);added++}
 inc.binders.forEach(b=>{if(!out.binders.includes(b))out.binders.push(b)});
 ['bg','meta','img'].forEach(k=>{out[k]=out[k]||{};for(const i in inc[k]||{})if(out[k][i]==null)out[k][i]=inc[k][i]});
 return{data:out,added,dup}}
function commit(data,settings){const prev=ls('tradex');
 try{localStorage.setItem('tradex',JSON.stringify(data))}catch(e){try{if(prev!=null)localStorage.setItem('tradex',prev)}catch(x){}throw new Error('This browser doesn’t have room for that backup. Nothing was changed.')}
 for(const k of SET)if(settings&&typeof settings[k]==='string')try{localStorage.setItem(k,settings[k])}catch(e){}
 if(window.TXSync)TXSync.changed()}
let PEND=null;
function openB(){const d=$('#dBak'),n=S.cards.length,q=S.cards.reduce((a,c)=>a+(c.qty||1),0);PEND=null;
 d.innerHTML=`<h2 style="margin:0 0 6px">Backup &amp; export</h2><p style="font-size:13px;color:var(--mut);margin:0 0 8px">${window.TXBackend?'Your collection is saved to your account. Download your own copy to keep, or open it in a spreadsheet.':'Your collection lives only in this browser. Download a copy to keep it safe, move it to another device, or open it in a spreadsheet.'}</p>
 <p style="font-size:13px;margin:0 0 4px"><b>${n}</b> card${n===1?'':'s'} (${q} total) in ${S.binders.filter(b=>b!=='Everything').length} binders.</p>
 <div class="r"><button class="sbtn on" id="bkj">⬇ Full backup (.json)</button><button class="sbtn" id="bkc">⬇ Spreadsheet (.csv)</button></div>
 <p style="font-size:12px;color:var(--mut);margin:0 0 10px">The JSON backup keeps everything: binders, photos, price history and your Customize settings. The CSV has one row per card and opens in Excel, Google Sheets or other collection apps.</p>
 <h2 style="font-size:17px">Restore from a backup</h2><input type="file" id="bkf" accept=".json,application/json">
 <div id="bkp"></div><p id="bkst" style="font-size:13px;margin:6px 0"></p><div class="r"><button class="sbtn g" id="bkx">Close</button></div>`;
 d.showModal()}
function preview(r){const n=r.data.cards.length,q=r.data.cards.reduce((a,c)=>a+c.qty,0),bn=r.data.binders.filter(b=>b!=='Everything').length,ph=Object.keys(r.data.img||{}).length;
 $('#bkp').innerHTML=`<p style="font-size:13px">This backup has <b>${n}</b> card${n===1?'':'s'} (${q} total), ${bn} binder${bn===1?'':'s'}${ph?`, ${ph} photo${ph===1?'':'s'}`:''}${r.exported?`, saved ${esc(new Date(r.exported).toLocaleString())}`:''}${r.skipped?`. ${r.skipped} entr${r.skipped===1?'y':'ies'} without a card name will be skipped`:''}.</p>
 <div class="r"><button class="sbtn on" id="bkm">Add to my collection</button><button class="sbtn" id="bkr">Replace my collection</button></div>`}
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const st=()=>$('#bkst');
 if(t.id==='bkb'){openB();return}
 if(t.id==='bkx'){$('#dBak').close();return}
 if(t.id==='bkj'){dl('tradex-backup-'+day()+'.json',JSON.stringify(backup(),null,1),'application/json');st().textContent='Backup downloaded.';return}
 if(t.id==='bkc'){dl('tradex-collection-'+day()+'.csv',toCSV(S.cards),'text/csv;charset=utf-8');st().textContent='Spreadsheet downloaded.';return}
 if((t.id==='bkm'||t.id==='bkr')&&PEND){try{
  if(t.id==='bkr'){if(t.dataset.arm!=='1'){t.dataset.arm='1';t.textContent='Tap again to replace '+S.cards.length+' cards';return}commit(PEND.data,PEND.settings);st().textContent='Restored. Reloading…'}
  else{const m=merge(S,PEND.data);commit(m.data,null);st().textContent=`Added ${m.added} card${m.added===1?'':'s'}${m.dup?`, skipped ${m.dup} already in your collection`:''}. Reloading…`}
  $('#bkp').innerHTML='';PEND=null;setTimeout(()=>location.reload(),900)}catch(x){st().textContent=x.message}}});
document.addEventListener('change',async e=>{if(e.target.id!=='bkf'||!e.target.files[0])return;$('#bkp').innerHTML='';$('#bkst').textContent='';PEND=null;
 try{PEND=readBackup(await e.target.files[0].text());preview(PEND)}catch(x){$('#bkst').textContent=x.message}});
window.TXBackup={backup,toCSV,readBackup,merge};
})();
