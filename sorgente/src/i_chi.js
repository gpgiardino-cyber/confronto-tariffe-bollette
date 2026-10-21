
// ---------- assistente ----------
const chat={msgs:[],busy:false,ctl:null};
const SUGG=["Quanto ho speso di gas l'anno scorso?","Qual è stata la bolletta più cara e perché?","Mi conviene cambiare offerta?","Quanto pago anche senza consumare?","Cosa vogliono dire F1, F2 e F3?"];
const r3=v=>v==null?null:Math.round(v*1000)/1000;
function chatContext(){
  const bl=S.bills.slice().sort((a,b)=>(a.casa+a.tipo+a.al).localeCompare(b.casa+b.tipo+b.al)).map(b=>[b.casa,b.tipo,b.n,b.dal,b.al,b.consumo,b.tipo==="luce"?[b.f1,b.f2,b.f3].join("/"):"",b.offerta||"",b.prezzo??"",b.totale,b.canone||0,b.crediti||0,paid(b),b.anno1?`${b.anno1}:${b.quota1}/${b.anno2}`:"",verify(b).lbl,b.stima?"stima":"",(b.note||"").replace(/\s+/g," ").slice(0,160)].join(";"));
  const ann=[];for(const c of casaIds())for(const t of["gas","luce"]){const A=fvAnnual([c],[t]);for(const[y,a]of Object.entries(A))ann.push([c,t,y,r2(a.n),Math.round(a.consumo),r2(a.fisso),r2(a.variabile),r2(a.altre+a.crediti),r2(a.canone),r2(a.pagato)].join(";"))}
  const fv=Object.values(fvModels()).map(m=>[m.casa,m.tipo,m.offerta,m.dal,m.al,m.nb,r2(m.F),r3(m.v),r3(m.r2)].join(";"));
  const off=[];for(const c of casaIds())for(const t of["gas","luce"]){const R=offerRows(c,t);if(!R)continue;off.push(`${CASA_N[c]} ${t}: consumo ${R.cc.decl?"annuo inserito":"ultimi 12 mesi"} ${Math.round(R.cc.c)} ${UNIT[t]}; offerta attuale ${R.cur.nome} costo materia annuo con IVA ${r2(R.base.lordo)} €`);for(const r of R.rows.slice(0,8))off.push(`  - ${r.o.fornitore} ${r.o.nome}: ${r2(r.cost)} €/anno, risparmio ${r2(r.saving)} €/anno${r.o.note?" ("+r.o.note+")":""}`)}
  const J=o=>JSON.stringify(o);
  return `DATI DELL'UTENTE nel sito "Confronto tariffe bollette" (oggi è il ${fmtD(TODAY)}).
Case (id: nome): ${casaIds().map(c=>`${c}: ${CASA_N[c]}`).join(", ")}. Unità: gas in Smc, luce in kWh, importi in euro.
Regole: "totale" = totale bolletta stampato (luce senza canone RAI; gas prima dei crediti); "pagato" = totale + canone + crediti. Le bollette a cavallo d'anno sono divise fra i due anni secondo quota1 (quota sull'anno1), altrimenti vanno sull'anno di fine periodo. Le righe "stima" sono stime senza bolletta.

BOLLETTE (casa;tipo;n fattura;dal;al;consumo;F1/F2/F3;offerta;prezzo €/Smc;totale;canone;crediti;pagato;ripartizione anni;stato verifica;stima;note)
${bl.join("\n")}

RIEPILOGO PER ANNO (casa;tipo;anno;n bollette;consumo;quota fissa €;consumi €;bonus/ricalcoli/crediti €;canone €;pagato €)
${ann.join("\n")}

QUOTA FISSA E COSTO VARIABILE PER OFFERTA (casa;tipo;offerta;dal;al;n bollette;€/mese fissi;€/unità variabile;R²)
${fv.join("\n")}

CONSUMI MENSILI (chiave casa-tipo-anno: valori gen..dic, null = mancante; stimati = mesi stimati)
${Object.entries(S.mensili).map(([k,v])=>`${k}: ${J(v.valori)}${v.stimati&&v.stimati.length?" stimati "+J(v.stimati):""}`).join("\n")}

CASE E CONTRATTI
${J(S.case)}

CONFRONTO OFFERTE (sola materia prima con IVA, consumi ultimi 12 mesi)
${off.join("\n")}
Indici di mercato e offerta attuale inserita: ${J(S.param)}
Offerte nel confronto: ${Object.keys(S.offerte).length}, lette il ${Object.values(S.offerte).reduce((a,o)=>(o.aggiornato||"")>a?o.aggiornato:a,"")}`}
const CHAT_RULES=`Sei l'assistente del sito "Confronto tariffe bollette", che aiuta chiunque a capire le proprie bollette di luce e gas. Rispondi in italiano, in modo semplice e diretto, usando SOLO i dati qui sotto. Fai i conti con attenzione e indica da dove vengono i numeri (quali bollette, quale anno, quale sezione del sito). Se un dato manca, dillo chiaramente invece di inventarlo; se è una stima, dillo. Formatta gli importi come 1.234,56 € e usa al massimo brevi elenchi puntati con "- " e il grassetto con **. Niente tabelle. Puoi suggerire in quale sezione del sito guardare (Panoramica, Bollette, Consumi e costi, Offerte, Dati). Non puoi modificare i dati. Se l'utente non ha ancora caricato bollette, spiega come farlo (Dati > Aggiungi) e rispondi alle domande generali su bollette e offerte senza inventare numeri. Non dare consigli su un fornitore specifico oltre a quello che risulta dal confronto.`;
function mdLite(s){const esc=x=>x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");const lines=esc(s).split("\n");let out="",inList=false;
  for(let l of lines){l=l.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/^#{1,4}\s*(.+)$/,"<b>$1</b>");const m=l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if(m){if(!inList){out+="<ul>";inList=true}out+=`<li>${m[1]}</li>`}else{if(inList){out+="</ul>";inList=false}out+=l.trim()?`<p>${l}</p>`:""}}
  return out+(inList?"</ul>":"")}
function chatBubble(m){const b=el("div",{class:"msg "+m.role});if(m.role==="user")b.textContent=m.content;else if(m.err)b.append(el("div",{class:"errbox",text:m.err}));else{b.innerHTML=m.content?mdLite(m.content):'<span class="muted">Sto guardando i dati…</span>'}return b}
function paintChat(){const log=$("#chi-log");if(!log)return;
  log.replaceChildren(...(chat.msgs.length?chat.msgs.map(chatBubble):[el("div",{class:"chi-empty"},el("p",{class:"muted",text:"Fai una domanda sulle tue bollette, sui consumi o sulle offerte. Rispondo usando i dati che hai salvato qui."}),el("div",{class:"chips"},...SUGG.map(q=>el("button",{class:"chip",type:"button",text:q,onclick:()=>askChat(q)}))))]));
  const send=$("#chi-send");send.textContent=chat.busy?"Ferma":"Chiedi";send.classList.toggle("primary",!chat.busy);$("#chi-q").disabled=!S.sample;send.disabled=!S.sample;
  $("#chi-clear").hidden=!chat.msgs.length||chat.busy;log.scrollTop=log.scrollHeight}
async function askChat(q){q=(q||"").trim();if(!q||chat.busy||!S.sample)return;
  chat.msgs.push({role:"user",content:q});const a={role:"assistant",content:""};chat.msgs.push(a);chat.busy=true;chat.ctl=new AbortController();paintChat();
  const hist=chat.msgs.slice(0,-1).filter(m=>!m.err).slice(-9);while(hist.length&&hist[0].role!=="user")hist.shift();
  const input=hist.map((m,i)=>({role:m.role,content:i===0?`${CHAT_RULES}\n\n${chatContext()}\n\nDOMANDA: ${m.content}`:m.content}));
  try{const r=await S.sample(input,{cache:false,signal:chat.ctl.signal,onText:({text})=>{a.content=text;const last=$("#chi-log").lastElementChild;if(last)last.replaceWith(chatBubble(a));$("#chi-log").scrollTop=1e9}});a.content=r.text}
  catch(e){const c=e&&e.code;if(c==="cancelled"){a.content=(e.text||a.content||"")+(a.content?"\n\n(interrotta)":"");if(!a.content)chat.msgs.splice(-2)}
    else{a.content="";a.err=c==="not_granted"||c==="sampling_disabled"?"L'assistente non è stato autorizzato. Puoi consentirlo dal menu Permessi della pagina.":c==="rate_limited"?"Troppe domande ravvicinate: riprova fra qualche minuto.":c==="prompt_too_large"?"La conversazione è diventata troppo lunga: cancellala e riparti.":"Non sono riuscito a rispondere. Riprova tra poco."}}
  chat.busy=false;chat.ctl=null;paintChat()}
function renderChi(){
  const box=$("#chi-body");if(!box.dataset.ready){box.dataset.ready="1";
    const ta=el("textarea",{id:"chi-q",rows:2,placeholder:"Scrivi una domanda…","aria-label":"Domanda"});
    ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chi-send").click()}});
    const send=el("button",{class:"btn primary",type:"button",id:"chi-send",onclick:()=>{if(chat.busy){chat.ctl&&chat.ctl.abort();return}const v=ta.value;ta.value="";askChat(v)}});
    const clear=el("button",{class:"btn",type:"button",id:"chi-clear",text:"Nuova conversazione",onclick:()=>{chat.msgs=[];paintChat()}});
    box.replaceChildren(el("div",{class:"panel chi"},el("div",{class:"chi-log",id:"chi-log","aria-live":"polite"}),el("div",{class:"chi-in"},ta,el("div",{class:"controls"},clear,send))))}
  $("#chi-lead").textContent=!S.sample?(S.web?"L'assistente non è disponibile in questo momento.":"L'assistente funziona aprendo la pagina con un account Claude."):(S.web?"Risponde con i dati che hai salvato: bollette, consumi e offerte. Le domande vengono inviate a Claude insieme a un riepilogo dei tuoi dati, che non viene conservato.":"Risponde con i dati che hai salvato: bollette, consumi e offerte. Usa il tuo account Claude; la prima volta la pagina ti chiede il permesso.");
  paintChat()}
