
// ---------- dati: aggiungi bolletta ----------
let pdfReady=null;
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("load"));document.head.append(s)})}
function loadPdf(){if(!pdfReady)pdfReady=(async()=>{const base="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";await loadScript(base+"pdf.min.js");window.pdfjsLib.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.js";return window.pdfjsLib})();return pdfReady}
async function pdfToInput(file){const lib=await loadPdf();const doc=await lib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;let text="";for(let i=1;i<=Math.min(doc.numPages,8);i++){const pg=await doc.getPage(i);const tc=await pg.getTextContent();text+=`\n--- pagina ${i} ---\n`+tc.items.map(it=>it.str+(it.hasEOL?"\n":" ")).join("")}
  text=text.replace(/[ \t]+/g," ").slice(0,60000);let images=[];
  if(text.replace(/[\s\-pagina0-9]/g,"").length<300&&S.limits&&S.limits.images){for(let i=1;i<=Math.min(doc.numPages,Math.min(3,S.limits.images.maxCount||3));i++){const pg=await doc.getPage(i);const vp=pg.getViewport({scale:1.6});const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;await pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;images.push(await new Promise(r=>cv.toBlob(r,"image/png")))}}
  return{text,images}}
const PROMPT=(text,hasImg)=>`Sei un assistente che legge bollette italiane di luce e gas di qualsiasi fornitore (Enel, A2A, Edison, Hera, Iren, Eni Plenitude, Sorgenia e altri). Estrai i dati della bolletta ${hasImg?"nelle immagini allegate":"nel testo qui sotto (estratto da un PDF)"}.
Rispondi SOLO con un oggetto JSON con questi campi (null se il dato manca; numeri con il punto decimale, senza €; date AAAA-MM-GG):
{"tipo":"gas"|"luce","fornitore":string,"n":"numero fattura","emissione":data,"scadenza":data di scadenza del pagamento,"dal":data inizio periodo fatturato,"al":data fine periodo,
"offerta":"nome offerta","prezzo":prezzo materia gas €/Smc (solo gas),"lettura_iniziale":numero,"lettura_finale":numero,"tipo_lettura":"Rilevato"|"Stimato"|"Autolettura",
"consumo":Smc (gas) o kWh totali (luce) fatturati nel periodo,"f1":kWh,"f2":kWh,"f3":kWh (solo luce),
"vendita":spesa per la materia gas (solo gas),"spesa_energia":spesa per la vendita di energia elettrica COMPRESI rete e oneri se la bolletta li raggruppa (solo luce),
"rete_oneri":spesa per trasporto/gestione contatore e oneri di sistema,"altre":altre partite/ricalcoli/bonus (negativo se a credito),"accise_iva":imposte (accise + IVA),
"totale":"Totale bolletta" stampato (per la luce ESCLUSO il canone RAI; per il gas PRIMA di crediti/compensazioni),"canone":canone RAI addebitato (0 se assente),
"crediti":compensazioni/crediti scalati dal totale da pagare (negativo),"totale_da_pagare":importo finale da pagare,
"consumo_annuo":consumo annuo o degli ultimi 12 mesi stampato in bolletta (Smc o kWh) o null,
"fine_prezzo":data fino a cui il prezzo dell'offerta è bloccato o le condizioni economiche sono valide, se indicata, altrimenti null,
"mensili":[{"mese":"AAAA-MM","valore":numero}] consumi mensili dal grafico o tabella dello storico consumi se presente (gas Smc, luce kWh), altrimenti [],
"pdr":"codice PDR (solo gas) o null","pod":"codice POD (solo luce) o null","indirizzo_fornitura":"indirizzo del punto di fornitura",
"quota_fissa":somma in € (IVA esclusa) di TUTTE le quote fisse del periodo: quota fissa di vendita/commercializzazione + quota fissa e quota potenza di trasporto, gestione contatore e oneri. Cercale negli elementi di dettaglio o nella tabella "quota fissa / quota potenza / quota energia" di ogni sezione (spesa per la materia, trasporto e gestione del contatore, oneri di sistema); le voci in €/mese, €/anno o €/giorno vanno moltiplicate per il periodo fatturato; null solo se la bolletta non le riporta da nessuna parte,
"quota_fissa_vendita":€ della sola quota fissa di vendita/commercializzazione (spesa per la materia energia/gas) nel periodo, calcolata allo stesso modo, o null,
"note":"breve nota in italiano su anomalie, conguagli, cambi di offerta o letture stimate, altrimenti stringa vuota"}
Se il documento non è una bolletta di luce o gas rispondi {"errore":"spiegazione breve"}.
${text?"\nTESTO DELLA BOLLETTA:\n"+text:""}`;
// bills are read two at a time so a batch of uploads doesn't trip the rate limit
const readQ=[];let reading=0;
function queueExtract(c){readQ.push(c);pump()}
function pump(){while(reading<2&&readQ.length){const c=readQ.shift();reading++;extract(c).finally(()=>{reading--;pump()})}}
async function extract(card){
  const f=card.file;card.status="reading";paintCard(card);
  try{
    let text="",images=[];
    if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){const r=await pdfToInput(f);text=r.text;images=r.images;if(!text.trim()&&!images.length)throw{code:"no_text"}}
    else{if(!S.limits||!S.limits.images)throw{code:"no_images"};images=[f]}
    card.status="asking";paintCard(card);
    const out=await S.sample.json(PROMPT(text,images.length>0),images.length?{images}:{});
    if(!out||typeof out!=="object")throw{code:"invalid_json"};if(out.errore)throw{code:"not_bill",message:out.errore};
    const d={casa:card.casa};for(const k of["tipo","n","emissione","scadenza","dal","al","offerta","tipo_lettura","note","fornitore","fine_prezzo"])if(out[k]!=null&&out[k]!=="")d[k]=String(out[k]);
    for(const k of["prezzo","lettura_iniziale","lettura_finale","consumo","f1","f2","f3","vendita","spesa_energia","rete_oneri","altre","accise_iva","totale","canone","crediti","quota_fissa","quota_fissa_vendita","consumo_annuo"]){const v=num(out[k]);if(v!=null)d[k]=v}
    if(d.fine_prezzo&&!pd(d.fine_prezzo))delete d.fine_prezzo;
    d.tipo=normTipo(out,d);card.ids={pdr:out.pdr||null,pod:out.pod||null};const who=detectCasa(out,d.tipo);if(who){d.casa=who.casa;card.recog=who}
    if(d.offerta){const m=matchOffer(d.casa,d.tipo,d.offerta);if(m&&m!==d.offerta){card.recog=card.recog||{casa:d.casa,why:"te"};card.recog.offerta=`«${d.offerta}» riconosciuta come «${m}»`;d.offerta=m}}
    if(d.tipo==="luce"&&d.f1!=null&&!d.consumo)d.consumo=(d.f1||0)+(d.f2||0)+(d.f3||0);
    card.mensili=Array.isArray(out.mensili)?out.mensili.filter(x=>x&&/^\d{4}-\d{2}$/.test(x.mese)&&num(x.valore)!=null).map(x=>({mese:x.mese,valore:num(x.valore)})):[];
    card.check=num(out.totale_da_pagare);
    normalizeParts(d);applySplitDefault(d);card.data=d;card.status="review";
  }catch(e){card.status="error";const c=e&&e.code;card.err=c==="not_granted"||c==="sampling_disabled"?"La lettura automatica non è stata autorizzata. Puoi inserire i dati a mano.":c==="rate_limited"?"Troppe richieste ravvicinate: riprova fra qualche minuto.":c==="no_text"?"Il PDF non contiene testo leggibile. Prova con una foto della bolletta o inserisci i dati a mano.":c==="no_images"||c==="images_unavailable"?"Da qui non posso inviare immagini a Claude: carica il PDF oppure inserisci i dati a mano.":c==="not_bill"?"Non sembra una bolletta di luce o gas: "+(e.message||""):c==="invalid_json"?"Claude non ha restituito dati leggibili. Puoi riprovare.":c==="image_rejected"?"Immagine non accettata: prova con un file più piccolo o con il PDF.":"Non sono riuscito a leggere il file. Puoi riprovare o inserire i dati a mano."}
  paintCard(card);paintBatch();
}
// cross-year bills: split in proportion to the months, the visitor can change it
function applySplitDefault(d){const a=pd(d.dal),b=pd(d.al);if(a&&b&&a.y!==b.y&&d.quota1==null){d.anno1=a.y;d.anno2=b.y;const ms=monthsIn(d.dal,d.al);const n1=ms.filter(([y])=>y===a.y).length;d.quota1=Math.round(n1/ms.length*100)/100}}

// recognise the house from PDR/POD already seen on earlier bills
const digits=x=>String(x||"").replace(/[^0-9A-Za-z]/g,"").toUpperCase();
function normTipo(out,d){const t=String(out.tipo||"").toLowerCase();if(/gas|metano/.test(t))return"gas";if(/luce|elettric/.test(t))return"luce";if(out.pdr&&!out.pod)return"gas";if(out.pod&&!out.pdr)return"luce";if(d.f1!=null||d.f2!=null||d.spesa_energia!=null)return"luce";if(d.vendita!=null||d.lettura_finale!=null)return"gas";return"gas"}
function detectCasa(out,tipo){const pdr=digits(out.pdr),pod=digits(out.pod);
  for(const[c,info]of Object.entries(S.case)){if(pdr&&info.pdr&&pdr.includes(digits(info.pdr)))return{casa:c,why:`PDR ${info.pdr}`};if(pod&&info.pod&&pod.includes(digits(info.pod)))return{casa:c,why:`POD ${info.pod}`}}
  return null}
const normName=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
function matchOffer(casa,tipo,name){const n=normName(name);if(!n)return null;const names=[...new Set(S.bills.filter(b=>b.casa===casa&&b.tipo===tipo&&b.offerta).map(b=>b.offerta))];
  return names.find(x=>normName(x)===n)||names.find(x=>{const m=normName(x);return m.length>5&&(m.includes(n)||n.includes(m))})||null}
// the site keeps luce "spesa_energia" inclusive of network charges, and credits only in "crediti"
// bills group their items differently: find the reading whose items add up to the printed total
// (luce: network charges inside the energy spend; a small credit outside the total goes to "crediti")
function normalizeParts(d){const near=(x,y)=>Math.abs(x-y)<0.02,luce=d.tipo==="luce";
  if(d.altre&&d.crediti&&near(d.altre,d.crediti))d.altre=0;
  if(d.totale==null||(luce?d.spesa_energia==null:d.vendita==null))return d;
  const head=luce?(d.spesa_energia||0):(d.vendita||0)+(d.rete_oneri||0),a=d.altre||0,rete=luce?(d.rete_oneri||0):0,s0=head+a+(d.accise_iva||0);
  if(near(s0,d.totale))return d;
  const toCred=()=>{d.crediti=r2((d.crediti||0)+a);d.altre=0;if(d.pagato!=null)d.pagato=r2((d.totale||0)+(d.canone||0)+d.crediti)};
  if(rete&&near(s0+rete,d.totale)){d.spesa_energia=r2(d.spesa_energia+rete);return d}
  if(a<0&&!d.crediti&&near(s0-a,d.totale)){toCred();return d}
  if(rete&&a<0&&!d.crediti&&near(s0-a+rete,d.totale)){d.spesa_energia=r2(d.spesa_energia+rete);toCred();return d}
  return d}
const cards=[];let cardSeq=0;
function addCard(c){c.id=++cardSeq;cards.unshift(c);const node=el("div",{class:"card",id:"card-"+c.id});$("#queue").prepend(node);c.node=node;paintCard(c);paintBatch();node.scrollIntoView({block:"nearest"});return c}
function handleFiles(list,opt={}){const casa=upCasa();for(const f of list){if(/\.json$/i.test(f.name)){S.dt="imp";go("dat");importFiles([f]);continue}const c=addCard({casa,file:f,status:"wait",quick:!!opt.quick});if(S.sample)queueExtract(c);else{c.status="review";c.data={casa};c.manualNote=true;paintCard(c)}}}
const upCasa=()=>{const v=$("#up-casa").value;return CASA_N[v]?v:casaIds()[0]};
function field(c,key,label,type="number",opts={}){const v=c.data[key];const id=`c${c.id}-${key}`;let inp;
  if(type==="select"){inp=el("select",{id},...opts.options.map(([val,t])=>el("option",{value:val,text:t,selected:String(v)===String(val)})))}
  else inp=el("input",{id,type,step:type==="number"?"any":null,value:v==null?"":v,readonly:opts.calc||null});
  inp.addEventListener("input",()=>{let val=inp.value;if(type==="number")val=num(val);c.data[key]=val===""?null:val;if(["f1","f2","f3"].includes(key)&&c.data.tipo==="luce")c.data.consumo=(c.data.f1||0)+(c.data.f2||0)+(c.data.f3||0);if(["dal","al","casa"].includes(key)){delete c.data.quota1;delete c.data.anno1;delete c.data.anno2;delete c.data.askSplit;applySplitDefault(c.data)}if(["tipo","dal","al","f1","f2","f3","casa"].includes(key))paintCard(c,id);else updateCalc(c)});
  return el("label",{class:(opts.wide?"wide ":"")+(opts.calc?"calc":""),for:id},label,inp)}
function updateCalc(c){const n=c.node;const p=n.querySelector(".k-pagato");if(p)p.textContent=EUR.format(r2((c.data.totale||0)+(c.data.canone||0)+(c.data.crediti||0)));const chk=n.querySelector(".k-check");if(chk)chk.replaceChildren(...checkMsg(c))}
function checkMsg(c){const d=c.data,out=[];const pagato=r2((d.totale||0)+(d.canone||0)+(d.crediti||0));
  if(c.check!=null&&Math.abs(c.check-pagato)>0.01)out.push(el("div",{class:"warnbox",text:`La bolletta dice ${EUR.format(c.check)} da pagare, i campi danno ${EUR.format(pagato)}. Controlla totale, canone e crediti.`}));
  const parts=d.tipo==="gas"?(d.vendita||0)+(d.rete_oneri||0)+(d.altre||0)+(d.accise_iva||0):(d.spesa_energia||0)+(d.altre||0)+(d.accise_iva||0);
  if(d.totale!=null&&parts&&Math.abs(parts-d.totale)>0.01)out.push(el("div",{class:"warnbox",text:`Le voci sommano ${EUR.format(parts)} ma il totale bolletta è ${EUR.format(d.totale)} (differenza ${EUR.format(r2(parts-d.totale))})${d.tipo==="luce"?". Per la luce la spesa energia di solito include rete e oneri":""}.`}));
  if(d.tipo==="gas"&&d.lettura_finale!=null&&d.lettura_iniziale!=null&&d.consumo!=null&&Math.abs(d.lettura_finale-d.lettura_iniziale-d.consumo)>2)out.push(el("div",{class:"warnbox",text:`Letture ${d.lettura_iniziale} → ${d.lettura_finale} = ${N0.format(d.lettura_finale-d.lettura_iniziale)} m³, ma il consumo fatturato è ${N0.format(d.consumo)} Smc (normale se c'è un coefficiente di conversione o un conguaglio).`}));
  if(d.n&&!c.editing&&S.bills.some(b=>b._id===billId(d)))out.push(el("div",{class:"warnbox",text:"Questa fattura è già nell'archivio: salvando la sovrascrivi."}));
  if(!out.length&&d.totale!=null&&parts)out.push(el("div",{class:"okbox",text:"Le voci tornano al centesimo con il totale."}));
  if(!(d.quota_fissa>0))out.push(el("div",{class:"warnbox",text:"Mancano le quote fisse: se nel dettaglio della bolletta trovi «quota fissa» e «quota potenza» (in € per il periodo), scrivile qui sotto. Altrimenti le stimo con valori tipici, e con più bollette le calcolo dai tuoi dati."}));
  return out}
function paintCard(c,focusId){
  const n=c.node;if(!n)return;const title=c.file?c.file.name:(c.editing?"Modifica bolletta":"Nuova bolletta a mano");
  const head=el("div",{class:"ch"},el("div",{},el("h3",{text:title}),el("span",{class:"muted",style:"font-size:.85rem",text:casaIds().length>1?CASA_N[(c.data&&c.data.casa)||c.casa]||"":(c.quick?"Ultima bolletta e consumo annuo":"")})),el("button",{class:"btn",type:"button",text:c.status==="saved"?"Chiudi":"Scarta",onclick:()=>{n.remove();cards.splice(cards.indexOf(c),1);paintBatch()}}));
  if(c.status==="wait"||c.status==="reading"||c.status==="asking"){n.replaceChildren(head,el("div",{class:"status"},el("span",{class:"spin"}),c.status==="asking"?"Claude sta leggendo la bolletta…":"Apro il file…"),el("div",{class:"sk",style:"width:70%"}),el("div",{class:"sk",style:"width:45%"}));return}
  if(c.status==="error"){n.replaceChildren(head,el("div",{class:"errbox",text:c.err}),el("div",{class:"controls"},c.file&&S.sample?el("button",{class:"btn",type:"button",text:"Riprova",onclick:()=>extract(c)}):null,el("button",{class:"btn primary",type:"button",text:"Inserisci a mano",onclick:()=>{c.status="review";c.data={casa:c.casa};paintCard(c)}})));return}
  if(c.status==="saved"){n.replaceChildren(head,el("div",{class:"okbox",text:c.savedMsg}));return}
  const d=c.data;d.casa=d.casa||c.casa;if(!d.tipo)d.tipo="gas";const g=d.tipo==="gas";const u=UNIT[d.tipo];
  const f1=el("div",{class:"form"},(casaIds().length>1?field(c,"casa","Casa","select",{options:casaIds().map(k=>[k,CASA_N[k]])}):null),field(c,"tipo","Fornitura","select",{options:[["gas","Gas"],["luce","Luce"]]}),field(c,"n","N. fattura","text"),field(c,"fornitore","Fornitore","text"),field(c,"offerta","Offerta","text"),field(c,"fine_prezzo","Prezzo bloccato fino al","date"),field(c,"dal","Dal","date"),field(c,"al","Al","date"),field(c,"emissione","Emessa il","date"),field(c,"scadenza","Scadenza","date"));
  const f2=el("div",{class:"form"});
  const ann=field(c,"consumo_annuo",`Consumo annuo (${u})${c.quick?"":", se stampato"}`);if(c.quick)ann.classList.add("wide");
  if(g)f2.append(field(c,"lettura_iniziale","Lettura iniziale"),field(c,"lettura_finale","Lettura finale"),field(c,"tipo_lettura","Tipo lettura","select",{options:[["",""],["Rilevato","Rilevata"],["Stimato","Stimata"],["Autolettura","Autolettura"]]}),field(c,"consumo","Consumo (Smc)"),field(c,"prezzo","Prezzo €/Smc"),ann);
  else f2.append(field(c,"f1","F1 (kWh)"),field(c,"f2","F2 (kWh)"),field(c,"f3","F3 (kWh)"),field(c,"consumo","Consumo totale (kWh)","number",{calc:d.f1!=null}),ann);
  const f3=el("div",{class:"form"},g?field(c,"vendita","Materia gas €"):field(c,"spesa_energia","Spesa energia € (con rete e oneri)"),field(c,"rete_oneri","di cui rete e oneri €"),field(c,"altre","Altre partite €"),field(c,"accise_iva","Accise e IVA €"),field(c,"totale",g?"Totale bolletta €":"Totale bolletta € (senza canone)"),g?field(c,"crediti","Crediti / compensazioni €"):field(c,"canone","Canone RAI €"),field(c,"quota_fissa","Quote fisse del periodo € (vendita + rete, senza IVA)"),field(c,"quota_fissa_vendita","di cui quota fissa di vendita €"));
  const pag=el("div",{class:"checkline",style:"justify-content:space-between;flex-wrap:wrap"},el("span",{class:"muted",text:"Totale pagato"}),el("b",{class:"k-pagato num",style:"font-family:var(--f-display);font-size:1.4rem",text:"0"}));
  const splitBox=el("fieldset",{},el("legend",{text:"Anno a cui attribuire la spesa"}));
  const a=pd(d.dal),b=pd(d.al);
  if(a&&b&&a.y!==b.y){d.anno1=a.y;d.anno2=b.y;const id=`c${c.id}-q`;
    const opts=[["0",`Tutta sul ${b.y}`],["0.5",`50% e 50%`],["prop","In proporzione ai mesi"]];const ms=monthsIn(d.dal,d.al);const prop=Math.round(ms.filter(([y])=>y===a.y).length/ms.length*100)/100;
    const sel=el("select",{id},...opts.map(([v,t])=>el("option",{value:v,text:t,selected:(v==="prop"?d.quota1===prop&&prop!==0.5:+v===d.quota1)})));
    sel.addEventListener("change",()=>{d.quota1=sel.value==="prop"?prop:+sel.value;d.askSplit=false;out2.textContent=`${Math.round(d.quota1*100)}% al ${a.y}, ${100-Math.round(d.quota1*100)}% al ${b.y}`});
    const out2=el("span",{class:"muted",text:`${Math.round((d.quota1||0)*100)}% al ${a.y}, ${100-Math.round((d.quota1||0)*100)}% al ${b.y}`});
    splitBox.append(el("div",{class:"checkline",style:"flex-wrap:wrap"},el("label",{for:id,text:"La bolletta copre due anni:"}),sel,out2),el("p",{class:"muted",style:"margin-top:6px;font-size:.82rem",text:"Di solito la divido in proporzione ai mesi; scegli tu se preferisci un altro criterio."}))}
  else splitBox.append(el("p",{class:"muted",style:"font-size:.88rem",text:b?`Tutta sul ${b.y}.`:"Indica il periodo."}));
  const note=el("label",{class:"wide",for:`c${c.id}-note`},"Note",(()=>{const t=el("textarea",{id:`c${c.id}-note`});t.value=d.note||"";t.addEventListener("input",()=>{d.note=t.value});return t})());
  const mens=c.mensili&&c.mensili.length?(()=>{c.useMens=c.useMens!==false;const id=`c${c.id}-mens`;const cb=el("input",{type:"checkbox",id,checked:c.useMens});cb.addEventListener("change",()=>{c.useMens=cb.checked});return el("div",{class:"checkline"},cb,el("label",{for:id,text:`Aggiorna anche i consumi mensili (${c.mensili.length} mesi letti dal grafico: ${c.mensili.slice(-3).map(x=>`${MESI[+x.mese.slice(5)-1]} ${x.mese.slice(2,4)} ${N0.format(x.valore)}`).join(", ")}…)`}))})():null;
  const save=el("button",{class:"btn primary",type:"button",text:c.editing?"Salva modifiche":"Salva nell'archivio",onclick:()=>saveCard(c,save)});
  const rc=c.recog&&casaIds().length>1?el("div",{class:"okbox",text:`Attribuita a: ${CASA_N[d.casa]}, ${TIPO_N[d.tipo].toLowerCase()} (riconosciuta da ${c.recog.casa===d.casa?c.recog.why:"te"})${c.recog.offerta?`; offerta ${c.recog.offerta}`:""}. Se non è giusto, correggi Casa e Fornitura qui sotto.`}):null;
  const qn=c.quick?el("div",{class:d.consumo_annuo?"okbox":"warnbox",text:d.consumo_annuo?`Consumo annuo letto in bolletta: ${N0.format(d.consumo_annuo)} ${u}. Lo uso per il confronto con le offerte.`:`Scrivi il consumo annuo (${u}) nel campo «Consumo annuo»: di solito è stampato nella prima o seconda pagina della bolletta.`}):null;
  n.replaceChildren(...[head,rc,qn,c.manualNote?el("div",{class:"warnbox",text:S.sampleOff?"Per la lettura automatica serve il permesso di usare Claude: per ora compila i campi copiandoli dalla bolletta.":"La lettura automatica è disponibile aprendo la pagina con un account Claude: per ora compila i campi copiandoli dalla bolletta."}):null,
    el("div",{class:"label",text:"Dati fattura"}),f1,el("div",{class:"label",text:`Consumi (${u})`}),f2,el("div",{class:"label",text:"Importi"}),f3,pag,el("div",{class:"k-check",style:"display:flex;flex-direction:column;gap:6px"}),splitBox,el("div",{class:"form"},note),mens,el("div",{class:"k-msg"}),el("div",{class:"controls",style:"justify-content:flex-end"},save)].filter(x=>x!=null));
  updateCalc(c);if(focusId){const f=document.getElementById(focusId);f&&f.focus()}
}
async function saveCard(c,btn){
  const d=c.data,msg=c.node.querySelector(".k-msg");msg.replaceChildren();
  const miss=[];if(!d.n)miss.push("numero fattura");if(!d.dal||!d.al)miss.push("periodo");if(d.totale==null)miss.push("totale");if(miss.length){msg.append(el("div",{class:"errbox",text:"Mancano: "+miss.join(", ")+"."}));return false}
  if(d.al<d.dal){msg.append(el("div",{class:"errbox",text:"La data di fine periodo è prima di quella di inizio."}));return false}
  if(c.quick&&!(d.consumo_annuo>0)){msg.append(el("div",{class:"errbox",text:"Scrivi il consumo annuo: serve per il confronto con le offerte."}));return false}
  if(!d.casa||!CASA_N[d.casa])d.casa=casaIds()[0];normalizeParts(d);const doc={};for(const[k,v]of Object.entries(d)){if(k.startsWith("_")||k==="askSplit"||v==null||v==="")continue;doc[k]=v}
  doc.periodo=periodo(d.dal,d.al);doc.pagato=r2((d.totale||0)+(d.canone||0)+(d.crediti||0));doc.consumo=d.consumo||0;doc.stima=!!d.stima;doc.fonte=c.file?"pdf":(d.fonte||"manuale");doc.canone=d.canone||0;doc.altre=d.altre||0;
  if(!(doc.quota1>0&&doc.quota1<1&&pd(d.dal).y!==pd(d.al).y)){delete doc.quota1;delete doc.anno1;delete doc.anno2}
  doc.verificata=verify(doc).k==="ok";
  const id=billId(doc);btn.disabled=true;btn.textContent="Salvo…";
  try{
    await ensureCasa(doc.casa);await S.db.doc("bollette/"+id).set(doc);
    if(c.editing&&c.editing!==id)await S.db.doc("bollette/"+c.editing).delete();
    let mn=0;if(c.mensili&&c.mensili.length&&c.useMens!==false){const byY={};for(const x of c.mensili){const y=+x.mese.slice(0,4),m=+x.mese.slice(5)-1;(byY[y]=byY[y]||[]).push([m,x.valore])}
      for(const[y,arr]of Object.entries(byY)){const key=`${doc.casa}-${doc.tipo}-${y}`;const cur=S.mensili[key];const vals=cur&&Array.isArray(cur.valori)?cur.valori.slice():Array(12).fill(null);let st=cur&&cur.stimati?cur.stimati.slice():[];for(const[m,v]of arr){vals[m]=v;st=st.filter(i=>i!==m+1)}await S.db.doc("mensili/"+key).set({casa:doc.casa,tipo:doc.tipo,anno:+y,valori:vals,stimati:st,unita:UNIT[doc.tipo]});mn+=arr.length}}
    await afterBill(doc,c.ids||{});
    c.status="saved";c.savedMsg=`Salvata: ${doc.tipo} ${doc.periodo}, ${EUR.format(doc.pagato)}${doc.verificata?", verificata al centesimo":""}${mn?` · aggiornati ${mn} mesi di consumi`:""}.`;paintCard(c);paintBatch();if(!c.batch)toast("Bolletta salvata");return true;
  }catch(e){btn.disabled=false;btn.textContent="Riprova a salvare";msg.append(el("div",{class:"errbox",text:dbErr(e)}));return false}
}
function openAdd(){S.dt="add";go("dat")}
// several bills read at once: save the checked ones in one go
function paintBatch(){const q=$("#queue");if(!q)return;let bar=$("#batchbar");const ready=cards.filter(c=>c.status==="review"),busy=cards.filter(c=>["wait","reading","asking"].includes(c.status)).length;
  if(ready.length<2&&!busy){bar&&bar.remove();return}
  if(!bar){bar=el("div",{class:"batchbar",id:"batchbar"});q.prepend(bar)}else if(q.firstElementChild!==bar)q.prepend(bar);
  const btn=el("button",{class:"btn primary",type:"button",text:`Salva tutte (${ready.length})`,disabled:!ready.length,onclick:async()=>{btn.disabled=true;let ok=0,ko=0;for(const c of cards.filter(x=>x.status==="review")){c.batch=true;const b=c.node.querySelector(".controls .btn.primary")||btn;if(await saveCard(c,b))ok++;else ko++;c.batch=false}toast(ko?`${ok} salvate, ${ko} da completare`:`${ok} bollette salvate`);paintBatch()}});
  bar.replaceChildren(el("span",{class:"muted",text:busy?`Sto leggendo ${busy} ${busy===1?"bolletta":"bollette"}… ${ready.length} pronte da controllare.`:`${ready.length} bollette pronte: controllale e salvale tutte insieme.`}),btn)}
async function ensureCasa(id){if(S.case[id])return;await S.db.doc("case/"+id).set({nome:CASA_N[id]||"Casa mia",creata:new Date().toISOString()})}
async function setOfferta(c,t,o){await ensureCasa(c);const cur=(S.case[c]||{})["offerta_"+t]||{};await S.db.doc("case/"+c).update({["offerta_"+t]:{...cur,...Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined))}})}
// what a saved bill teaches about the house: meter codes, supplier, current offer and its end date, the yearly consumption
async function afterBill(doc,ids){const info=S.case[doc.casa]||{};const up={};
  if(doc.tipo==="gas"&&ids.pdr&&!info.pdr)up.pdr=String(ids.pdr);if(doc.tipo==="luce"&&ids.pod&&!info.pod)up.pod=String(ids.pod);
  const latest=!S.bills.some(b=>b.casa===doc.casa&&b.tipo===doc.tipo&&!b.stima&&b.al>doc.al&&b._id!==billId(doc));
  if(latest){if(doc.fornitore)up["fornitore_"+doc.tipo]=doc.fornitore;const cur=info["offerta_"+doc.tipo]||{};
    if(doc.offerta||doc.fine_prezzo)up["offerta_"+doc.tipo]={nome:doc.offerta||cur.nome||"",scadenza:doc.fine_prezzo||(cur.nome===doc.offerta?cur.scadenza||null:null)};
    if(doc.consumo_annuo>0)up.consumi_annui={...(info.consumi_annui||{}),[doc.tipo]:{valore:doc.consumo_annuo,al:doc.al,fonte:"bolletta"}}}
  if(Object.keys(up).length)await S.db.doc("case/"+doc.casa).update(up)}
const lockSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
function privacyNote(){const p=el("div",{class:"privacy"});p.innerHTML=lockSvg;p.append(el("span",{},el("b",{text:"I tuoi dati restano tuoi. "}),S.db&&!S.db.persistent?"Questo browser non permette di salvare: i dati restano finché tieni aperta la pagina, quindi esporta una copia prima di chiuderla.":`Bollette e consumi sono salvati solo in questo browser, su questo dispositivo: nessun altro li vede, nemmeno chi ha creato il sito. ${S.web?"Quando una bolletta viene letta, il file viene inviato a Claude solo per estrarne i dati e non viene conservato.":"Quando Claude legge una bolletta lo fa con il tuo account, solo per estrarne i dati."} Per usarli su un altro dispositivo esporta una copia e importala lì.`));return p}
// quick path: yearly consumption (and, if known, what you pay) without any bill
function openQuick(cs){const c0=typeof cs=="string"&&CASA_N[cs]?cs:upCasa();const v={tipo:"gas"};
  const F=(id,label,type,val,extra={})=>el("label",{for:"q-"+id},label,el("input",{id:"q-"+id,type,step:"any",value:val??"",...extra}));
  const body=el("div",{class:"form"});const msg=el("div");
  const paint=()=>{const u=UNIT[v.tipo],k=`${c0}-${v.tipo}`,d=declOf(c0,v.tipo)||{},cur=(S.param.attuali||{})[k]||{},of=(S.case[c0]||{})["offerta_"+v.tipo]||{};
    const ts=el("select",{id:"q-tipo"},el("option",{value:"gas",text:"Gas",selected:v.tipo==="gas"}),el("option",{value:"luce",text:"Luce",selected:v.tipo==="luce"}));ts.addEventListener("change",()=>{v.tipo=ts.value;paint()});
    const ms=el("select",{id:"q-modo"},el("option",{value:"fisso",text:"Prezzo fisso",selected:cur.modo!=="indicizzato"}),el("option",{value:"indicizzato",text:`Variabile (${v.tipo==="luce"?"PUN":"PSV"} + spread)`,selected:cur.modo==="indicizzato"}));
    body.replaceChildren(el("label",{for:"q-tipo"},"Fornitura",ts),F("ann",`Consumo annuo (${u})`,"number",d.valore),F("nome","Nome dell'offerta (facoltativo)","text",cur.nome||of.nome),el("label",{for:"q-modo"},"Tipo di prezzo",ms),
      F("prezzo",`Prezzo €/${u} o spread (facoltativo)`,"number",cur.modo==="indicizzato"?cur.spread:cur.prezzo),F("qf","Quota fissa vendita €/mese (facoltativo)","number",cur.quota_fissa),F("sca","Prezzo bloccato fino al (facoltativo)","date",of.scadenza))};
  paint();
  const save=el("button",{class:"btn primary",type:"button",text:"Salva i consumi",onclick:async()=>{const g=id=>document.getElementById("q-"+id).value;const ann=num(g("ann"));
    if(!(ann>0)){msg.replaceChildren(el("div",{class:"errbox",text:"Scrivi il consumo annuo."}));return}
    const t=v.tipo,k=`${c0}-${t}`,modo=g("modo"),p=num(g("prezzo")),qf=num(g("qf")),nome=g("nome").trim(),sca=g("sca")||null;
    try{await ensureCasa(c0);const info=S.case[c0]||{};await S.db.doc("case/"+c0).update({consumi_annui:{...(info.consumi_annui||{}),[t]:{valore:ann,al:TODAY,fonte:"utente"}}});
      if(p!=null||nome||qf!=null){const all={...(S.param.attuali||{})};const has=S.bills.some(b=>b.casa===c0&&b.tipo===t);
        if(p!=null&&(p>0||modo==="indicizzato"))all[k]={nome:nome||(all[k]||{}).nome||"Offerta attuale",modo,prezzo:modo==="fisso"?p:null,spread:modo==="indicizzato"?p:0,quota_fissa:qf??0,fonte:"utente"};
        else if(!has&&all[k])delete all[k];await saveParam("attuali",all)}
      if(nome||sca)await setOfferta(c0,t,{nome:nome||undefined,scadenza:sca});
      closeModal();toast("Consumi salvati");go("off")}catch(e){msg.replaceChildren(el("div",{class:"errbox",text:dbErr(e)}))}}});
  modal([el("h2",{text:"I tuoi consumi"}),el("p",{class:"muted",style:"font-size:.88rem",text:"Il consumo annuo è stampato in bolletta (a volte come «consumo degli ultimi 12 mesi»). Con il prezzo che paghi oggi il confronto è più preciso; se non lo sai, carica l'ultima bolletta e lo leggo io."}),body,msg,
    el("div",{class:"controls",style:"justify-content:flex-end"},el("button",{class:"btn",type:"button",text:"Annulla",onclick:closeModal}),save)])}
