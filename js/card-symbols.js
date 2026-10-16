/* Tradéx: Mana, energy and attribute icons, and card rules text rendering. */
const EN={Fire:['#e5533d','🔥'],Water:['#3d8fe5','💧'],Grass:['#4caf50','🍃'],Lightning:['#e0a800','⚡'],Psychic:['#9b59b6','🌀'],Fighting:['#b5651d','👊'],Darkness:['#34495e','🌙'],Metal:['#8e9aa5','⚙️'],Fairy:['#e87fb0','✨'],Dragon:['#c9a227','🐉'],Colorless:['#b8b8b8','★']};
const sym=t=>{const e=EN[t]||EN.Colorless;return `<span class="en" style="background:${e[0]}" title="${esc(t)}" aria-label="${esc(t)} energy"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><g fill="#fff" stroke="none">${ZI[(GD['Pokémon'][t.toLowerCase()]||GD['Pokémon'].colorless)[1]].replace(/BGC/g,e[0])}</g></svg></span>`};
const MC={W:'#f8f4d4',U:'#aee1f8',B:'#cfc6c2',R:'#f6a98c',G:'#9dd3ae',C:'#cdc7c4',S:'#dfe8ee'};
const MN={W:'White mana',U:'Blue mana',B:'Black mana',R:'Red mana',G:'Green mana',C:'Colorless mana',S:'Snow mana',T:'Tap',Q:'Untap',P:'Phyrexian mana'};
const MG={
 W:'<circle cx="12" cy="12" r="3.4"/><path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4M5.8 5.8l2.4 2.4M15.8 15.8l2.4 2.4M18.2 5.8l-2.4 2.4M8.2 15.8l-2.4 2.4" stroke="#111" stroke-width="1.9" stroke-linecap="round" fill="none"/>',
 U:'<path d="M12 3.5c3.2 4.2 5.6 6.8 5.6 9.7a5.6 5.6 0 0 1-11.2 0c0-2.9 2.4-5.5 5.6-9.7z"/>',
 B:'<path d="M12 3.8a7 7 0 0 0-4.2 12.6V20h8.4v-3.6A7 7 0 0 0 12 3.8z"/><circle cx="9.3" cy="12.2" r="1.7" fill="BG"/><circle cx="14.7" cy="12.2" r="1.7" fill="BG"/>',
 R:'<path d="M12.6 3c.7 3.2 5 5.2 5 10a5.6 5.6 0 0 1-11.2 0c0-2.2 1-3.6 2.2-4.8.1 1.8.9 2.8 2 3.1-.6-3 .1-5.6 2-8.3z"/>',
 G:'<circle cx="12" cy="7.8" r="3.9"/><circle cx="8" cy="12.2" r="3.6"/><circle cx="16" cy="12.2" r="3.6"/><path d="M10.8 11h2.4l.8 9h-4z"/>',
 C:'<path d="M12 4.5l5 7.5-5 7.5-5-7.5z"/>',
 S:'<path d="M12 4v16M5.2 8l13.6 8M18.8 8L5.2 16" stroke="#111" stroke-width="2" stroke-linecap="round" fill="none"/>'};
const gly=k=>MG[k].replace('fill="BG"','fill="'+MC.B+'"').replace('fill="BG"','fill="'+MC.B+'"');
const TAPG='<circle cx="12" cy="12" r="12" fill="#1c1c1c"/><path d="M10.08 17.26 A5.6 5.6 0 1 1 16.85 9.20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M20.14 7.30 L19.55 13.88 L13.56 11.10 z" fill="#fff"/>';
function msym(i){const u=i.toUpperCase(),disc=c=>`<circle cx="12" cy="12" r="12" fill="${c}"/>`,
 txt=(t,x,y,fs)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#111" font-family="system-ui,sans-serif">${esc(t)}</text>`,
 mini=(p,x)=>MG[p]?`<g transform="translate(${x-6} ${x-6}) scale(.5)" fill="#111">${gly(p)}</g>`:txt(p,x,x+2.7,8);let b,t=MN[u]||i;
 if(u==='T')b=TAPG;else if(u==='Q')b=`<g transform="matrix(-1 0 0 1 24 0)">${TAPG}</g>`;
 else if(MG[u]&&u.length===1)b=disc(MC[u])+`<g fill="#111">${gly(u)}</g>`;
 else if(/^\d+$/.test(u)||/^[XYZ]$/.test(u))b=disc('#cdc7c4')+txt(u,12,u.length>1?16:17,u.length>1?11:14);
 else if(u.includes('/')){const ps=u.split('/');
  if(ps.includes('P')){const o=ps.find(x=>x!=='P');b=disc(MC[o]||'#cdc7c4')+txt('Φ',12,17,14);t=(MN[o]||o)+' or 2 life'}
  else{const a=ps[0],c=ps[1];b=disc(MC[a]||'#cdc7c4')+`<path d="M20.5 3.5A12 12 0 0 1 3.5 20.5z" fill="${MC[c]||'#cdc7c4'}"/>`+mini(a,7.5)+mini(c,16.5);t=ps.map(x=>MN[x]?MN[x].replace(' mana',''):x).join(' or ')}}
 else b=disc('#cdc7c4')+txt(u,12,u.length>3?14:15.5,u.length>3?7:u.length>1?9:12);
 return `<span class="ms" title="${esc(t)}" role="img" aria-label="${esc(t)}"><svg viewBox="0 0 24 24" width="1.15em" height="1.15em" aria-hidden="true">${b}</svg></span>`}
