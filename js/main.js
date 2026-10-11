/* Tradéx: App wiring (sidebar, navigation, filters) and first render. Loaded last. */
function sb(v){document.body.classList.toggle('sb-off',v);bgpos();try{localStorage.setItem('tradex_sb',v?'1':'')}catch(e){}}
$('#sbmin').onclick=()=>sb(true);$('#sbmax').onclick=()=>sb(false);
try{if(localStorage.getItem('tradex_sb'))sb(true)}catch(e){}
$('#nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;
 if(b.id==='nb'){ask('Name your new binder',{input:1,ok:'Next'}).then(async n=>{if(!n||S.binders.includes(n))return render();const gl=[...new Set([...Object.keys(GK),'Yu-Gi-Oh!',...S.cards.map(c=>c.game).filter(Boolean)])];let g=await ask('Which card game is this binder for? ('+gl.join(', ')+')',{input:1,def:gl[0],ok:'Create'});if(!g)return render();g=gl.find(x=>x.toLowerCase()===g.trim().toLowerCase())||g.trim();S.binders.push(n);(S.bg=S.bg||{})[n]=g;cur=n;spread=0;save();render()});return}
 cur=b.dataset.v;spread=0;render()};
$('#ft').onclick=()=>{$('#fp').hidden=!$('#fp').hidden};
$('#body').onclick=e=>{const gx=e.target.closest('[data-gx]');if(gx){const g=gx.dataset.gx;if(!OG.has(g)){OG.clear();resetGF();OG.add(g);PNL.open=true}else PNL.open=!PNL.open;render();pnl();return}
 if(e.target.closest('[data-gxx]')){OG.clear();resetGF();PNL.open=false;render();pnl();return}
 const ib=e.target.closest('[data-img]');if(ib)return pickImg(ib.dataset.img);
 const ic=e.target.closest('[data-imgclr]');if(ic){if(S.img)delete S.img[ic.dataset.imgclr];save();render();return}
 const c=e.target.closest('.card');if(c)return view(+c.dataset.id);
 const p=e.target.closest('[data-sp]');if(p){spread+=+p.dataset.sp;render();return}
 if(e.target.id==='rs')ask('How many pages does this binder have?',{input:1,def:String((S.meta||{})[cur]||10),ok:'Save'}).then(v=>{const n=parseInt(v);if(n>0){(S.meta=S.meta||{})[cur]=n;save();render()}})};
['q','fg','fr','fc','sort','grp'].forEach(i=>$('#'+i).addEventListener('input',render));
$('#gchips').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.g&&![...$('#fg').options].some(o=>o.value===b.dataset.g))setup();$('#fg').value=b.dataset.g;render()};
$('#gfp').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
 if(d.pc==='x'){PNL.open=false;pnl();render();return}
 if(d.pc==='clear')resetGF();
 else if(d.cs)CS.has(d.cs)?CS.delete(d.cs):CS.add(d.cs);
 else if(d.sort){if(GF.sort===d.sort)GF.dir=GF.dir==='d'?'a':'d';else{GF.sort=d.sort;GF.dir=['name','artist','num','release'].includes(d.sort)?'a':'d'}}
 else if(d.s)GF[d.s]=d.v;
 else if(d.ms){const x=GF.sel[d.ms]||(GF.sel[d.ms]=new Set());x.has(d.v)?x.delete(d.v):x.add(d.v)}
 render();pnl()});
$('#gfp').addEventListener('input',e=>{if(e.target.id==='gq'){GF.q=e.target.value;render()}});
setup();render();