function newCasa(after){const msg=el("div");const inp=el("input",{id:"nc-nome",type:"text",placeholder:"Per esempio: Casa al mare"});
  const save=el("button",{class:"btn primary",type:"button",text:"Aggiungi",onclick:async()=>{const n=inp.value.trim();if(!n){msg.replaceChildren(el("div",{class:"errbox",text:"Dai un nome alla casa."}));return}
    const first=casaIds()[0];try{if(!S.case[first])await ensureCasa(first);const id=newCasaId();await S.db.doc("case/"+id).set({nome:n,creata:new Date().toISOString()});closeModal();toast("Casa aggiunta");after&&after(id)}catch(e){msg.replaceChildren(el("div",{class:"errbox",text:dbErr(e)}))}}});
  modal([el("h2",{text:"Nuova casa"}),el("p",{class:"muted",style:"font-size:.88rem",text:"Tieni separate le bollette di case diverse: ognuna ha il suo confronto con le offerte."}),el("label",{for:"nc-nome",class:"form"},"Nome",inp),msg,el("div",{class:"controls",style:"justify-content:flex-end"},el("button",{class:"btn",type:"button",text:"Annulla",onclick:closeModal}),save)])}
function fillUpCasa(){const s=$("#up-casa");if(!s)return;const cur=s.value;s.replaceChildren(...casaIds().map(k=>el("option",{value:k,text:CASA_N[k]})),el("option",{value:"__new",text:"+ Aggiungi una casa…"}));s.value=CASA_N[cur]?cur:(S.casa!=="tutte"&&CASA_N[S.casa]?S.casa:casaIds()[0])}