const mana=h=>String(h).replace(/\{([^}]+)\}/g,(_,i)=>msym(i));
const ZI={
fire:'<path d="M12.6 3c.7 3.2 5 5.2 5 10a5.6 5.6 0 0 1-11.2 0c0-2.2 1-3.6 2.2-4.8.1 1.8.9 2.8 2 3.1-.6-3 .1-5.6 2-8.3z"/>',
drop:'<path d="M12 3.5c3.2 4.2 5.6 6.8 5.6 9.7a5.6 5.6 0 0 1-11.2 0c0-2.9 2.4-5.5 5.6-9.7z"/>',
leaf:'<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19l8-8" stroke="BGC" stroke-width="1.4"/>',
bolt:'<path d="M13.5 3 6.5 13.5h4.5L10 21l7.5-11H13z"/>',
eye:'<path d="M3 12c3-5 15-5 18 0-3 5-15 5-18 0z"/><circle cx="12" cy="12" r="2.6" fill="BGC"/>',
fist:'<rect x="6" y="6.5" width="12" height="11" rx="3.2"/><path d="M10 6.5v5M14 6.5v5" stroke="BGC" stroke-width="1.3"/>',
moon:'<path d="M15.5 4.5a8 8 0 1 0 4 11.5A7 7 0 0 1 15.5 4.5z"/>',
gear:'<circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8"/>',
spark:'<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
fang:'<path d="M6 5c0 6 3 8.5 6 14 3-5.5 6-8 6-14-2.5 2.2-4 3-6 3S8.5 7.2 6 5z"/>',
star:'<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.9 6.6 19.9l1.3-6L3.4 9.8l6-.7z"/>',
sun:'<circle cx="12" cy="12" r="3.6"/><path d="M12 3.2v3M12 17.8v3M3.2 12h3M17.8 12h3M5.8 5.8l2.1 2.1M16.1 16.1l2.1 2.1M18.2 5.8l-2.1 2.1M7.9 16.1l-2.1 2.1" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
mtn:'<path d="M3.5 18.5L10 6.5l3.6 6.2 2.2-3.2 4.7 9z"/>',
swirl:'<path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5M12 9a3 3 0 1 0 3 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
plus:'<path d="M12 6v12M6 12h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
ring:'<circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff" stroke-width="3"/>',
dot:'<circle cx="12" cy="12" r="4.6" opacity=".9"/>',
arrow:'<path d="M12 4l6 7h-4v9h-4v-9H6z"/>',
gem:'<path d="M12 4l7 8-7 8-7-8z"/>',
circ:'<circle cx="12" cy="12" r="4.5"/>',
base:'<path d="M7 5c3 4 3 10 0 14M17 5c-3 4-3 10 0 14" fill="none" stroke="#c0392b" stroke-width="1.6"/>',
bask:'<path d="M12 2v20M2 12h20M5 5c4 3 4 11 0 14M19 5c-4 3-4 11 0 14" fill="none" stroke="#3a2412" stroke-width="1.2"/>',
foot:'<path d="M8 12h8M10 10v4M12 10v4M14 10v4" stroke="#fff" stroke-width="1.4"/>',
puck:'<ellipse cx="12" cy="12" rx="6.5" ry="3.2" fill="#666"/>',
soc:'<path d="M12 8l3.3 2.4-1.3 3.9h-4l-1.3-3.9z" fill="#222"/>'};
const GD={'Pokémon':{fire:['#e5533d','fire','Fire'],water:['#3d8fe5','drop','Water'],grass:['#4caf50','leaf','Grass'],lightning:['#e0a800','bolt','Lightning'],psychic:['#9b59b6','eye','Psychic'],fighting:['#b5651d','fist','Fighting'],darkness:['#34495e','moon','Darkness'],metal:['#8e9aa5','gear','Metal'],fairy:['#e87fb0','spark','Fairy'],dragon:['#c9a227','fang','Dragon'],colorless:['#9aa3a0','star','Colorless']},
'Yu-Gi-Oh!':{dark:['#6b3fa0','moon','DARK'],light:['#d9a800','sun','LIGHT'],earth:['#8a5a2b','mtn','EARTH'],water:['#2f7fd8','drop','WATER'],fire:['#d9482b','fire','FIRE'],wind:['#2f9e72','swirl','WIND'],divine:['#c9a227','star','DIVINE'],spell:['#1d9e78','plus','Spell'],trap:['#b5326e','ring','Trap']},
'One Piece':{red:['#c0392b','dot','Red'],green:['#2e8b57','dot','Green'],blue:['#2f6fd8','dot','Blue'],purple:['#7b4fb5','dot','Purple'],black:['#2b2b2b','dot','Black'],yellow:['#d9a800','dot','Yellow']},
'Sports':{baseball:['#f4f1ea','base','Baseball'],basketball:['#e8842c','bask','Basketball'],football:['#8a5a2b','foot','Football'],hockey:['#2b2b2b','puck','Hockey'],soccer:['#f4f4f0','soc','Soccer']}};
const inIcon=(d,fg)=>`<span class="ms" title="${esc(d[2])}" role="img" aria-label="${esc(d[2])}"><svg viewBox="0 0 24 24" width="1.25em" height="1.25em" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${d[0]}"/><g fill="${fg||'#fff'}" stroke="none">${ZI[d[1]].replace(/BGC/g,d[0])}</g></svg></span>`;
const PW=Object.keys(EN).join('|'),costB=x=>{x=String(x);return x.includes('{')?x:(x.match(/\d+|[WUBRGCSXYZ]/gi)||[x]).map(t=>'{'+t+'}').join('')};
function ico(h,g,txt){h=String(h);
 if(g==='Magic')return mana(h);
 if(g==='Pokémon')return h.replace(new RegExp('\\b('+PW+')\\b'+(txt?' Energy\\b':''),'g'),(m,w)=>inIcon(GD['Pokémon'][w.toLowerCase()])+(txt?' Energy':''));
 if(g==='Yu-Gi-Oh!')return h.replace(/\b(DARK|LIGHT|EARTH|WATER|FIRE|WIND|DIVINE)\b/g,(m,w)=>inIcon(GD['Yu-Gi-Oh!'][w.toLowerCase()])).replace(/\b(Level|Rank)\s*(\d+)/g,(m,k,n)=>inIcon([k==='Rank'?'#2b2b2b':'#e8912d','star',k+' '+n])+n);
 return h}
