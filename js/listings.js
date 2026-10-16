/* Tradéx: the market boxes on a card open that card's own page on the market (its listings) in a popup window.
   If the browser blocks the popup, the link opens in a new tab as usual. */
document.addEventListener('click',e=>{
 const a=e.target.closest&&e.target.closest('.pc[data-ls]');
 if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
 const w=Math.min(1200,screen.availWidth-40),h=Math.min(900,screen.availHeight-60);
 const win=window.open(a.href,'tradex-market',`popup=yes,width=${w},height=${h},left=${Math.round((screen.availWidth-w)/2)},top=${Math.round((screen.availHeight-h)/2)}`);
 if(win){e.preventDefault();try{win.opener=null}catch(x){}win.focus()}
},true);