// ---------- dati: importa ----------
const COLS=["bollette","mensili","case","offerte","parametri"];
function stateOf(col){if(col==="bollette"){const o={};for(const b of S.bills){const{_id,...r}=b;o[_id]=r}return o}return{mensili:S.mensili,case:S.case,offerte:S.myOff,parametri:S.param}[col]||{}}
function normalizeImport(d){if(!d||typeof d!=="object")return null;
  const data={};let any=false;for(const c of COLS)if(d[c]&&typeof d[c]==="object"&&!Array.isArray(d[c])){data[c]=d[c];any=true}
  if(data.parametri){const{indici,...rest}=data.parametri;data.parametri=rest}
  if(!any)return null;return{fmt:(d.app==="Confronto tariffe bollette"||d.app==="Confronto tariffe bollette")?"Copia di Confronto tariffe bollette":"Copia di dati delle bollette",data}}
const stable=o=>JSON.stringify(o,Object.keys(o).sort());
const same=(a,b)=>{const ka=Object.keys(a).filter(k=>a[k]!=null&&k!=="_id").sort(),kb=Object.keys(b).filter(k=>b[k]!=null&&k!=="_id").sort();if(ka.join()!==kb.join())return false;return ka.every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]))};
let pendingImport=null;
async function importFiles(list){const res=[];for(const f of list){try{const n=normalizeImport(JSON.parse(await f.text()));if(n)res.push({name:f.name,...n});else res.push({name:f.name,err:"Formato non riconosciuto"})}catch(e){res.push({name:f.name,err:"Non è un file JSON valido"})}}
  pendingImport=res;renderDat()}
