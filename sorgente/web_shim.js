// Versione web (Vercel): sostituisce le funzioni di claude.ai con le API del sito
window.WEB_SITE=true;
(function(){
  const toB64=b=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=ko;r.readAsDataURL(b)});
  async function call(input,opts={}){
    const messages=typeof input==="string"?[{role:"user",content:input}]:input;
    const images=[];for(const b of(opts.images||[]))images.push({media_type:b.type||"image/jpeg",data:await toB64(b)});
    let r;
    try{r=await fetch("/api/claude",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages,images}),signal:opts.signal})}
    catch(e){if(e&&e.name==="AbortError")throw{code:"cancelled",text:""};throw{code:"network"}}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw{code:j.code||(r.status===429?"rate_limited":"error"),message:j.message};
    if(opts.onText)opts.onText({text:j.text,delta:j.text});
    return{text:j.text,truncated:!!j.truncated};
  }
  const sample=(input,opts)=>call(input,opts);
  sample.json=async(input,opts)=>{const{text}=await call(input,opts);const m=text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);if(!m)throw{code:"invalid_json"};try{return JSON.parse(m[0])}catch(e){throw{code:"invalid_json"}}};
  sample.limits=async()=>({images:true});
  window.claude={use:async n=>n==="sample"?sample:null};
  window.loadMercato=async()=>{const r=await fetch("/api/mercato");if(!r.ok)return null;return r.json()};
})();
