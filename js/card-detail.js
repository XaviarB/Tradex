/* Tradéx: Card detail (Pokédex-style) view: markets, versions, skins and owner controls. */
const EUR_USD=1.08; /* approximate rate used to show Cardmarket euro prices in US dollars */
const mon=x=>'$'+money(x.cur==='EUR'?x.price*EUR_USD:x.price).slice(1);
let OWNER=true;
if(!OWNER)claude.use('user').then(u=>{OWNER=!!(u&&u.isOwner());if(vid!=null&&$('#dView').open)$('#vp').innerHTML=panel(cur_())}).catch(()=>{});
let vid=null,vi=0;
function ev(c){const v=vi>0&&c.versions&&c.versions[vi-1];if(!v)return c;const o=Object.fromEntries(Object.entries(v).filter(([,x])=>x));return {...c,...o,moves:o.moves||(o.text?null:c.moves)}}
const vstat={};
const MKS=['TCGplayer','Cardmarket','eBay','PriceCharting'],GPATH={Magic:'Magic','Pokémon':'Pokemon','Yu-Gi-Oh!':'YuGiOh','One Piece':'OnePiece'};
/* the card's own page on each market (its listings), falling back to a search when the exact page isn't known */
const mkUrl=(site,c)=>{const n=encodeURIComponent(c.name||''),q=encodeURIComponent([c.name,c.set,c.num].filter(Boolean).join(' ')),own=((c.sources||[]).find(x=>x&&x.site===site&&x.url)||{}).url,tcg=c.src&&c.src.tcg;
 if(site==='TCGplayer')return tcg?'https://www.tcgplayer.com/product/'+encodeURIComponent(tcg)+'?Language=English':own||'https://www.tcgplayer.com/search/all/product?q='+q+'&view=grid';
 if(site==='Cardmarket')return own||'https://www.cardmarket.com/en/'+(GPATH[c.game]||'Magic')+'/Products/Search?searchString='+n;
 if(site==='eBay')return own||'https://www.ebay.com/sch/i.html?_nkw='+q+'&_sacat=183454';
 return own||'https://www.pricecharting.com/search-products?q='+q+'&type=prices'};
const CMULT={'Near Mint':1,'Lightly Played':.85,'Moderately Played':.7,'Heavily Played':.5,'Damaged':.35},CABB={'Near Mint':'NM','Lightly Played':'LP','Moderately Played':'MP','Heavily Played':'HP','Damaged':'DMG'}; /* market comps are Near Mint prices; scaled by the card's condition (not for graded slabs) */
const CKEY={'Near Mint':'near_mint','Lightly Played':'lightly_played','Moderately Played':'moderately_played','Heavily Played':'heavily_played','Damaged':'damaged'};
/* exact price for this condition when the server gave us one (x.byCond); otherwise the percentage estimate */
function adjSrc(c,x,m,ab){const bc=x.byCond,lb=String(x.label||'');if(!bc||typeof bc!=='object'||c.grader)return{...x,price:x.price*m,label:lb+ab};const k=CKEY[c.cond],ex=bc[k]??(k==='near_mint'?bc.mint:undefined);if(ex!=null&&isFinite(+ex))return{...x,price:+ex,label:lb+ab,est:false};return{...x,price:(+(bc.near_mint??bc.mint??x.price))*m,label:lb+ab,est:true}}
/* on a Tradéx server: quietly fetch fresh live prices when a card is opened (at most once an hour per card) */
/* (cards whose text was looked up before every ability and attack was collected, txv<2, are looked up again once) */
async function autoPrice(c){if(!window.TX_SERVER||typeof OWNER==='undefined'||!OWNER||!c.game)return;if(c.srcAt&&Date.now()-c.srcAt<36e5&&c.txv===2)return;
 try{const r=await fetch('/api/enrich',{method:'POST',headers:{'content-type':'application/json','x-owner':localStorage.getItem('tradex_pw')||''},body:JSON.stringify({cards:[{game:c.game,name:c.name,set:c.set,num:c.num,finish:c.finish,tcg:c.src&&c.src.tcg,sub:c.src&&c.src.sub}]})}).then(x=>x.ok?x.json():Promise.reject()),e=(r.cards||[])[0];
 if(!e)return;const was=JSON.stringify([c.text,c.moves]);mkFill(c,e);c.srcAt=Date.now();c.txv=2;save();if(vid===c.id&&$('#mp'))$('#mp').innerHTML=mpHTML(c);
 if(vid===c.id&&was!==JSON.stringify([c.text,c.moves])&&$('#vp .dx-txt'))$('#vp .dx-txt').innerHTML=descHTML(ev(c))}catch(x){}}