function importPreview(){
  if(!pendingImport)return null;const box=el("div",{class:"card"});
  const plan=[];for(const r of pendingImport){if(r.err){box.append(el("div",{class:"errbox",text:`${r.name}: ${r.err}.`}));continue}
    const rows=[];for(const[col,docs]of Object.entries(r.data)){const cur=stateOf(col);let nu=0,eq=0,df=0;for(const[id,doc]of Object.entries(docs)){if(!/^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id))continue;const c=cur[id];if(!c){nu++;plan.push([col,id,doc])}else if(same(c,doc))eq++;else{df++;plan.push([col,id,doc])}}rows.push([col,nu,eq,df])}
    box.append(el("h3",{text:`${r.name} · ${r.fmt}`}),el("div",{class:"tw"},el("table",{},el("thead",{},el("tr",{},...["Raccolta","Nuovi","Uguali","Diversi"].map((h,i)=>el("th",{class:i?"r":"",text:h})))),el("tbody",{},...rows.map(([c,a,b,d])=>el("tr",{},el("td",{text:c}),el("td",{class:"r num",text:a}),el("td",{class:"r num",text:b}),el("td",{class:"r num",text:d})))))))}
  const msg=el("div");
  const go_=el("button",{class:"btn primary",type:"button",text:plan.length?`Importa ${plan.length} documenti`:"Niente da importare",disabled:!plan.length||!S.db,onclick:async()=>{go_.disabled=true;let ok=0;for(const[col,id,doc]of plan){try{await S.db.doc(`${col}/${id}`).set(doc);ok++;go_.textContent=`Importo… ${ok}/${plan.length}`}catch(e){msg.replaceChildren(el("div",{class:"errbox",text:`Fermato a ${ok} su ${plan.length}: ${dbErr(e)}`}));return}}pendingImport=null;toast(`${ok} documenti importati`);renderDat()}});
  box.append(el("p",{class:"muted",style:"font-size:.85rem",text:"«Diversi» vuol dire che il documento c'è già con valori diversi: importando lo sostituisci con quello del file."}),msg,el("div",{class:"controls",style:"justify-content:flex-end"},el("button",{class:"btn",type:"button",text:"Annulla",onclick:()=>{pendingImport=null;renderDat()}}),go_));
  return box}

// ---------- dati: esporta ----------
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zipBlob(files,mime){const enc=new TextEncoder(),parts=[],central=[];let off=0;
  for(const f of files){const nm=enc.encode(f.name),d=typeof f.data==="string"?enc.encode(f.data):f.data,crc=crc32(d);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,0,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,d);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,0,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+d.length}
  const cs=central.reduce((a,b)=>a+b.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:mime})}
