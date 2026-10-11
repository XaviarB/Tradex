/* Tradéx: Price history chart and its scrubbable tooltip in the card detail view. */
const tip=document.createElement('div');tip.id='ctip';$('#dView').appendChild(tip);
const clampN=(a,lo,hi)=>Math.min(Math.max(a,lo),hi),svgOf=e=>e.target.closest&&e.target.closest('svg.pch'),isScrub=e=>e.target.classList&&e.target.classList.contains('scrub');
let pin=null,pinAt=0;
const scD=ts=>new Date(ts).toLocaleDateString(undefined,{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}),scP=n=>'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
function fracOf(s,e){const C=s._c||(s._c=JSON.parse(s.dataset.c)),pt=s.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(s.getScreenCTM().inverse());return clampN((p.x-C.L)/(C.W-C.L-C.R),0,1)}
function showX(s,f){const C=s._c||(s._c=JSON.parse(s.dataset.c)),{W,H,L,R,T,B,lo,hi,t0,t1,t,v}=C;f=clampN(f,0,1);s._f=f;
 const x=t1===t0?(L+W-R)/2:L+f*(W-L-R),ts=t1===t0?t0:t0+f*(t1-t0);let val=v[0];
 if(t.length>1){let i=0;while(i<t.length-2&&t[i+1]<ts)i++;const a=t[i],b=t[i+1];val=b===a?v[i+1]:v[i]+(v[i+1]-v[i])*clampN((ts-a)/(b-a),0,1)}
 const y=T+(hi-val)/(hi-lo)*(H-T-B),g=s.querySelector('.xh'),q=n=>g.querySelector(n),set=(el,o)=>{for(const k in o)el.setAttribute(k,o[k])};
 g.style.display='';set(q('.xv'),{x1:x,x2:x});set(q('.xz'),{y1:y,y2:y,x2:x});set(q('.xd'),{cx:x,cy:y});
 const pr=q('.xp'),qr=q('.xq');set(pr.firstChild,{x:L-66,y:y-8});set(pr.lastChild,{x:L-8,y:y+4});pr.lastChild.textContent=scP(val);
 const qx=clampN(x-46,0,W-92);set(qr.firstChild,{x:qx,y:H-B+4});set(qr.lastChild,{x:qx+46,y:H-B+16});qr.lastChild.textContent=scD(ts);
 tip.innerHTML=`<b>${scP(val)}</b><span style="display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin:1px 0 3px">Avg. market price</span>${scD(ts)}`;tip.style.display='block';
 const r=q('.xd').getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=clampN(r.left+r.width/2-w/2,8,innerWidth-w-8)+'px';tip.style.top=(r.top-h-14<8?r.bottom+14:r.top-h-14)+'px'}
const hideX=s=>{const g=s&&s.querySelector('.xh');if(g)g.style.display='none';tip.style.display='none'};
const unpin=()=>{if(pin){hideX(pin);pin=null}tip.style.display='none'};
const dv=$('#dView');
dv.addEventListener('pointermove',e=>{const s=svgOf(e);if(!s)return;if(pin&&pin!==s)return;if(pin===s)return;if(isScrub(e))showX(s,fracOf(s,e));else hideX(s)});
dv.addEventListener('pointerdown',e=>{const s=svgOf(e);if(s&&isScrub(e)&&!pin&&e.pointerType!=='mouse')showX(s,fracOf(s,e))});
dv.addEventListener('pointerout',e=>{const s=svgOf(e);if(s&&isScrub(e)&&pin!==s&&!(e.relatedTarget&&e.relatedTarget.classList&&e.relatedTarget.classList.contains('scrub')))hideX(s)});
dv.addEventListener('click',e=>{const s=svgOf(e);
 if(!s||!isScrub(e)){if(pin)unpin();return}
 if(pin===s){unpin();return}
 if(pin)hideX(pin);showX(s,fracOf(s,e));pin=s;pinAt=Date.now()});
dv.addEventListener('keydown',e=>{const s=e.target.closest&&e.target.closest('svg.pch');if(!s)return;
 if(e.key==='Escape'){unpin();return}
 const st=e.shiftKey?.1:.02,f=s._f==null?(e.key==='ArrowLeft'?1:0):s._f;
 if(e.key==='ArrowRight'){showX(s,f+st);e.preventDefault()}else if(e.key==='ArrowLeft'){showX(s,f-st);e.preventDefault()}else if(e.key==='Home'){showX(s,0);e.preventDefault()}else if(e.key==='End'){showX(s,1);e.preventDefault()}});
