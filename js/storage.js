/* Tradéx: Collection state (S): load from localStorage, migrate old data, save, regroup binders by game. */
let S;
try{S=JSON.parse(localStorage.getItem('tradex')||localStorage.getItem('slipcase')||'null')}catch(e){}
S=S||seed();const LEG={Mint:'Near Mint',Excellent:'Lightly Played',Good:'Moderately Played',Played:'Moderately Played'};S.cards.forEach(c=>{if(LEG[c.cond])c.cond=LEG[c.cond]});S.cards.forEach(c=>{if(c.name==='Black Lotus'&&!c.img)Object.assign(c,BL);if(c.name==='Llanowar Elves'&&!c.img)Object.assign(c,LE);if(c.name==='Llanowar Elves'&&!c.flavor&&c.set==='Dominaria')c.flavor=LE.flavor;if(c.name==='Charizard'&&!c.moves)Object.assign(c,CH)});
const save=()=>{try{localStorage.setItem('tradex',JSON.stringify(S))}catch(e){}};
function fixBinders(){const bg=S.bg=S.bg||{},uq=a=>[...new Set(a)];
 S.binders.filter(b=>b!=='Everything').forEach(b=>{const cs=S.cards.filter(c=>c.binders.includes(b)),gs=uq(cs.map(c=>c.game||'Other')),drop=g=>cs.forEach(c=>{if((c.game||'Other')!==g)c.binders=c.binders.filter(x=>x!==b)});
  if(bg[b]){drop(bg[b]);return}
  if(b==='Vintage Binder'&&gs.includes('Pokémon')){bg[b]='Pokémon';drop('Pokémon');return}
  if(gs.length<=1){if(gs[0])bg[b]=gs[0];return}
  gs.forEach(g=>{const nb=b+' · '+g;if(!S.binders.includes(nb))S.binders.push(nb);bg[nb]=g;if(S.meta&&S.meta[b])S.meta[nb]=S.meta[nb]||S.meta[b];cs.forEach(c=>{if((c.game||'Other')===g){c.binders=c.binders.filter(x=>x!==b);c.binders.push(nb)}})});
  S.binders=S.binders.filter(x=>x!==b)});
 save()}
fixBinders();