const xe=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");
function offerSheets(){const rows=[];for(const c of casaIds())for(const t of["gas","luce"]){const R=offerRows(c,t);if(!R)continue;
    rows.push([CASA_N[c],TIPO_N[t],`Attuale: ${R.cur.nome}`,R.cur.modo==="indicizzato"?`${t==="luce"?"PUN":"PSV"} + ${R.cur.spread}`:R.cur.prezzo,R.cur.quota_fissa,null,R.cc.c,R.base.lordo,0,""]);
    for(const r of R.rows)rows.push([CASA_N[c],TIPO_N[t],`${r.o.fornitore} · ${r.o.nome}`,r.o.modo==="indicizzato"?`${t==="luce"?"PUN":"PSV"} + ${r.o.spread}`:r.o.prezzo,r.o.quota_fissa,r.o.durata_mesi,R.cc.c,r.cost,r.saving,r.o.note||""])}
  return[{name:"Confronto offerte",cols:[["Casa","text",9],["Fornitura","text",9],["Offerta","text",34],["Prezzo €/unità","dec4",13],["Quota fissa €/mese","eur",13],["Durata mesi","int",9],["Consumo annuo","int",11],["Costo annuo materia con IVA (€)","eur",16],["Risparmio rispetto a oggi (€/anno)","eur",16],["Note","text",50]],rows,boldIf:r=>String(r[2]).startsWith("Attuale")}]}
function buildSheets(){
  const all=casaIds(),T=["gas","luce"],M=fvModels(),yrs=years();
  const r=[];for(const y of yrs){const tot={n:0,f:0,v:0,a:0,c:0,p:0};for(const c of all)for(const t of T){const a=fvAnnual([c],[t])[y];if(!a)continue;
      r.push([y,CASA_N[c],TIPO_N[t],a.n,a.consumo,UNIT[t],a.fisso,a.variabile,a.altre+a.crediti,a.canone,a.pagato,a.consumo>0?(a.fisso+a.variabile)/a.consumo:null]);tot.n+=a.n;tot.f+=a.fisso;tot.v+=a.variabile;tot.a+=a.altre+a.crediti;tot.c+=a.canone;tot.p+=a.pagato}
    r.push([y,"Tutte","Luce + gas",tot.n,null,"",tot.f,tot.v,tot.a,tot.c,tot.p,null])}
  const s1={name:"Riepilogo per anno",cols:[["Anno","year",7],["Casa","text",10],["Fornitura","text",11],["Bollette (quote)","dec1",10],["Consumo","int",11],["Unità","text",7],["Quota fissa (€)","eur",14],["Consumi (€)","eur",14],["Bonus, ricalcoli e crediti (€)","eur",16],["Canone RAI (€)","eur",12],["Totale pagato (€)","eur",15],["Costo medio per unità (€)","dec3",14]],rows:r,boldIf:row=>row[1]==="Tutte"};
  const s2={name:"Fissi e variabili",cols:[["Casa","text",10],["Fornitura","text",10],["Offerta","text",32],["Dal","date",11],["Al","date",11],["Bollette","int",9],["Quota fissa €/mese","eur",15],["Quota fissa €/anno","eur",15],["Costo variabile €/unità","dec4",15],["Unità","text",7],["R²","dec3",8],["Come è calcolata","text",40]],
    rows:Object.values(M).sort((a,b)=>(a.casa+a.tipo+a.dal).localeCompare(b.casa+b.tipo+b.dal)).map(m=>[CASA_N[m.casa],TIPO_N[m.tipo],m.offerta,m.dal,m.al,m.nb,m.F,m.F*12,m.v,UNIT[m.tipo],m.r2,m.metodo])};
  const sorted=[...S.bills].sort((a,b)=>(a.casa+a.al).localeCompare(b.casa+b.al));
  const g=sorted.filter(b=>b.tipo==="gas").map(b=>{const d=fvBill(b),u=unitCost(b);return[CASA_N[b.casa],b.n,b.emissione||null,b.scadenza||null,b.dal,b.al,b.periodo||periodo(b.dal,b.al),b.offerta||"",b.prezzo??null,b.lettura_iniziale??null,b.lettura_finale??null,b.consumo||0,b.vendita??null,b.rete_oneri??null,b.altre||0,b.accise_iva??null,b.totale||0,b.crediti||0,paid(b),d.fisso,d.variabile,u,b.anno1??null,b.quota1??null,b.anno2??null,verify(b).lbl,b.note||""]});
  const s3={name:"Bollette gas",cols:[["Casa","text",9],["N. fattura","text",15],["Emissione","date",11],["Scadenza","date",11],["Dal","date",11],["Al","date",11],["Periodo","text",17],["Offerta","text",26],["Prezzo €/Smc","dec4",11],["Lettura iniziale","int",10],["Lettura finale","int",10],["Consumo Smc","int",10],["Materia gas (€)","eur",13],["Rete e oneri (€)","eur",13],["Altre partite (€)","eur",13],["Accise e IVA (€)","eur",13],["Totale bolletta (€)","eur",14],["Crediti (€)","eur",11],["Totale pagato (€)","eur",14],["di cui quota fissa (€)","eur",13],["di cui consumi (€)","eur",13],["€/Smc","dec3",9],["Anno 1","year",7],["Quota anno 1","pct",9],["Anno 2","year",7],["Stato","text",13],["Note","text",50]],rows:g};
  const l=sorted.filter(b=>b.tipo==="luce").map(b=>{const d=fvBill(b),u=unitCost(b);return[CASA_N[b.casa],b.n,b.emissione||null,b.scadenza||null,b.dal,b.al,b.periodo||periodo(b.dal,b.al),b.offerta||"",b.f1??null,b.f2??null,b.f3??null,b.consumo||0,b.spesa_energia??null,b.rete_oneri??null,b.altre||0,b.accise_iva??null,b.totale||0,b.canone||0,paid(b),d.fisso,d.variabile,u,b.anno1??null,b.quota1??null,b.anno2??null,verify(b).lbl,b.note||""]});
  const s4={name:"Bollette luce",cols:[["Casa","text",9],["N. fattura","text",15],["Emissione","date",11],["Scadenza","date",11],["Dal","date",11],["Al","date",11],["Periodo","text",19],["Offerta","text",26],["F1 kWh","int",8],["F2 kWh","int",8],["F3 kWh","int",8],["Consumo kWh","int",10],["Spesa energia (€)","eur",13],["di cui rete e oneri (€)","eur",13],["Altre partite e bonus (€)","eur",13],["Accise e IVA (€)","eur",13],["Totale bolletta (€)","eur",14],["Canone RAI (€)","eur",11],["Totale pagato (€)","eur",14],["di cui quota fissa (€)","eur",13],["di cui consumi (€)","eur",13],["€/kWh","dec3",9],["Anno 1","year",7],["Quota anno 1","pct",9],["Anno 2","year",7],["Stato","text",13],["Note","text",50]],rows:l};
  const mr=[];for(const y of yrs)for(let mm=0;mm<12;mm++){const vals=[];let any=false;for(const c of all)for(const t of T){const v=mval(c,t,+y,mm);vals.push(v==null?null:Math.round(v));if(v!=null)any=true}if(any)mr.push([+y,MESI_L[mm],...vals])}
  const s5={name:"Consumi mensili",cols:[["Anno","year",7],["Mese","text",11],...all.flatMap(c=>T.map(t=>[`${all.length>1?CASA_N[c]+" ":""}${t} (${UNIT[t]})`,"int",13]))],rows:mr};
  return[s1,s2,...offerSheets(),s3,s4,s5]}