function cardText(c){
 /* rules printed besides the moves (e.g. the Pokémon ex rule), unless it only repeats them */
 const rules=c.moves&&c.moves.length&&c.text&&!c.moves.some(m=>m.name&&String(c.text).includes(m.name))?`<div class="mr"><div>${ico(esc(c.text),c.game,1)}</div></div>`:'';
 if(c.moves&&c.moves.length)return '<h4>CARD TEXT</h4><div class="mv">'+c.moves.map(m=>m.kind==='attack'?`<div class="mr"><div class="mvh"><div class="ens">${(m.cost||[]).map(sym).join('')}</div><div><b class="mn">${esc(m.name)}</b>${m.text?`<div>${ico(esc(m.text),'Pokémon',1)}</div>`:''}</div><div class="dmg">${esc(m.damage)}</div></div></div>`:`<div class="mr"><b class="pw">${esc(m.label||'Pokémon Power')}: ${esc(m.name)}</b><div>${ico(esc(m.text),'Pokémon',1)}</div></div>`).join('')+rules+'</div>';
 const fl=c.flavor?`<div class="fl">${esc(c.flavor)}</div>`:'';return (c.text||fl)?`<h4>CARD TEXT</h4>${c.text?`<div class="txt">${ico(esc(c.text),c.game,1)}</div>`:''}${fl}`:''}
