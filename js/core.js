/* Tradéx: Shared helpers and constants: DOM lookup, games, rarities, conditions, finishes, formatting. */
const $=s=>document.querySelector(s);
const COL={Pokémon:'#c9472f',Magic:'#3b5b8c','Yu-Gi-Oh!':'#6b4a8a',Sports:'#0e6b5c',Other:'#5f6b67','One Piece':'#b8862b',Lorcana:'#2d5f9a','Flesh and Blood':'#8a2f2f',Digimon:'#2f7fb8','Dragon Ball Fusion World':'#d0782b','Star Wars Unlimited':'#3d4a5c',Riftbound:'#4a3f8a',Gundam:'#5c6f7d'};
/* Games in the Tradéx server's card database (server/games.js), in menu order. */
const TXG=['Magic','Pokémon','Yu-Gi-Oh!','One Piece','Lorcana','Flesh and Blood','Digimon','Dragon Ball Fusion World','Star Wars Unlimited','Riftbound','Gundam'];
const RAR=['Common','Uncommon','Rare','Holo Rare','Ultra Rare','Secret Rare'];
const GRADERS=['PSA','BGS','BVG','CGC','SGC','TAG','HGA','ACE','AGS','CSG','GMA','ISA','KSA','Ludex','MNT','PCA','Other'];
const CON=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
const FIN={'Pokémon':['Non-Holo','Holo','Reverse Holo','Poké Ball Reverse Holo','Master Ball Reverse Holo','Cosmos Holo','Cracked Ice Holo','Galaxy Holo','Mirror Holo','Textured Holo','Full Art','Rainbow','Gold','Shiny','Stamped Promo'],
'Magic':['Non-Foil','Foil','Etched Foil','Surge Foil','Galaxy Foil','Textured Foil','Rainbow Foil','Confetti Foil','Halo Foil','Step-and-Compleat Foil','Gilded Foil','Serialized'],
'Yu-Gi-Oh!':['Normal','Short Print','Parallel Rare','Starfoil','Mosaic Rare','Shatterfoil','Ghost Rare','Ultimate Rare','Collector\'s Rare','Gold Rare','Premium Gold Rare','Platinum Secret Rare','Prismatic Secret Rare','Starlight Rare','Quarter Century Secret Rare'],
'One Piece':['Standard','Foil','Parallel (Alt Art)','Special (SP)','Manga Rare','Treasure Rare'],
'Sports':['Base','Holo','Refractor','Prizm','Silver Prizm','Gold','Rainbow','Cracked Ice','Shimmer','Numbered','Autograph','Patch / Relic'],
'Other':['Standard','Foil','Holo','Reverse Holo','Textured','Other']};
const finOf=g=>FIN[g]||FIN.Other;
const finSel=(v,g)=>{const L=finOf(g),o=['',...L].concat(v&&!L.includes(v)?[v]:[]);return `<select id="f_finish">${o.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${x?esc(x):'—'}</option>`).join('')}</select>`};
const finUI=c=>{const L=finOf(c.game),v=c.finish||'';return OWNER?`<select class="csel" id="fs" aria-label="Card finish or pattern"><option value="">Finish: —</option>${L.concat(v&&!L.includes(v)?[v]:[]).map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<span class="chip on" title="Card finish / pattern. Only the binder owner can change it">${v?esc(v):'Finish: —'}</span>`};
const GN={magic:'Magic',pokemon:'Pokémon',onepiece:'One Piece'};
const bg=c=>`linear-gradient(160deg,${COL[c.game]||COL.Other},#1c2422)`+'';
const face=c=>c.img?`background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0) 35%,rgba(0,0,0,.6)),url('${esc(c.img)}') center/cover`:`background:${bg(c)}`;
const val=c=>c.hist[c.hist.length-1]||0;
const money=n=>'$'+n.toLocaleString(undefined,{maximumFractionDigits:n<10?2:0});
const pct=c=>{const a=c.hist[0],b=val(c);return a?((b-a)/a*100):0};
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function opts(el,label,arr){el.innerHTML=`<option value="">${label}</option>`+arr.map(a=>`<option>${esc(a)}</option>`).join('')}
const isB=v=>S.binders.includes(v)&&v!=='Everything';
const IMG=k=>(S.img||{})[k];
const today=()=>new Date().toISOString().slice(0,10);
