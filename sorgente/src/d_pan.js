
// ---------- panoramica ----------
function renderPan(){
  $("#pan-eyebrow").textContent=casaLabel();
  const bills=S.bills.filter(inCasa);
  const maxAl=bills.reduce((a,b)=>b.al>a?b.al:a,"");
  $("#pan-upd").textContent=maxAl?`Bollette fino a ${MESI_L[pd(maxAl).m]} ${pd(maxAl).y}`:"";
  const k=$("#kpis");
  if(!bills.length){
    const decl=casas().some(c=>Object.keys((S.case[c]||{}).consumi_annui||{}).length);
    $("#pan-lead").textContent=decl?"Hai inserito i tuoi consumi annui: il confronto con le offerte è già pronto. Aggiungi le bollette per vedere qui spesa e consumi mese per mese.":"Carica le tue bollette di luce e gas, oppure scrivi solo quanto consumi in un anno: ti mostro dove vanno i soldi e se ti conviene cambiare offerta.";
    k.replaceChildren(el("div",{class:"panel welcome",style:"grid-column:1/-1"},el("h2",{text:decl?"Aggiungi le bollette quando vuoi":"Da dove cominciare"}),
      el("div",{class:"steps"},el("div",{},el("b",{text:"1. Carica le bollette"}),el("span",{class:"muted",text:"PDF o foto, anche tante insieme. Claude legge importi, consumi e offerta; tu controlli che i totali tornino."})),
        el("div",{},el("b",{text:"2. Oppure solo i consumi"}),el("span",{class:"muted",text:"Se hai fretta: il consumo di un anno e l'ultima bolletta bastano per il confronto."})),
        el("div",{},el("b",{text:"3. Confronta le offerte"}),el("span",{class:"muted",text:"Vedi quanto spenderesti con le offerte del mercato a parità di consumi."}))),
      el("div",{class:"controls"},el("button",{class:"btn primary",type:"button",onclick:()=>openAdd(),text:"Carica le bollette"}),el("button",{class:"btn",type:"button",onclick:()=>{openAdd();openQuick()},text:"Scrivi solo i consumi"}),decl?el("button",{class:"btn",type:"button",onclick:()=>go("off"),text:"Vai alle offerte"}):null),privacyNote()));
    $("#meters").replaceChildren();renderAnnualChart();renderMonthlyChart();$("#recent").replaceChildren(el("div",{class:"emptystate",text:"Qui compariranno le ultime bollette."}));renderReminders();return}
  const L=pd(maxAl),cy=L.y,cm=L.m;
  const ytd=(y,tipo)=>{let s=0;for(const b of bills){if(tipo&&b.tipo!==tipo)continue;const a=pd(b.al);if(!a)continue;for(const sh of shares(b))if(sh.y===y&&a.y===y&&a.m<=cm)s+=paid(b)*sh.q}return s};
  const ytdG=ytd(cy,"gas"),ytdL=ytd(cy,"luce"),ytdT=ytdG+ytdL,prev=ytd(cy-1);
  const cons=(t,y)=>{let s=0,any=false;for(const c of casas())for(let m=0;m<=cm;m++){const v=mval(c,t,y,m);if(v!=null){s+=v;any=true}}return any?s:null};
  const gC=cons("gas",cy),gP=cons("gas",cy-1),lC=cons("luce",cy),lP=cons("luce",cy-1);
  const pct=(a,b)=>b?(a-b)/b*100:null;
  const d=(p)=>p==null?null:el("span",{class:"delta "+(p>0?"up":"down"),text:`${p>0?"▲":"▼"} ${Math.abs(p).toFixed(0)}%`});
  const tile=(lbl,v,sub,extra)=>el("div",{class:"panel kpi"},el("span",{class:"label",text:lbl}),el("span",{class:"v",text:v}),el("span",{class:"s"},...[].concat(sub)),extra||null);
  const bar=(a,b)=>{const t=a+b||1;return el("div",{class:"split","aria-hidden":"true"},el("i",{style:`width:${a/t*100}%;background:var(--gas)`}),el("i",{style:`width:${b/t*100}%;background:var(--luce)`}))};
  const per=`gen–${MESI[cm].toLowerCase()}`;
  k.replaceChildren(
    tile(`Spesa ${cy}, ${per}`,EUR0.format(ytdT),[`gas ${EUR0.format(ytdG)} · luce ${EUR0.format(ytdL)}`],bar(ytdG,ytdL)),
    tile(`Stesso periodo ${cy-1}`,EUR0.format(prev),[d(pct(ytdT,prev)),prev?`${ytdT<prev?"spendi meno":"spendi di più"} quest'anno`:""]),
    tile(`Gas ${cy}, ${per}`,gC!=null?`${N0.format(gC)} Smc`:"—",[d(pct(gC,gP)),gP!=null?`${N0.format(gP)} Smc nel ${cy-1}`:""]),
    tile(`Luce ${cy}, ${per}`,lC!=null?`${N0.format(lC)} kWh`:"—",[d(pct(lC,lP)),lP!=null?`${N0.format(lP)} kWh nel ${cy-1}`:""]));
  const dp=pct(ytdT,prev);
  $("#pan-lead").replaceChildren(`Da gennaio a ${MESI_L[cm]} ${cy} ${S.casa==="tutte"&&casaIds().length>1?"le tue case hanno":"hai"} speso `,el("b",{text:EUR0.format(ytdT)}),dp==null?".":`, il ${Math.abs(dp).toFixed(0)}% ${dp>0?"in più":"in meno"} dello stesso periodo del ${cy-1}.`);
  $("#meters").replaceChildren(...meters());
  renderAnnualChart();renderMonthlyChart();
  const rec=[...bills].filter(b=>!b.stima).sort((a,b)=>(b.al||"").localeCompare(a.al||"")||(b.emissione||"").localeCompare(a.emissione||"")).slice(0,4);
  $("#recent").replaceChildren(...rec.map(billItem));
  renderReminders();
}
function billItem(b){const v=verify(b);return el("button",{class:"item",type:"button",onclick:()=>openBill(b)},el("span",{class:"dot "+b.tipo,html:ICON[b.tipo]}),el("span",{class:"t"},el("b",{text:`${TIPO_N[b.tipo]} · ${b.periodo||periodo(b.dal,b.al)}`}),el("small",{text:`${casaIds().length>1?CASA_N[b.casa]+" · ":""}${N0.format(b.consumo||0)} ${UNIT[b.tipo]}${b.emissione?` · emessa ${fmtD(b.emissione)}`:""}`})),el("span",{class:"amt"},EUR.format(paid(b)),el("small",{},el("span",{class:"pill "+v.cls,text:v.lbl}))))}
function meters(){
  const out=[];
  for(const c of casas()){
    const gb=lastBill(c,"gas"),lb=lastBill(c,"luce");
    const m=el("div",{class:"meter"});
    m.append(el("div",{class:"row"},el("span",{class:"who",text:casaIds().length>1?`Contatori · ${CASA_N[c]}`:"I tuoi contatori"}),el("span",{class:"lbl",text:gb||lb?`al ${fmtD((gb||lb).al)}`:"nessun dato"})));
    if(gb&&gb.lettura_finale!=null){const digits=String(Math.round(gb.lettura_finale)).padStart(5,"0");const odo=el("div",{class:"odo","aria-label":`Lettura gas ${gb.lettura_finale} metri cubi`});[...digits].forEach((ch,i)=>{const s=el("span",{text:ch});s.style.animationDelay=`${i*60}ms`;odo.append(s)});odo.append(el("span",{class:"red",text:"m³"}),el("em",{text:`lettura ${({Rilevato:"rilevata",Stimato:"stimata",Autolettura:"da autolettura"})[gb.tipo_lettura]||"gas"}`}));m.append(el("span",{class:"lbl",text:"Gas · contatore"}),odo)}
    else if(gb){m.append(el("span",{class:"lbl",text:"Gas"}),el("div",{class:"odo"},el("span",{text:N0.format(gb.consumo)}),el("em",{text:"Smc ultima bolletta"})))}
    else m.append(el("div",{class:"empty",text:"Gas: nessuna bolletta caricata"}));
    if(lb&&(lb.f1||lb.f2||lb.f3)){const t=(lb.f1||0)+(lb.f2||0)+(lb.f3||0);const f=el("div",{class:"fasce",role:"img","aria-label":`Luce: F1 ${lb.f1} F2 ${lb.f2} F3 ${lb.f3} kWh`});[["F1",lb.f1,"var(--luce)"],["F2",lb.f2,"color-mix(in srgb,var(--luce) 65%,#fff)"],["F3",lb.f3,"var(--gas-2)"]].forEach(([n,v,col])=>f.append(el("div",{style:`flex:${v||0.001};background:${col}`,text:v?`${n} ${v}`:""})));m.append(el("span",{class:"lbl",text:`Luce · fasce ultima bolletta (${lb.periodo||periodo(lb.dal,lb.al)}, ${N0.format(t)} kWh)`}),f)}
    else if(!lb)m.append(el("div",{class:"empty",text:"Luce: nessuna bolletta caricata"}));
    const fact=(v,s)=>el("div",{},el("b",{text:v}),el("small",{text:s}));
    if(gb||lb)m.append(el("div",{class:"facts"},fact(gb?EUR.format(paid(gb)):"—","ultima gas"),fact(lb?EUR.format(paid(lb)):"—","ultima luce"),fact(gb&&gb.prezzo?`${N3.format(gb.prezzo)}`:(lb&&unitCost(lb)?N3.format(unitCost(lb)):"—"),gb&&gb.prezzo?"€/Smc offerta":"€/kWh medio")));
    out.push(m);
  }
  return out;
}
function renderAnnualChart(){
  const series=[];for(const c of casas())for(const t of["gas","luce"]){const m=annual(c,t);if(Object.keys(m).length)series.push({c,t,m})}
  const ys=[...new Set(series.flatMap(s=>Object.keys(s.m)))].sort();
  const tot=y=>series.reduce((a,s)=>a+(s.m[y]?s.m[y].pagato:0),0);
  const full=ys.filter(y=>+y<new Date().getFullYear());const ly=full[full.length-1];
  $("#k-annual").textContent=ly?`${EUR0.format(tot(ly))} nel ${ly}`:"";
  draw("c-annual",{type:"bar",data:{labels:ys,datasets:series.map(s=>({label:`${TIPO_N[s.t]} ${CASA_N[s.c]}`,data:ys.map(y=>s.m[y]?r2(s.m[y].pagato):0),backgroundColor:seriesColor(s.c,s.t),borderRadius:4,stack:"s",maxBarThickness:46}))},
    options:optsWith({tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${EUR.format(x.raw)}`,footer:it=>`Totale: ${EUR.format(it.reduce((a,b)=>a+b.raw,0))}`}},x:{stacked:true},y:{stacked:true,ticks:{callback:v=>EUR0.format(v)}}})});
  legend("lg-annual",series.map(s=>[seriesColor(s.c,s.t),`${TIPO_N[s.t]} ${CASA_N[s.c]}`]));
}
function renderMonthlyChart(){
  const t=S.mt;$$('[data-mt]').forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mt===t)));
  const bills=S.bills.filter(b=>inCasa(b)&&b.tipo===t);const maxAl=bills.reduce((a,b)=>b.al>a?b.al:a,"");const cy=maxAl?pd(maxAl).y:new Date().getFullYear();
  const ds=[],lg=[];
  for(const c of casas()){const col=seriesColor(c,t);
    for(const[y,dash]of[[cy,false],[cy-1,true]]){const mo=monthly(c,t,y);if(!mo.vals.some(v=>v!=null))continue;const est=mo.est.map(m=>m-1);
      ds.push({label:`${CASA_N[c]} ${y}`,data:mo.vals.map(v=>v==null?null:Math.round(v)),borderColor:col,backgroundColor:dash?"transparent":hexA(col,.13),fill:!dash,borderDash:dash?[5,4]:[],tension:.3,pointRadius:dash?0:3,pointBackgroundColor:col,borderWidth:2,segment:{borderDash:x=>est.includes(x.p0DataIndex)||est.includes(x.p1DataIndex)?[2,3]:undefined}});lg.push([col,`${CASA_N[c]} ${y}`,dash])}
    const avg=Array(12).fill(null);const ys=[];for(let y=cy-6;y<cy;y++){const mo=monthly(c,t,y);if(mo.vals.some(v=>v!=null))ys.push(mo)}
    if(ys.length>=2){for(let m=0;m<12;m++){const vs=ys.map(o=>o.vals[m]).filter(v=>v!=null);if(vs.length)avg[m]=Math.round(vs.reduce((a,b)=>a+b,0)/vs.length)}
      ds.push({label:`${CASA_N[c]} media ${ys.length} anni`,data:avg,borderColor:tok("--muted"),borderWidth:1.5,pointRadius:0,tension:.3,borderDash:[1,3]});lg.push([tok("--muted"),`${CASA_N[c]}: media degli anni precedenti`,true])}}
  $("#mon-sub").textContent=`${cy} contro ${cy-1} e media degli anni prima, in ${UNIT[t]}`;
  draw("c-monthly",{type:"line",data:{labels:MESI,datasets:ds},options:optsWith({tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${x.raw==null?"—":N0.format(x.raw)+" "+UNIT[t]}`}}})});
  legend("lg-monthly",lg);
}
// ---------- promemoria ----------
function addMonthsEnd(s,n){const p=pd(s);let y=p.y,m=p.m+n;while(m>11){m-=12;y++}const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return`${y}-${String(m+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`}
function addDays(s,n){const p=pd(s);const d=new Date(Date.UTC(p.y,p.m,p.d+n));return d.toISOString().slice(0,10)}
function reminders(){
  const out=[];const rank={bad:0,warn:1,info:2};
  for(const c of casas()){const info=S.case[c]||{};
    const by={};for(const t of["gas","luce"]){const o=info["offerta_"+t];if(o&&o.scadenza)(by[o.scadenza]=by[o.scadenza]||[]).push(t)}
    for(const[d,ts]of Object.entries(by)){const days=daysBetween(TODAY,d);const who=ts.map(t=>t==="gas"?"gas":"luce").join(" e ");
      out.push({lvl:days<=45?"bad":days<=120?"warn":"info",t:days<0?`Prezzo bloccato ${who}${dove(c)} scaduto il ${fmtD(d)}`:`Prezzo bloccato ${who}${dove(c)} in scadenza il ${fmtD(d)} (tra ${days} giorni)`,
        s:`${ts.map(t=>info["offerta_"+t].nome||"Offerta attuale").join(" e ")}. Controlla le nuove condizioni del fornitore e confrontale con le offerte prima di quella data.`,go:["off","Confronta le offerte"]})}
    for(const t of["gas","luce"]){const bs=S.bills.filter(b=>b.casa===c&&b.tipo===t&&!b.stima).sort((a,b)=>a.al.localeCompare(b.al));if(bs.length<2)continue;
      const gaps=[];for(let i=Math.max(1,bs.length-6);i<bs.length;i++){const a=pd(bs[i-1].al),b=pd(bs[i].al);gaps.push((b.y-a.y)*12+b.m-a.m)}gaps.sort((a,b)=>a-b);const rit=Math.max(1,gaps[Math.floor(gaps.length/2)]||2);
      const last=bs[bs.length-1];const nextEnd=addMonthsEnd(last.al,rit);const due=addDays(nextEnd,20);
      if(TODAY>due){const p=pd(nextEnd);out.push({lvl:"warn",t:`Bolletta ${t}${dove(c)} attesa e non ancora caricata`,s:`L'ultima copre fino al ${fmtD(last.al)}. Quella fino a ${MESI_L[p.m]} ${p.y} di solito arriva entro il ${fmtD(due)}.`,go:["dat","Aggiungi bolletta"]})}}
    for(const l of info.lacune||[])out.push({lvl:"info",t:`Lacuna nello storico${dove(c)}`,s:l});
  }
  for(const b of S.bills.filter(b=>inCasa(b)&&b.stima))out.push({lvl:"info",t:`${TIPO_N[b.tipo]} ${b.periodo||periodo(b.dal,b.al)}${dove(b.casa)} è una stima`,s:b.note||"Sostituiscila quando arriva la bolletta vera."});
  const ms=[];for(const c of casas())for(const t of["gas","luce"]){const m0=S.mensili[`${c}-${t}-2022`];const lb=lastBill(c,t);if(!lb)continue;const L=pd(lb.al);
    for(let i=0;i<18;i++){let y=L.y,m=L.m-i;while(m<0){m+=12;y--}const doc=S.mensili[`${c}-${t}-${y}`];if(doc&&(doc.stimati||[]).map(Number).includes(m+1))continue;const v=mval(c,t,y,m);if(v==null)continue;
      const others=[];for(let yy=y-5;yy<=y+1;yy++){if(yy===y)continue;const o=mval(c,t,yy,m);if(o!=null)others.push(o)}if(others.length<2)continue;const avg=others.reduce((a,b)=>a+b,0)/others.length;
      if(v>avg*1.5&&v-avg>(t==="gas"?40:80))ms.push({lvl:"warn",ord:y*12+m,t:`Consumo alto: ${t} di ${MESI_L[m]} ${y}${dove(c)}`,s:`${N0.format(v)} ${UNIT[t]} contro una media di ${N0.format(avg)} negli altri anni per lo stesso mese.`})}}
  ms.sort((a,b)=>b.ord-a.ord);out.push(...ms.slice(0,3));
  const newest=Object.values(S.offerte).reduce((a,o)=>(o.aggiornato||"")>a?o.aggiornato:a,"");
  if(newest){const age=daysBetween(newest,TODAY);if(age>45)out.push({lvl:"info",t:`Prezzi delle offerte letti ${age} giorni fa`,s:"Le offerte cambiano spesso: prima di decidere controlla le condizioni aggiornate sul sito del fornitore o su ilportaleofferte.it.",go:["off","Vai alle offerte"]})}
  return out.sort((a,b)=>rank[a.lvl]-rank[b.lvl]);
}
function renderReminders(){const box=$("#rem");const rs=reminders();
  box.replaceChildren(...(rs.length?rs.map(r=>el("div",{class:"r "+r.lvl},el("i"),el("div",{},el("b",{text:r.t}),el("span",{text:r.s}),r.go?el("div",{},el("button",{class:"btn sm",type:"button",onclick:()=>go(r.go[0]),text:r.go[1]})):null))):[el("p",{class:"muted",text:"Niente da segnalare."})]));
  const notes=[];for(const c of casas()){const n=(S.case[c]||{}).note||[];if(n.length)notes.push(el("details",{class:"more"},el("summary",{text:`Note sulle bollette${dove(c)} (${n.length})`}),el("ul",{class:"notes",style:"margin-top:8px"},...n.map(t=>el("li",{text:t})))))}
  box.append(...notes)}

