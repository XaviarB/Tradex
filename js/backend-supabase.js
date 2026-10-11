/* Tradéx: accounts backend on Supabase (Postgres, sign-in, photo storage). js/account.js talks only to window.TXBackend,
   so another provider (for example our own Node + Postgres server) can replace this file without touching sync or the UI.
   Active when /config.js sets window.TX_SUPABASE = {url, anonKey, providers}. Tables and privacy rules: supabase/schema.sql. */
(()=>{
const CFG=window.TX_SUPABASE;if(!CFG||!CFG.url||!CFG.anonKey)return;
const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',BUCKET='card-images',PAGE=1000;
let sb=null;const here=()=>location.origin+location.pathname,who=u=>u&&{id:u.id,email:u.email};
const ok=async q=>{const{data,error}=await q;if(error)throw new Error(error.message||String(error));return data};
const load=new Promise((res,rej)=>{if(window.supabase&&window.supabase.createClient)return res();const s=document.createElement('script');s.src=SDK;s.onload=res;s.onerror=()=>rej(new Error('Couldn’t load sign-in. Check your connection and reload.'));document.head.appendChild(s)})
 .then(()=>{sb=window.supabase.createClient(CFG.url,CFG.anonKey)});
let uid=null;
window.TXBackend={
 providers:CFG.providers||[],
 ready:()=>load,
 async session(){const{data}=await sb.auth.getSession();const u=who(data&&data.session&&data.session.user);uid=u&&u.id;return u},
 // recovery: someone opened a password reset link and needs to choose a new password.
 onChange(signedIn,signedOut,recovery){sb.auth.onAuthStateChange((ev,s)=>{if(ev==='PASSWORD_RECOVERY'&&recovery)setTimeout(recovery);if(s&&s.user){uid=s.user.id;setTimeout(()=>signedIn(who(s.user)))}else if(ev==='SIGNED_OUT')signedOut()})},
 async signUp(email,password){const d=await ok(sb.auth.signUp({email,password,options:{emailRedirectTo:here()}}));return{confirm:!d.session}},
 signIn:(email,password)=>ok(sb.auth.signInWithPassword({email,password})),
 emailLink:email=>ok(sb.auth.signInWithOtp({email,options:{emailRedirectTo:here(),shouldCreateUser:true}})),
 oauth:provider=>ok(sb.auth.signInWithOAuth({provider,options:{redirectTo:here()}})),
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