dv.addEventListener('focusout',e=>{const s=svgOf(e);if(s&&pin!==s)hideX(s)});
dv.addEventListener('scroll',()=>{if(pin&&Date.now()-pinAt>400)unpin()},true);
dv.addEventListener('close',unpin);
function ensureD(c){const n=c.hist.length;if(c.histD&&c.histD.length===n)return;const b=Date.now(),a=Math.min(new Date(c.collected||b).getTime()||b,b);c.histD=c.hist.map((_,i)=>new Date(n>1?a+(b-a)*i/(n-1):b).toISOString().slice(0,10))}
function chart(c){ensureD(c);const W=480,H=236,L=68,R=22,T=16,B=50,v=c.hist,t=c.histD.map(d=>new Date(d).getTime());
 const mn=Math.min(...v),mx=Math.max(...v),pad=(mx-mn||mx||1)*.14,lo=Math.max(0,mn-pad),hi=mx+pad,t0=Math.min(...t),t1=Math.max(...t);
 const X=x=>t1===t0?(L+W-R)/2:L+(x-t0)/(t1-t0)*(W-L-R),Y=y=>T+(hi-y)/(hi-lo)*(H-T-B);
 const span=(t1-t0)/864e5,fx=x=>new Date(x).toLocaleDateString(undefined,span>330?{month:'short',year:'2-digit'}:{month:'short',day:'numeric'});
 const fy=n=>'$'+(hi-lo<10?n.toFixed(2):Math.round(n).toLocaleString());
 const gy=[0,1,2,3].map(i=>lo+(hi-lo)*i/3),gx=t1===t0?[t0]:[0,1,2,3].map(i=>t0+(t1-t0)*i/3);
 const pts=v.map((y,i)=>[X(t[i]),Y(y)]),ln=pts.map(q=>q.join(',')).join(' '),tx='style="fill:var(--mut);font-size:10px"',gl='style="stroke:var(--line);stroke-width:1"';
 return `<svg class="pch" tabindex="0" data-c="${esc(JSON.stringify({W,H,L,R,T,B,lo,hi,t0,t1,t,v}))}" viewBox="0 0 ${W} ${H}" width="100%" style="overflow:visible;touch-action:pan-y" role="img" aria-label="Price history chart. Move across it to read the price on any date.">
 ${gy.map(y=>`<line x1="${L}" x2="${W-R}" y1="${Y(y)}" y2="${Y(y)}" ${gl} stroke-dasharray="3 3"/><text x="${L-8}" y="${Y(y)+3}" text-anchor="end" ${tx}>${fy(y)}</text>`).join('')}
 ${gx.map(x=>`<line x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H-B}" ${gl} stroke-dasharray="3 3"/><text x="${X(x)}" y="${H-B+16}" text-anchor="middle" ${tx}>${fx(x)}</text>`).join('')}
 <text x="${(L+W-R)/2}" y="${H-6}" text-anchor="middle" ${tx}>Date</text>
 <text x="12" y="${(T+H-B)/2}" text-anchor="middle" transform="rotate(-90 12 ${(T+H-B)/2})" ${tx}>Average market price (USD)</text>
 <polygon points="${pts[0][0]},${H-B} ${ln} ${pts[pts.length-1][0]},${H-B}" style="fill:var(--acc);opacity:.1"/>
 <polyline fill="none" style="stroke:var(--acc);stroke-width:2.5;stroke-linejoin:round" points="${ln}"/>
 ${pts.map((q,i)=>`<g class="cpt" data-p="${'$'+v[i].toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}" data-d="${new Date(c.histD[i]).toLocaleDateString(undefined,{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'})}"><circle class="halo" cx="${q[0]}" cy="${q[1]}" r="11"/><circle class="dot" cx="${q[0]}" cy="${q[1]}" r="${i===pts.length-1?5:3.5}"/><circle cx="${q[0]}" cy="${q[1]}" r="14" fill="transparent"/></g>`).join('')}
 <g class="xh" style="display:none;pointer-events:none"><line class="xv" y1="${T}" y2="${H-B}"/><line class="xz" x1="${L}"/><circle class="xd" r="5"/><g class="xp"><rect width="62" height="16" rx="4"/><text text-anchor="end"/></g><g class="xq"><rect width="92" height="16" rx="4"/><text text-anchor="middle"/></g></g>
 <rect class="scrub" x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent" style="cursor:crosshair"/></svg>`}