// ---------- bollette ----------
function renderBol(){
  $("#bol-eyebrow").textContent=casaLabel();
  const tipo=$("#f-tipo").value,anno=$("#f-anno").value,off=$("#f-off").value,q=$("#f-q").value.trim().toLowerCase();
  const ys=years(inCasa);const cur=anno;$("#f-anno").replaceChildren(el("option",{value:"",text:"Tutti gli anni"}),...ys.slice().reverse().map(y=>el("option",{value:y,text:y})));$("#f-anno").value=ys.map(String).includes(cur)?cur:"";
  const offs=[...new Set(S.bills.filter(b=>inCasa(b)&&(!tipo||b.tipo===tipo)).map(b=>b.offerta).filter(Boolean))].sort();$("#f-off").replaceChildren(el("option",{value:"",text:"Tutte le offerte"}),...offs.map(o=>el("option",{value:o,text:o})));$("#f-off").value=offs.includes(off)?off:"";
  let rows=S.bills.filter(b=>inCasa(b)&&(!tipo||b.tipo===tipo)&&(!$("#f-anno").value||shares(b).some(s=>s.y===+$("#f-anno").value))&&(!$("#f-off").value||b.offerta===$("#f-off").value)&&(!q||[b.n,b.offerta,b.note,b.periodo].join(" ").toLowerCase().includes(q)));
  const K={casa:b=>b.casa,tipo:b=>b.tipo,al:b=>b.al||"",n:b=>String(b.n),offerta:b=>b.offerta||"",consumo:b=>b.consumo||0,unit:b=>unitCost(b)||0,paid:b=>paid(b),stato:b=>verify(b).k};
  const {k,dir}=S.sort;rows.sort((a,b)=>{const x=K[k](a),y=K[k](b);return(x<y?-1:x>y?1:0)*dir||(b.al||"").localeCompare(a.al||"")});
  const tot=rows.reduce((a,b)=>a+paid(b),0);const nok=rows.filter(b=>verify(b).k==="ok").length;
  $("#bol-lead").textContent=rows.length?`${rows.length} bollette per ${EUR.format(tot)} pagati. ${nok} su ${rows.length} verificate al centesimo (somma delle voci uguale al totale stampato).`:"";
  const cols=[["casa","Casa"],["tipo","Fornitura"],["al","Periodo"],["n","N. fattura"],["offerta","Offerta"],["consumo","Consumo",1],["unit","Costo unitario",1],["paid","Totale pagato",1],["stato","Stato"]];
  $("#tbl thead").replaceChildren(el("tr",{},...cols.map(([key,h,r])=>el("th",{class:r?"r":"","aria-sort":k===key?(dir>0?"ascending":"descending"):null},el("button",{type:"button",onclick:()=>{S.sort=k===key?{k,dir:-dir}:{k:key,dir:key==="al"||r?-1:1};renderBol()},text:h+(k===key?(dir>0?" ↑":" ↓"):"")})))));
  const tb=$("#tbl tbody"),tf=$("#tbl tfoot");
  if(!rows.length){const msg=S.bills.filter(inCasa).length?"Nessuna bolletta con questi filtri.":"Ancora nessuna bolletta: aggiungila dalla sezione Dati.";tb.replaceChildren(el("tr",{},el("td",{colspan:9,class:"muted",style:"text-align:center;padding:28px",text:msg})));tf.replaceChildren();$("#bol-list").replaceChildren(el("div",{class:"emptystate",text:msg}));return}
  tb.replaceChildren(...rows.map(b=>{const u=unitCost(b),v=verify(b);return el("tr",{tabindex:0,onclick:()=>openBill(b),onkeydown:e=>{if(e.key==="Enter")openBill(b)}},el("td",{text:CASA_N[b.casa]}),el("td",{},el("span",{class:"pill "+b.tipo,text:TIPO_N[b.tipo]})),el("td",{text:b.periodo||periodo(b.dal,b.al)}),el("td",{class:"num muted",text:b.n}),el("td",{class:"muted",text:b.offerta||"—"}),el("td",{class:"r num",text:`${N0.format(b.consumo||0)} ${UNIT[b.tipo]}`}),el("td",{class:"r num",text:u?`${N3.format(u)} €`:"—"}),el("td",{class:"r num",style:"font-weight:600",text:EUR.format(paid(b))}),el("td",{},el("span",{class:"pill "+v.cls,text:v.lbl})))}));
  tf.replaceChildren(el("tr",{},el("td",{colspan:7,text:`${rows.length} bollette`}),el("td",{class:"r num",text:EUR.format(tot)}),el("td",{})));
  $("#bol-list").replaceChildren(...rows.map(billItem));
}
function openBill(b){
  const u=UNIT[b.tipo],v=verify(b);const rows=[...(casaIds().length>1?[["Casa",CASA_N[b.casa]]]:[]),["N. fattura",b.n],["Periodo",`${fmtD(b.dal)} – ${fmtD(b.al)}`],["Emessa",fmtD(b.emissione)],["Scadenza",fmtD(b.scadenza)],["Offerta",b.offerta||"—"]];
  if(b.tipo==="gas")rows.push(["Prezzo offerta",b.prezzo?`${N3.format(b.prezzo)} €/Smc`:"—"],["Letture",b.lettura_iniziale!=null?`${N0.format(b.lettura_iniziale)} → ${N0.format(b.lettura_finale)} (${b.tipo_lettura||"—"})`:"—"],["Consumo",`${N0.format(b.consumo||0)} Smc`]);
  else rows.push(["Fasce F1/F2/F3",b.f1!=null?`${b.f1} / ${b.f2} / ${b.f3} kWh`:"—"],["Consumo",`${N0.format(b.consumo||0)} kWh`],["Quota F3",b.f1!=null&&b.consumo?`${Math.round((b.f3||0)/b.consumo*100)}%`:"—"]);
  rows.push(["Costo unitario",unitCost(b)?`${N3.format(unitCost(b))} €/${u} tutto compreso`:"—"],["Solo materia prima",materiaOf(b)!=null&&b.consumo?`${N3.format(materiaOf(b)/b.consumo)} €/${u}`:"—"]);
  {const fv=fvBill(b);rows.push(["Costi fissi del periodo",`${EUR.format(fv.fisso)} (${b.quota_fissa>0?`quote fisse stampate in bolletta, ${EUR.format(b.quota_fissa)} più imposte`:fv.model?fv.model.metodo==="calcolata"?`stimati dalle bollette di «${fv.model.offerta}»`:fv.model.metodo:"stima non disponibile"})`],["Costi legati al consumo",EUR.format(fv.variabile)])}
  const sh=shares(b);rows.push(["Anno di attribuzione",sh.map(s=>`${s.y}${sh.length>1?` (${Math.round(s.q*100)}%)`:""}`).join(" + ")]);
  // voci
  const voci=b.tipo==="gas"?[["Materia gas",b.vendita,"--gas"],["Rete e oneri",b.rete_oneri,"--gas-2"],["Altre partite",b.altre,"--ok"],["Accise e IVA",b.accise_iva,"--muted"],["Canone RAI",b.canone,"--luce-2"]]
    :[["Energia",materiaOf(b),"--luce"],["Rete e oneri",b.rete_oneri,"--gas-2"],["Altre partite",b.altre,"--ok"],["Accise e IVA",b.accise_iva,"--muted"],["Canone RAI",b.canone,"--luce-2"]];
  const pos=voci.filter(([,x])=>x>0),sum=pos.reduce((a,[,x])=>a+x,0)||1;
  const vbar=el("div",{class:"voci",role:"img","aria-label":"Voci di costo"},...pos.map(([n,x,c])=>el("i",{style:`width:${x/sum*100}%;background:var(${c})`,title:`${n}: ${EUR.format(x)}`})));
  const vleg=el("div",{class:"legend"},...voci.filter(([,x])=>x!=null&&x!==0).map(([n,x,c])=>el("span",{},el("i",{style:`background:var(${c})`}),`${n} ${EUR.format(x)}`)),b.crediti?el("span",{},el("i",{style:"background:transparent;border:2px dashed var(--ok)"}),`Crediti ${EUR.format(b.crediti)} (non sono un costo)`):null);
  const lampCol={ok:"var(--ok)",warn:"var(--warn)",bad:"var(--bad)"}[v.cls];
  const actions=el("div",{class:"controls",style:"justify-content:flex-end"});
  const del=el("button",{class:"btn danger",type:"button",text:"Elimina",onclick:()=>{actions.replaceChildren(el("span",{class:"muted",text:"Eliminare questa bolletta?"}),el("button",{class:"btn",type:"button",text:"Annulla",onclick:()=>openBill(b)}),el("button",{class:"btn danger",type:"button",text:"Sì, elimina",onclick:async e=>{e.target.disabled=true;try{await dbDel("bollette/"+b._id);closeModal();toast("Bolletta eliminata")}catch(err){actions.prepend(el("span",{class:"errbox",text:dbErr(err)}))}}}))}});
  const edit=el("button",{class:"btn",type:"button",text:"Modifica",onclick:()=>{closeModal();S.dt="add";go("dat");addCard({casa:b.casa,status:"review",data:{...b},editing:b._id})}});
  if(S.canWrite&&S.db)actions.append(del,edit);actions.append(el("button",{class:"btn primary",type:"button",text:"Chiudi",onclick:closeModal}));
  modal([el("div",{style:"display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"},el("div",{},el("span",{class:"pill "+b.tipo,text:TIPO_N[b.tipo]}),el("h2",{style:"margin-top:6px",text:`${b.periodo||periodo(b.dal,b.al)}${dove(b.casa)}`})),el("div",{style:"text-align:right"},el("div",{style:"font-family:var(--f-display);font-weight:800;font-size:1.8rem",class:"num",text:EUR.format(paid(b))}),el("span",{class:"muted",style:"font-size:.8rem",text:b.canone||b.crediti?`totale bolletta ${EUR.format(b.totale||0)}`:"totale pagato"}))),
    el("div",{class:"verify"},el("span",{class:"lamp",style:`background:${lampCol}`}),el("span",{},el("b",{text:v.k==="ok"?"Verificata al centesimo. ":v.k==="bad"?"Il totale non torna. ":v.k==="stima"?"Stima. ":"Da controllare. "}),v.txt)),
    el("div",{},el("span",{class:"label",text:"Dove vanno i soldi"}),el("div",{style:"margin-top:6px"},vbar),vleg),
    el("dl",{class:"dl"},...rows.map(([k,v])=>el("div",{},el("dt",{text:k}),el("dd",{text:v})))),b.note?el("p",{class:"muted",text:"Note: "+b.note}):null,actions]);
}