/* copies what the server found for a card (its TCGplayer printing, prices, rules text, picture) onto it, keeping what's already set */
/* Rules text is the exception: a fuller list of abilities and attacks (or longer text) replaces what the card has. */
function mkFill(c,e){if(e.tcg)c.src={...(c.src||{}),game:e.game,tcg:e.tcg,sub:e.sub};if(e.sources&&e.sources.length)c.sources=e.sources;
 ['img','type','cost','flavor','artist'].forEach(k=>{if(e[k]&&!c[k])c[k]=e[k]});
 const n=(c.moves||[]).length;if(e.moves&&e.moves.length>n){c.moves=e.moves;c.text=e.text||undefined}
 else if(e.text&&!n&&!(e.moves||[]).length&&String(e.text).length>String(c.text||'').length)c.text=e.text}
function mpHTML(c){const m=c.grader?1:(CMULT[c.cond]??1),ab=!c.grader&&CABB[c.cond]?' · '+CABB[c.cond]:'',src=(c.sources||[]).map(x=>adjSrc(c,x,m,ab)),box=(site,x,extra)=>`<a class="pc" data-ls="${esc(site)}" href="${esc(mkUrl(site,c))}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><small>${esc(site)}${x?' · '+esc(x.label)+(x.cur==='EUR'?' · converted':''):''}</small><b${x?'':' style="color:var(--mut)"'}>${x?(x.est?'~':'')+mon(x):'—'}</b><small style="color:var(--acc)">${x?'View listings ↗':'Search ↗'}</small></a>`;
 return `<div class="pr">${MKS.map(m=>box(m,src.find(x=>x.site===m))).join('')}</div>`}