const colL=i=>{let s="";i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
const serial=s=>{const p=pd(s);return p?(Date.UTC(p.y,p.m,p.d)-Date.UTC(1899,11,30))/864e5:null};
function toXlsx(sheets){const XF={eur:2,int:3,dec3:4,dec4:5,date:6,pct:7,dec1:8,year:9,text:10};
  const sx=sheets.map(sh=>{let x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
    sh.cols.forEach((c,i)=>{x+=`<col min="${i+1}" max="${i+1}" width="${c[2]+2}" customWidth="1"/>`});x+='</cols><sheetData><row r="1" ht="32" customHeight="1">';
    sh.cols.forEach((c,i)=>{x+=`<c r="${colL(i)}1" t="inlineStr" s="1"><is><t>${xe(c[0])}</t></is></c>`});x+="</row>";
    sh.rows.forEach((row,ri)=>{const rn=ri+2,bold=sh.boldIf&&sh.boldIf(row);x+=`<row r="${rn}">`;row.forEach((v,ci)=>{const f=sh.cols[ci][1],ref=colL(ci)+rn;if(v==null||v==="")return;
      let s=XF[f]||0;if(bold)s=f==="eur"?11:12;
      if(f==="date"){const n=serial(v);if(n!=null){x+=`<c r="${ref}" s="${s}"><v>${n}</v></c>`;return}}
      if(typeof v==="number"&&isFinite(v))x+=`<c r="${ref}" s="${s}"><v>${f==="int"||f==="year"?Math.round(v):f==="eur"?Math.round(v*100)/100:Math.round(v*1e6)/1e6}</v></c>`;
      else x+=`<c r="${ref}" t="inlineStr" s="${bold?12:10}"><is><t xml:space="preserve">${xe(v)}</t></is></c>`});x+="</row>"});
    return x+"</sheetData></worksheet>"});
  const files=[{name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")+"</Types>"},
    {name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:"xl/workbook.xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")+"</sheets></workbook>"},
    {name:"xl/_rels/workbook.xml.rels",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="166" formatCode="0.000"/><numFmt numFmtId="167" formatCode="0.0000"/><numFmt numFmtId="168" formatCode="dd/mm/yyyy"/><numFmt numFmtId="170" formatCode="#,##0.0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3E8EE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="170" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
    ...sx.map((d,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:d}))];
  return zipBlob(files,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
function csvText(){const head=["casa","fornitura","n_fattura","dal","al","periodo","offerta","consumo","unita","f1","f2","f3","totale_bolletta","canone_rai","crediti","totale_pagato","anno1","quota1","anno2","stato","note"];
  const rows=S.bills.filter(inCasa).sort((a,b)=>a.al.localeCompare(b.al)).map(b=>[b.casa,b.tipo,b.n,b.dal,b.al,b.periodo,b.offerta,b.consumo,UNIT[b.tipo],b.f1,b.f2,b.f3,b.totale,b.canone,b.crediti,paid(b),b.anno1,b.quota1,b.anno2,verify(b).lbl,b.note]);
  return"﻿"+[head,...rows].map(r=>r.map(v=>{if(v==null)return"";if(typeof v==="number")return String(v).replace(".",",");const s=String(v);return/[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}).join(";")).join("\n")}
function fullJson(){const o={esportato:new Date().toISOString(),app:"Confronto tariffe bollette"};for(const c of COLS)o[c]=stateOf(c);return JSON.stringify(o,null,1)}
function blobSave(filename,data){const b=data instanceof Blob?data:new Blob([data],{type:/\.json$/.test(filename)?"application/json":"text/csv"});const u=URL.createObjectURL(b);const a=el("a",{href:u,download:filename});document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u)},1500)}
async function exportFile(kind){
  try{const day=TODAY;let filename,data;
    if(kind==="xlsx"){filename=`confronto_tariffe_bollette_${day}.xlsx`;data=toXlsx(buildSheets())}
    else if(kind==="csv"){filename=`bollette_${day}.csv`;data=csvText()}
    else{filename=`confronto_tariffe_bollette_${day}.json`;data=fullJson()}
    if(S.downloads)await S.downloads.save({filename,data});else blobSave(filename,data);toast("File pronto")}
  catch(e){if(e&&e.code==="declined")return;toast(e&&e.code==="rate_limited"?"Un salvataggio è già in corso":"Non sono riuscito a creare il file")}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-exp]");if(b)exportFile(b.dataset.exp)});

// ---------- dati: pannelli ----------
function renderDat(){
  $$('[data-dt]').forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.dt===S.dt)));$$("[data-dpane]").forEach(p=>p.hidden=p.dataset.dpane!==S.dt);
  fillUpCasa();$("#privacy-add").replaceWith(Object.assign(privacyNote(),{id:"privacy-add"}));
  $("#drop-sub").textContent=S.sample?"Anche più di una alla volta: PDF o foto, luce e gas. Claude ne legge i dati e tu controlli che i totali tornino prima di salvare.":"Anche più di una alla volta. Qui la lettura automatica non è attiva: puoi inserire i dati copiandoli dalla bolletta e controllo io che le voci tornino con il totale.";
  if(S.dt==="imp"){const fi=el("input",{type:"file",id:"imp-file",accept:".json,application/json",multiple:true,hidden:true});fi.addEventListener("change",e=>{importFiles([...e.target.files]);e.target.value=""});
    $("#imp-pane").replaceChildren(el("div",{class:"grid g2"},
      panel("Copia di sicurezza","Per non perdere i dati o spostarli su un altro dispositivo",[el("p",{class:"muted",style:"font-size:.88rem;margin-bottom:12px",text:"I dati stanno solo in questo browser: se lo cancelli o cambi dispositivo li perdi. Salva ogni tanto una copia completa (.json) e, sull'altro dispositivo, importala qui. Prima di scrivere ti mostro cosa è nuovo e cosa cambia."}),
        el("div",{class:"controls"},el("button",{class:"btn primary",type:"button","data-exp":"json",text:"Salva copia completa (.json)"}),el("label",{class:"btn",for:"imp-file"},"Importa una copia",fi))]),
      panel("Esporta","Bollette, consumi mensili, riepilogo per anno e confronto offerte",[el("div",{class:"controls"},el("button",{class:"btn primary",type:"button","data-exp":"xlsx",text:"Excel (.xlsx)"}),el("button",{class:"btn",type:"button","data-exp":"csv",text:"Bollette (.csv)"})),
        el("p",{class:"muted",style:"font-size:.84rem;margin-top:10px",text:"Il file Excel si apre anche con LibreOffice e OpenOffice."})])),...[importPreview()].filter(Boolean))}
  if(S.dt==="sta")renderSta();
}
function renderSta(){const rows=[];for(const c of casaIds())for(const t of["gas","luce"]){const bs=S.bills.filter(b=>b.casa===c&&b.tipo===t);const d=declOf(c,t);if(!bs.length&&!d)continue;const s=bs.slice().sort((a,b)=>a.al.localeCompare(b.al));const ok=bs.filter(b=>verify(b).k==="ok").length;
    rows.push(el("tr",{},el("td",{text:CASA_N[c]}),el("td",{},el("span",{class:"pill "+t,text:TIPO_N[t]})),el("td",{class:"r num",text:bs.length}),el("td",{text:bs.length?`${periodo(s[0].dal,s[0].dal)} → ${periodo(s[s.length-1].al,s[s.length-1].al)}`:"—"}),el("td",{class:"r num",text:bs.length?`${ok} su ${bs.length}`:"—"}),el("td",{class:"r num",text:d?`${N0.format(d.valore)} ${UNIT[t]}`:"—"})))}
  const houses=casaIds().map(c=>{const nb=S.bills.filter(b=>b.casa===c).length;const box=el("div",{class:"item",style:"cursor:default;flex-wrap:wrap"});
    const inp=el("input",{type:"text",value:CASA_N[c],"aria-label":"Nome della casa",style:"flex:1;min-width:150px"});
    const ren=el("button",{class:"btn sm",type:"button",text:"Rinomina",onclick:async()=>{const n=inp.value.trim();if(!n)return;try{if(S.case[c])await S.db.doc("case/"+c).update({nome:n});else await S.db.doc("case/"+c).set({nome:n,creata:new Date().toISOString()});toast("Nome salvato")}catch(e){toast(dbErr(e))}}});
    const del=casaIds().length>1?el("button",{class:"btn sm danger",type:"button",text:"Elimina",onclick:()=>{box.replaceChildren(el("span",{class:"muted",text:`Eliminare ${CASA_N[c]}${nb?` e le sue ${nb} bollette`:""}?`}),el("button",{class:"btn sm",type:"button",text:"Annulla",onclick:renderSta}),el("button",{class:"btn sm danger",type:"button",text:"Sì, elimina",onclick:async()=>{try{for(const b of S.bills.filter(b=>b.casa===c))await dbDel("bollette/"+b._id);for(const k of Object.keys(S.mensili).filter(k=>S.mensili[k].casa===c))await dbDel("mensili/"+k);await dbDel("case/"+c);toast("Casa eliminata")}catch(e){toast(dbErr(e))}}}))}}):null;
    box.append(inp,el("span",{class:"muted",style:"font-size:.85rem",text:`${nb} bollette`}),ren,del);return box});
  const wipe=el("div",{class:"controls"});const wipeBtn=()=>wipe.replaceChildren(el("button",{class:"btn danger",type:"button",text:"Cancella tutti i miei dati",onclick:()=>wipe.replaceChildren(el("span",{class:"muted",text:"Cancello bollette, consumi e impostazioni da questo browser. Non si può annullare."}),el("button",{class:"btn",type:"button",text:"Annulla",onclick:wipeBtn}),el("button",{class:"btn danger",type:"button",text:"Sì, cancella tutto",onclick:()=>{S.db.wipe();toast("Dati cancellati")}}))}));wipeBtn();
  $("#sta-pane").replaceChildren(el("div",{style:"display:flex;flex-direction:column;gap:16px"},
    el("div",{class:"grid g2"},panel("Le tue case","Ogni casa ha le sue bollette e il suo confronto",[el("div",{class:"list"},...houses),el("div",{class:"controls",style:"margin-top:12px"},el("button",{class:"btn",type:"button",text:"+ Aggiungi una casa",onclick:()=>newCasa(()=>renderSta())}))]),
      panel("Dove sono i tuoi dati",null,[privacyNote(),el("p",{class:"muted",style:"font-size:.85rem;margin:12px 0",text:`In questo browser: ${S.db?S.db.count():0} documenti.`}),wipe])),
    panel("Bollette e consumi salvati",null,[rows.length?el("div",{class:"tw"},el("table",{},el("thead",{},el("tr",{},...["Casa","Fornitura","Bollette","Periodo","Verificate","Consumo annuo inserito"].map((h,i)=>el("th",{class:i===2||i===4||i===5?"r":"",text:h})))),el("tbody",{},...rows))):el("p",{class:"muted",text:"Ancora niente: aggiungi bollette o consumi."})])))}

