/* Tradéx: owner password gate, only active when a Tradéx server asks for it (window.TX_OWNER_GATE). Accounts replaced it. */
(()=>{
const H=document.documentElement,PW=()=>{try{return localStorage.getItem('tradex_pw')||''}catch(e){return''}};
const ping=()=>fetch('/api/owner/ping',{headers:{'x-owner':PW()}}).then(r=>{if(!r.ok)throw 0});
async function unlock(){let ok=false;for(let k=0;k<3&&!ok;k++){if(!PW()){const v=prompt('Owner password');if(!v)break;try{localStorage.setItem('tradex_pw',v)}catch(e){}}try{await ping();ok=true}catch(e){try{localStorage.removeItem('tradex_pw')}catch(x){}}}
 if(!ok){document.body.innerHTML='<p style="padding:30px;font:16px system-ui">Password needed. Reload to try again.</p>';return}
 H.classList.remove('pend')}
(async()=>{if(window.TX_SERVER&&window.TX_OWNER_GATE)return unlock();if(!window.TX_SUPABASE)H.classList.remove('pend')})();
setTimeout(()=>H.classList.remove('pend'),4000);
})();