const fmtD=d=>{if(!d)return'';const x=/^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00'):new Date(d);return isNaN(x)?d:x.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})};
function verStrip(c){const all=[{set:c.set,year:c.year,img:c.img},...(c.versions||[])],st=vstat[c.id],n=(c.versions||[]).length;
 return `<div class="vers" role="tablist" aria-label="Versions">${all.map((v,i)=>{const nm=v.set||v.label||'Unknown set';return `<button class="vb ${i===vi?'on':''}" data-a="vs" data-i="${i}" title="${esc(nm)} · ${esc(fmtD(v.year))}"><span class="vt">${v.img?`<img src="${esc(v.img)}" alt="">`:'·'}</span><small><b>${esc(nm)}</b></small><small>${esc(fmtD(v.year))}</small></button>`}).join('')}</div>${st==='load'?'<div class="note" style="margin:4px 0 0">Finding other versions…</div>':st==='fail'&&!n?'<div class="note" style="margin:4px 0 0">Couldn’t load other versions here. Reopen the card to try again.</div>':st==='done'&&!n?'<div class="note" style="margin:4px 0 0">No other versions found.</div>':''}`}
function leftHTML(c){const e=ev(c);return e.img?`<img class="vimg" src="${esc(e.img)}" alt="${esc(c.name)}">`:`<div class="face vimg" style="${face(e)};margin:auto"><b>${esc(c.name)}</b></div>`}
const GK={Magic:'magic','Pokémon':'pokemon','One Piece':'onepiece'};
const addV=x=>({label:x.set,year:x.year,set:x.set,num:x.num,artist:x.artist,rarity:x.rarity,flavor:x.flavor,img:x.img});
async function loadVers(c){const g=(c.src&&c.src.game)||GK[c.game];if(!g||vstat[c.id]==='load'||vstat[c.id]==='done')return;
 const show=()=>{if(vid===c.id&&$('#dView').open&&$('#vs')){$('#vs').innerHTML=verStrip(c);if($('#mp'))$('#mp').innerHTML=mpHTML(c)}};
 vstat[c.id]='load';show();
 try{let rs;if(window.TX_SERVER){const L=await fetch('/api/prints?game='+g+'&name='+encodeURIComponent(c.name),{headers:{'x-owner':localStorage.getItem('tradex_pw')||''}}).then(x=>x.ok?x.json():Promise.reject());const mt=L.find(x=>x.set===c.set&&x.num===c.num);rs={printings:L,prices:(mt&&mt.sources)||[]}}else{const sm=await claude.use('sample');if(!sm)throw 0;rs=await sm.json('Trading card "'+c.name+'" ('+c.game+'), printing: set "'+(c.set||'')+'", number "'+(c.num||'')+'". Return ONLY a JSON object {"printings":[{"set":"","num":"","year":"","artist":"","rarity":"","flavor":""}],"prices":[{"site":"TCGplayer","label":"Market (est.)","price":0,"cur":"USD"},{"site":"Cardmarket","label":"Trend (est.)","price":0,"cur":"USD"}]}. "printings" = all real printings of this card (use null when unsure, never invent; for Magic cards put the exact italic flavor text of each printing in "flavor", or null if it has none or you are unsure). "prices" = rough typical market price estimates for the printing above, in US dollars for both; use an empty array if you do not know.',{modelTier:'quick'})}
  const all=Array.isArray(rs)?rs:rs&&rs.printings;if(!Array.isArray(all))throw 0;
  if(rs&&Array.isArray(rs.prices)&&!(c.sources&&c.sources.length)){const pr=rs.prices.filter(x=>x&&x.site&&isFinite(+x.price)&&+x.price>0).map(x=>({site:String(x.site),label:String(x.label||'Market (est.)'),price:+x.price,cur:x.cur==='EUR'?'EUR':'USD',est:!window.TX_SERVER}));if(pr.length){c.sources=pr;save()}}
  {const mt=all.find(x=>x.set===c.set&&x.num===c.num);if(mt&&mt.flavor&&!c.flavor){c.flavor=mt.flavor;save()}}
  const have=new Set([c.set+'|'+c.num,...(c.versions||[]).map(v=>(v.set||'')+'|'+(v.num||''))]);
  const add=all.filter(x=>!have.has(x.set+'|'+x.num)).sort((x,y)=>(x.year||'')<(y.year||'')?-1:1).map(addV);
  if(add.length){(c.versions=c.versions||[]).push(...add);save()}
  vstat[c.id]='done'}catch(e){vstat[c.id]='fail'}
 show()}
function cur_(){return S.cards.find(x=>x.id===vid)}
const descHTML=e=>cardText(e).replace('<h4>CARD TEXT</h4>','')||'<div class="txt" style="opacity:.75">No card text on file.</div>';
function panel(c){const e=ev(c);const p=pct(c),free=S.binders.filter(b=>isB(b)&&!c.binders.includes(b)&&(!(S.bg||{})[b]||S.bg[b]===(c.game||'Other')));
 const det=[['Illustrator',e.artist],['Released',e.year],['Rarity',e.rarity],['Number',e.num],c.grader&&['Graded',c.grader+(c.grade?' '+c.grade:'')],c.who&&['Imported from',c.who],c.finish&&['Finish',c.finish],['Game',c.game],e.type&&['Type',e.type+(c.cost!=null?' · Cost '+(c.game==='Magic'?costB(c.cost):c.cost):'')],['Collected',c.collected],['Acquired for',money(c.paid)],c.acquired&&['How acquired',c.acquired]].filter(Boolean);
 const lh=leftHTML(c).replace(/class="((?:face )?vimg)"/,(m,k)=>'class="'+k+(dxA?'':' still')+'"');
 const skin=dxSkin(),num=esc(e.num||'—'),desc=descHTML(e);
 return `<div class="dex" data-dx="${skin}"><div class="dx-scroll"><section class="dx-hero">
 <div class="dx-head"><span class="dx-lens"><svg class="dx-logo" viewBox="0 0 100 100" aria-label="Tradéx"><defs><path id="tdArc" d="M 17 82 Q 37 50 97 47"/></defs><text><textPath href="#tdArc" startOffset="50%" text-anchor="middle" textLength="86" lengthAdjust="spacingAndGlyphs">Tradéx</textPath></text></svg></span><span class="dx-lights"><i class="r"></i><i class="y"></i><i class="g"></i></span><span class="dx-brand">Tradéx</span><div class="dx-tab"><b>#${num}</b> ${esc(c.name)}</div>
 <div class="dx-skins" role="group" aria-label="Choose a look">${DXK.map(([k,l])=>`<button type="button" data-a="skin" data-s="${k}" class="${k===skin?'on':''}" title="${l}" aria-label="${l} look"></button>`).join('')}</div>
 <button class="dx-x" data-a="x" aria-label="Close">✕</button></div>
 <div class="dx-stage"><span class="dx-pill">${esc(e.rarity||e.type||c.game)}</span>${lh}</div>
 <div class="dx-stats"><div class="dx-b"><h2 class="vh">${esc(c.name)}</h2><div class="dx-sub">${esc(c.game)} · ${esc(e.set)}</div>${e.type?`<div class="dx-type">${esc(e.type)}${c.cost!=null&&c.cost!==''?' · '+ico(esc(c.game==='Magic'?costB(c.cost):c.cost),c.game):''}</div>`:''}
 
 <div class="dx-row"><span>Condition</span><div class="dx-val">${OWNER?`<select class="csel" id="cs" aria-label="Card condition">${(CON.includes(c.cond)||!c.cond?CON:[...CON,c.cond]).map(o=>`<option ${o===c.cond?'selected':''}>${o}</option>`).join('')}</select>`:`<span class="chip on" title="Only the binder owner can change condition">${esc(c.cond)}</span>`}</div></div>
 <div class="dx-row"><span>Finish</span><div class="dx-val">${finUI(c)}</div></div>
 <div class="dx-row"><span>Copies</span><div class="step" aria-label="Copies owned">${c.qty>1?'<button data-a="m" aria-label="One fewer">−</button>':'<button data-a="del" aria-label="Remove card from collection" title="Remove card" style="color:#c9472f"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button>'}<b>${c.qty}</b><button data-a="p" aria-label="One more">+</button></div></div>
 <div class="dx-row"><span>Seller’s price</span>${OWNER?`<span class="dx-money">$<input id="lp" type="number" min="0" step="any" value="${c.listed??''}" placeholder="${val(c)}" aria-label="Seller’s price (USD)" class="lp"></span>`:`<b class="dx-money">${money(c.listed??val(c))}</b>`}</div></div><div class="dx-b dx-txt">${desc}</div></div>
 <div class="dx-no">No. ${num}</div>
 <div class="dx-more dx-ctx"><h4 class="cch">CARD CONTEXT<span id="rfm"></span>${typeof OWNER!=='undefined'&&OWNER?`<button class="rfb" data-mkr="${c.id}" title="Refresh market prices" aria-label="Refresh market prices">↻</button>`:''}</h4><div id="mp">${mpHTML(c)}</div></div>
 </section><section class="dx-more">
 <h4 class="cch">PRICE HISTORY${typeof rangeBar==='function'?rangeBar():''}</h4><div class="box" id="phb">${typeof cardChart==='function'?cardChart(c):c.hist.length>0?chart(c):''}</div>
 <h4>DETAILS</h4><div class="box"><div class="dg">${det.map(([k,v])=>`<div><span>${k}</span><b>${ico(esc(v),c.game)||'—'}</b></div>`).join('')}</div></div>
 </section></div></div>`}
let dxA=0,dxT='info';const DXK=[['hw','Handheld'],['gba','Pixel'],['card','Collector card'],['std','Console']];
const dxSkin=()=>{try{const v=localStorage.getItem('tradex_dx');return DXK.some(k=>k[0]===v)?v:'hw'}catch(e){return'hw'}};
function view(id){vid=id;vi=0;dxT='info';const c=cur_(),col=COL[c.game]||COL.Other;
 dxA=1;$('#view').innerHTML=`<div class="vwrap"><div class="vp" id="vp">${panel(c)}</div></div>`;dxA=0;
 if(!$('#dView').open)$('#dView').showModal();autoPrice(c)}
$('#dView').addEventListener('click',e=>{if(e.target===$('#dView'))return $('#dView').close();
 const t=e.target.closest('[data-a]');if(!t)return;const c=cur_(),a=t.dataset.a;
 if(a==='x')return $('#dView').close();
 if(a==='vs'){vi=+t.dataset.i;$('#vlc').innerHTML=leftHTML(c);$('#vp').innerHTML=panel(c);return}
 if(a==='tab'){dxT=t.dataset.t;const d=$('#vp .dex');if(d){d.querySelectorAll('[data-a=tab]').forEach(b=>b.classList.toggle('on',b===t));d.querySelectorAll('.dx-pane').forEach(q=>{q.hidden=q.dataset.p!==dxT})}return}
 if(a==='skin'){try{localStorage.setItem('tradex_dx',t.dataset.s)}catch(x){}const d=$('#vp .dex');if(d)d.dataset.dx=t.dataset.s;t.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===t));return}
 if(a==='prev'||a==='next'){const L=S.cards,i=L.findIndex(x=>x.id===vid);if(L.length>1&&i>=0){const n=L[(i+(a==='next'?1:L.length-1))%L.length];view(n.id)}return}
 if(a==='del'){ask('Remove '+c.name+' from your collection?',{ok:'Remove',danger:true}).then(y=>{if(y){S.cards=S.cards.filter(x=>x.id!==vid);save();setup();render();$('#dView').close()}});return}
 if(a==='m'&&c.qty>1)c.qty--;if(a==='p')c.qty++;
 if(a==='rb')c.binders=c.binders.filter(b=>b!==t.dataset.b);
 save();$('#vp').innerHTML=panel(c);render()});
$('#dView').addEventListener('change',e=>{const c=cur_();if(!c)return;
 if(e.target.id==='fs'&&OWNER){c.finish=e.target.value;save();$('#vp').innerHTML=panel(c);render();return}
 if(e.target.id==='cs'&&OWNER){c.cond=e.target.value;save();$('#vp').innerHTML=panel(c);render();return}
 if(e.target.id==='lp'&&OWNER){const v=parseFloat(e.target.value);if(isNaN(v)||v<0)delete c.listed;else c.listed=v;save();$('#vp').innerHTML=panel(c);render();return}
 if(e.target.id==='vn'){c.notes=e.target.value;save();return}
 if(e.target.id==='ab'&&e.target.value){c.binders.push(e.target.value);(S.bg=S.bg||{})[e.target.value]=S.bg[e.target.value]||c.game||'Other';save();$('#vp').innerHTML=panel(c);render()}});