// ---------- navigazione ----------
const BOTTOM=["pan","bol","con","off"];
function renderCasaSeg(){const seg=$("#casa-seg");const ids=casaIds();const show=ids.length>1&&!["dat","chi"].includes(S.tab);seg.hidden=!show;if(!show)return;
  seg.replaceChildren(...[...ids,"tutte"].map(k=>el("button",{type:"button","data-casa":k,"aria-pressed":String(S.casa===k),text:k==="tutte"?"Tutte":CASA_N[k],onclick:()=>{S.casa=k;safeLS.set("bic.casa",k);render()}})))}
function render(){syncCase();renderCasaSeg();if(S.tab==="pan")renderPan();else if(S.tab==="bol")renderBol();else if(S.tab==="con")renderCon();else if(S.tab==="off")renderOff();else if(S.tab==="chi")renderChi();else renderDat();
  const n=S.bills.length;$("#rail-foot").textContent=!S.loaded?"Apro i tuoi dati…":n?`${n} bollette · salvate in questo browser`:"Dati salvati solo in questo browser"}
function go(tab){if(!NAV_NAME[tab])tab="pan";S.tab=tab;
  $$("section[data-sec]").forEach(s=>s.hidden=s.dataset.sec!==tab);
  $$("#rail-items button.nav").forEach(b=>b.toggleAttribute("aria-current",b.dataset.nav===tab)||b.dataset.nav===tab&&b.setAttribute("aria-current","page"));
  $$("#bottom button").forEach(b=>{const on=b.dataset.nav===tab||(b.dataset.nav==="altro"&&!BOTTOM.includes(tab));if(on)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  $("#ctx").textContent=NAV_NAME[tab];$(".fab").hidden=tab==="chi";
  try{history.replaceState(null,"","#"+tab)}catch(e){}safeLS.set("bic.tab",tab);closeSheet();render();window.scrollTo({top:0})}
function closeSheet(){$("#sheet-root").replaceChildren()}
function openSheet(){const items=NAV.filter(([k])=>!BOTTOM.includes(k));
  $("#sheet-root").replaceChildren(el("div",{class:"sheet-ov",onclick:closeSheet}),el("div",{class:"sheet",role:"dialog","aria-label":"Altre sezioni"},...items.map(([k,n,d])=>{const b=el("button",{type:"button",onclick:()=>go(k)});b.innerHTML=NAV_ICON[k];b.append(el("span",{},n,el("small",{text:d})));return b})))}
function buildNav(){
  $("#rail-items").replaceChildren(...NAV.map(([k,n,d])=>{const b=el("button",{class:"nav",type:"button","data-nav":k,title:d,onclick:()=>go(k)});b.innerHTML=NAV_ICON[k];b.append(el("span",{text:n}));return b}));
  const bb=[...BOTTOM.map(k=>[k,k==="con"?"Consumi":NAV_NAME[k]]),["altro","Altro"]];
  $("#bottom").replaceChildren(...bb.map(([k,n])=>{const b=el("button",{type:"button","data-nav":k,onclick:()=>k==="altro"?openSheet():go(k)});b.innerHTML=NAV_ICON[k];b.append(el("span",{text:n}));return b}))}
function wire(){
  for(const k of["mt","rt","dt"])$$(`[data-${k}]`).forEach(b=>b.addEventListener("click",()=>{S[k]=b.dataset[k];render()}));
  for(const id of["f-tipo","f-anno","f-off"])$("#"+id).addEventListener("change",renderBol);$("#f-q").addEventListener("input",renderBol);
  $$("[data-add]").forEach(b=>b.addEventListener("click",openAdd));
  $("#up-casa").addEventListener("change",e=>{if(e.target.value==="__new"){fillUpCasa();newCasa(id=>{render();$("#up-casa").value=id})}});
  $("#up-file").addEventListener("change",e=>{handleFiles([...e.target.files]);e.target.value=""});
  $("#up-last").addEventListener("change",e=>{handleFiles([...e.target.files].slice(0,1),{quick:true});e.target.value=""});
  $("#manual").addEventListener("click",()=>addCard({casa:upCasa(),status:"review",data:{casa:upCasa()}}));
  $("#quick-manual").addEventListener("click",openQuick);
  const dz=$("#drop");dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("over")});dz.addEventListener("dragleave",()=>dz.classList.remove("over"));dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("over");if(e.dataTransfer.files.length)handleFiles([...e.dataTransfer.files])});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSheet();closeModal()}});
  const rt=()=>{if(S.loaded)render()};try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",rt)}catch(e){}
  new MutationObserver(rt).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.tab==="bol")renderBol()},200)});
}

// ---------- avvio ----------
// market offers and PUN/PSV shipped with the page; the visitor's own offers and edits override them
const MKT=__MERCATO__;
function mergeOffers(){const o={};for(const[id,x]of Object.entries(MKT.offerte))o[id]={...x,_mkt:true};for(const[id,x]of Object.entries(S.myOff))o[id]=MKT.offerte[id]?{...x,_mkt:true}:x;S.offerte=o}
async function boot(){
  S.db=localDB();S.param={indici:MKT.indici};mergeOffers();
  S.web=!!window.WEB_SITE;if(window.loadMercato)window.loadMercato().then(m=>{if(!m||!m.offerte||!Object.keys(m.offerte).length)return;MKT.offerte=m.offerte;if(m.indici)MKT.indici=m.indici;S.param={...S.param,indici:MKT.indici};mergeOffers();if(S.loaded)render()}).catch(()=>{});
  buildNav();wire();
  const seen=new Set();let tm;const schedule=()=>{clearTimeout(tm);tm=setTimeout(render,40)};
  const map=snap=>{const o={};snap.docs.forEach(d=>{o[d.id]=d.data()});return o};
  for(const c of COLS)S.db.collection(c).onSnapshot(snap=>{const o=map(snap);
    if(c==="bollette")S.bills=Object.entries(o).map(([id,b])=>normalizeParts(JSON.parse(JSON.stringify({...b,_id:id}))));
    else if(c==="mensili")S.mensili=o;else if(c==="case")S.case=o;else if(c==="offerte"){S.myOff=o;mergeOffers()}else if(c==="parametri")S.param={indici:MKT.indici,...o};
    seen.add(c);if(seen.size===COLS.length&&!S.loaded){S.loaded=true;syncCase();go(S.tab)}else if(S.loaded)schedule()});
  if(!S.db.persistent)$("#banner").replaceChildren(el("div",{class:"warnbox",text:"Questo browser non permette al sito di salvare i dati (succede in navigazione privata o con i cookie bloccati): puoi usarlo, ma esporta una copia prima di chiudere la pagina."}));
  const cl=window.claude;if(!cl||!cl.use)return;
  const [dl,sm]=await Promise.all(["downloads","sample"].map(n=>cl.use(n).catch(()=>null)));
  S.downloads=dl;S.sample=sm;
  if(sm&&sm.limits){try{S.limits=await sm.limits()}catch(e){S.limits=null}}
  if(S.loaded)render();
}
boot();
})();</script>
