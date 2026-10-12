// "Suggest an edit" dialog, ported from am-i-industry-ready.art. Any element
// with [data-feedback] opens it. Posts to /api/feedback.
(function(){
const IG='https://www.instagram.com/andre_korev/';
const id=(store,key)=>{ try{ let v=store.getItem(key); if(!v){ v=crypto.randomUUID(); store.setItem(key,v); } return v; }catch(e){ return undefined; } };

const dlg=document.createElement('dialog');
dlg.className='fb';
dlg.setAttribute('aria-labelledby','fb-title');
dlg.innerHTML=
  '<h2 id="fb-title">Suggest an edit</h2>'+
  '<p class="fb-lead">See something that is unclear, wrong, or missing? Send a suggestion.</p>'+
  '<section class="fb-ig"><h3>Prefer Instagram?</h3><p>Send me a message about the tool. I read every message.</p>'+
  '<a href="'+IG+'" target="_blank" rel="me noreferrer">Message me on Instagram <span aria-hidden="true">↗</span></a></section>'+
  '<div class="fb-done" hidden><p>Thanks. Your suggestion was received.</p><button type="button" class="btn fb-close">Close</button></div>'+
  '<form class="fb-form" novalidate>'+
    '<div class="fb-or" aria-hidden="true"><span>Or submit the form</span></div>'+
    '<label for="fb-where">Which part of the lab? <i>(optional)</i></label>'+
    '<input id="fb-where" name="where" maxlength="200" spellcheck="false" placeholder="e.g. Cone of vision, Rotation hint">'+
    '<label for="fb-text">What should change?</label>'+
    '<textarea id="fb-text" name="text" rows="5" maxlength="5000" placeholder="What is unclear, wrong, or missing?"></textarea>'+
    '<label for="fb-contact">Contact <i>(optional)</i></label>'+
    '<input id="fb-contact" name="contact" maxlength="300" spellcheck="false" placeholder="Email or handle, if you\'d like a reply">'+
    '<p class="fb-note">Only what you type is sent, along with the page you are on and a rough location.</p>'+
    '<div class="fb-actions"><button type="submit" class="btn fb-send" disabled>Send suggestion</button>'+
    '<span class="fb-err" role="alert" hidden>The suggestion could not be sent. Please try again.</span>'+
    '<button type="button" class="fb-x fb-close">Close</button></div>'+
  '</form>';
document.body.appendChild(dlg);

const form=dlg.querySelector('form'), send=dlg.querySelector('.fb-send'), err=dlg.querySelector('.fb-err'), done=dlg.querySelector('.fb-done');
const F=form.elements;
let sending=false;
const sync=()=>{ send.disabled=sending || !F.text.value.trim(); send.textContent=sending?'Sending…':'Send suggestion'; };
F.text.addEventListener('input', sync);

function open(){
  if (!done.hidden){ form.reset(); done.hidden=true; form.hidden=false; }
  err.hidden=true; sync();
  dlg.showModal(); F.text.focus();
}
dlg.querySelectorAll('.fb-close').forEach(b=>b.addEventListener('click', ()=>dlg.close()));
dlg.addEventListener('click', e=>{ if (e.target!==dlg) return; const r=dlg.getBoundingClientRect(); if (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dlg.close(); });
document.addEventListener('click', e=>{ const t=e.target.closest('[data-feedback]'); if (t){ e.preventDefault(); open(); } });

form.addEventListener('submit', async e=>{
  e.preventDefault();
  if (send.disabled) return;
  sending=true; err.hidden=true; sync();
  let ok=false;
  try{
    const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      where:F.where.value, text:F.text.value, contact:F.contact.value, path:location.pathname,
      visitorId:id(localStorage,'kp-vid'), sessionId:id(sessionStorage,'kp-sid')
    })});
    ok=r.ok;
  }catch(e){}
  sending=false; sync();
  if (ok){ form.hidden=true; done.hidden=false; done.querySelector('button').focus(); }
  else err.hidden=false;
});
})();
