/* Tradéx: accounts backend on Supabase (Postgres, sign-in, photo storage). js/account.js talks only to window.TXBackend,
   so another provider (for example our own Node + Postgres server) can replace this file without touching sync or the UI.
   Active when /config.js sets window.TX_SUPABASE = {url, anonKey, providers}. Tables and privacy rules: supabase/schema.sql. */
(()=>{
const CFG=window.TX_SUPABASE;if(!CFG||!CFG.url||!CFG.anonKey)return;
const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',BUCKET='card-images',PAGE=1000;
let sb=null;const here=()=>location.origin+location.pathname;
// verified: the person has shown they own the email. Google/Apple accounts already have; email accounts verify with the
// link we send after sign-up (tx_verified). Accounts made while Supabase still required confirming before sign-in were
// confirmed well after they were created, so they count as verified too.
const who=u=>u&&{id:u.id,email:u.email,verified:!!((u.user_metadata||{}).tx_verified||((u.app_metadata||{}).provider&&(u.app_metadata||{}).provider!=='email')
 ||(u.email_confirmed_at&&u.created_at&&new Date(u.email_confirmed_at)-new Date(u.created_at)>60000))};
const ok=async q=>{const{data,error}=await q;if(error)throw new Error(error.message||String(error));return data};
const load=new Promise((res,rej)=>{if(window.supabase&&window.supabase.createClient)return res();const s=document.createElement('script');s.src=SDK;s.onload=res;s.onerror=()=>rej(new Error('Couldn’t load sign-in. Check your connection and reload.'));document.head.appendChild(s)})
 .then(()=>{sb=window.supabase.createClient(CFG.url,CFG.anonKey)});
let uid=null,provs=null;
window.TXBackend={
 // Which one-tap providers are switched on in Supabase (Authentication → Providers), asked from Supabase itself.
 providers(){return provs=provs||fetch(CFG.url+'/auth/v1/settings',{headers:{apikey:CFG.anonKey}}).then(r=>r.json()).then(j=>Object.keys(j.external||{}).filter(k=>j.external[k])).catch(()=>{provs=null;return CFG.providers||[]})},
 ready:()=>load,
 async session(){const{data}=await sb.auth.getSession();const u=who(data&&data.session&&data.session.user);uid=u&&u.id;return u},
 // recovery: someone opened a password reset link and needs to choose a new password.
 onChange(signedIn,signedOut,recovery){sb.auth.onAuthStateChange((ev,s)=>{if(ev==='PASSWORD_RECOVERY'&&recovery)setTimeout(recovery);if(s&&s.user){uid=s.user.id;setTimeout(()=>signedIn(who(s.user)))}else if(ev==='SIGNED_OUT')signedOut()})},
 async signUp(email,password){const d=await ok(sb.auth.signUp({email,password,options:{emailRedirectTo:here()}}));return{confirm:!d.session}},
 signIn:(email,password)=>ok(sb.auth.signInWithPassword({email,password})),
 // The "verify your email" message after sign-up. It is Supabase's one-time sign-in link (Magic Link email template);
 // opening it proves the address works and comes back with ?verified=1 so the app can record it.
 sendVerify:email=>ok(sb.auth.signInWithOtp({email,options:{emailRedirectTo:here()+'?verified=1',shouldCreateUser:false}})),
 markVerified:()=>ok(sb.auth.updateUser({data:{tx_verified:true}})),
 // Opens Google or Apple in a popup, like most sites. The popup comes back to this page, which finishes sign-in and closes.
 // Resolves when the popup closes. If popups are blocked, the whole page goes to the provider instead.
 async oauth(provider){const d=await ok(sb.auth.signInWithOAuth({provider,options:{redirectTo:here(),skipBrowserRedirect:true}}));
  const w=500,h=640,y=Math.max(0,(screen.height-h)/2),x=Math.max(0,(screen.width-w)/2),pop=window.open(d.url,'tradex-auth',`width=${w},height=${h},left=${x},top=${y}`);
  if(!pop){location.assign(d.url);return new Promise(()=>{})}
  pop.focus();await new Promise(res=>{const t=setInterval(()=>{if(pop.closed){clearInterval(t);res()}},400)})},
 resetPassword:email=>ok(sb.auth.resetPasswordForEmail(email,{redirectTo:here()})),
 updatePassword:password=>ok(sb.auth.updateUser({password})),
 resendConfirm:email=>ok(sb.auth.resend({type:'signup',email,options:{emailRedirectTo:here()}})),
 signOut:()=>sb.auth.signOut(),
 // Every row changed since `since` (an updated_at from an earlier list), deleted ones included.
 async list(table,since){const out=[];for(let i=0;;i+=PAGE){let q=sb.from(table).select('*').order('updated_at');if(since)q=q.gte('updated_at',since);
  const d=await ok(q.range(i,i+PAGE-1));out.push(...d);if(d.length<PAGE)return out}},
 links:cardIds=>ok(sb.from('binder_cards').select('binder_id,card_id').in('card_id',cardIds)),
 upsert:(table,rows)=>ok(sb.from(table).upsert(rows)),
 remove:(table,ids,when)=>ok(sb.from(table).update({deleted_at:when}).in('id',ids)),
 async setLinks(cardIds,links){await ok(sb.from('binder_cards').delete().in('card_id',cardIds));if(links.length)await ok(sb.from('binder_cards').insert(links))},
 async getSettings(){const p=await ok(sb.from('profiles').select('settings').eq('id',uid).maybeSingle());return p&&p.settings||{}},
 setSettings:s=>ok(sb.from('profiles').update({settings:s}).eq('id',uid)),
 async upload(blob){const p=uid+'/'+crypto.randomUUID()+'.jpg';await ok(sb.storage.from(BUCKET).upload(p,blob,{contentType:blob.type||'image/jpeg',upsert:false}));return sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl}
};
})();
