
// ---------- fissi e variabili (modello per offerta) ----------
const monthsOf=b=>{const a=pd(b.dal),c=pd(b.al);if(!a||!c)return 0;return((Date.UTC(c.y,c.m,c.d)-Date.UTC(a.y,a.m,a.d))/864e5+1)/30.4375};
const hasParts=b=>b.tipo==="gas"?b.vendita!=null:b.spesa_energia!=null;
const energyCost=b=>hasParts(b)?(b.tipo==="gas"?(b.vendita||0)+(b.rete_oneri||0)+(b.accise_iva||0):(b.spesa_energia||0)+(b.accise_iva||0)):(b.totale||0)-(b.altre||0);
const modelKey=b=>`${b.casa}|${b.tipo}|${b.offerta||"—"}`;
const mdist=(a,b)=>{const p=pd(a),q=pd(b);return p&&q?Math.abs((p.y*12+p.m)-(q.y*12+q.m)):999};
// typical fixed charges (€/month before tax) for bills that don't print them when there are too few bills to work them out:
// median sales fee of the market offers plus a typical network fee
const RETE_TIPICA={gas:5,luce:7};
const medianFee=t=>{const v=Object.values(S.offerte).filter(o=>o.tipo===t&&o.quota_fissa>0).map(o=>o.quota_fissa).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:10};
let FV=null,FVsrc=null;
function fvModels(){if(FV&&FVsrc===S.bills)return FV;FVsrc=S.bills;
  const groups={};for(const b of S.bills){const k=modelKey(b);(groups[k]=groups[k]||{casa:b.casa,tipo:b.tipo,offerta:b.offerta||"—",bills:[]}).bills.push(b)}
  const models=Object.entries(groups).map(([k,g])=>{
    const pts=g.bills.filter(b=>!b.stima&&b.consumo>0&&monthsOf(b)>0.4).map(b=>{const mo=monthsOf(b);return{x:b.consumo/mo,y:energyCost(b)/mo,b}});
    const dal=g.bills.reduce((a,b)=>!a||b.dal<a?b.dal:a,""),al=g.bills.reduce((a,b)=>b.al>a?b.al:a,"");
    const m={key:k,casa:g.casa,tipo:g.tipo,offerta:g.offerta,dal,al,n:pts.length,nb:g.bills.length,pts,F:null,v:null,r2:null,metodo:""};
    if(pts.length>=4){const n=pts.length,mx=pts.reduce((a,p)=>a+p.x,0)/n,my=pts.reduce((a,p)=>a+p.y,0)/n;let sxx=0,sxy=0,syy=0;
      for(const p of pts){sxx+=(p.x-mx)**2;sxy+=(p.x-mx)*(p.y-my);syy+=(p.y-my)**2}
      const xs=pts.map(p=>p.x),spread=Math.min(...xs)>0?Math.max(...xs)/Math.min(...xs):99;
      if(sxx>0){const v=sxy/sxx,F=my-v*mx;if(F>=0&&v>0&&spread>=1.3){let res=0;for(const p of pts)res+=(p.y-F-v*p.x)**2;m.F=F;m.v=v;m.r2=syy?1-res/syy:1;m.metodo="calcolata"}}}
    return m});
  // where bills carry their printed fixed charges, use those instead of the regression
  for(const m of models){const g=S.bills.filter(b=>modelKey(b)===m.key&&b.quota_fissa>0&&hasParts(b)&&monthsOf(b)>0.4);if(!g.length)continue;
    m.F=g.reduce((a,b)=>a+fixedOf(b)/monthsOf(b),0)/g.length;m.metodo="letta in bolletta";m.r2=null;const sx=m.pts.reduce((a,p)=>a+p.x,0),sy=m.pts.reduce((a,p)=>a+p.y-m.F,0);m.v=sx>0?Math.max(0,sy/sx):0}
  for(const m of models){if(m.F!=null)continue;
    const peers=models.filter(o=>o!==m&&o.metodo==="calcolata"&&o.casa===m.casa&&o.tipo===m.tipo).sort((a,b)=>Math.min(mdist(a.dal,m.al),mdist(a.al,m.dal))-Math.min(mdist(b.dal,m.al),mdist(b.al,m.dal)));
    if(peers.length){m.F=peers[0].F;m.metodo=`stimata: quota fissa di «${peers[0].offerta}»`}else{const tip=(medianFee(m.tipo)+RETE_TIPICA[m.tipo])*(m.tipo==="luce"?1.1:1.15);const lo=m.pts.length?Math.min(...m.pts.map(p=>p.y)):tip;m.F=Math.min(tip,lo*0.7);m.metodo="stimata con valori tipici: la bolletta non riporta le quote fisse e servono più bollette per calcolarle"}
    const sx=m.pts.reduce((a,p)=>a+p.x,0),sy=m.pts.reduce((a,p)=>a+p.y-m.F,0);m.v=sx>0?Math.max(0,sy/sx):0}
  FV={};for(const m of models)FV[m.key]=m;return FV}
// fixed part of a bill: the fixed charges printed on it when known (plus their share of taxes), otherwise the per-offer regression
function fixedOf(b){const en=energyCost(b),tax=b.accise_iva||0,pre=en-tax;return Math.min(en,b.quota_fissa*(pre>0?en/pre:1))}
function fvBill(b){const m=fvModels()[modelKey(b)];const en=energyCost(b);let F=m?m.F*monthsOf(b):0;
  if(b.quota_fissa>0&&hasParts(b))F=fixedOf(b);const fisso=en>0?Math.min(F,en):0;return{fisso,variabile:en-fisso,altre:b.altre||0,canone:b.canone||0,crediti:b.crediti||0,model:m}}
function fvAnnual(cs,tipos){const out={};for(const b of S.bills){if(!cs.includes(b.casa)||!tipos.includes(b.tipo))continue;const d=fvBill(b),mo=monthsOf(b);
  for(const{y,q}of shares(b)){const r=out[y]||(out[y]={n:0,consumo:0,fisso:0,variabile:0,altre:0,canone:0,crediti:0,pagato:0,mesi:0});r.n+=q;r.consumo+=(b.consumo||0)*q;r.fisso+=d.fisso*q;r.variabile+=d.variabile*q;r.altre+=d.altre*q;r.canone+=d.canone*q;r.crediti+=d.crediti*q;r.pagato+=paid(b)*q;if(b.consumo>0||b.stima)r.mesi+=mo*q}}return out}
function currentModel(c,t){const last=S.bills.filter(b=>b.casa===c&&b.tipo===t&&!b.stima&&b.consumo>0).sort((a,b)=>b.al.localeCompare(a.al))[0];return last?fvModels()[modelKey(last)]:null}
const relLabel=m=>m.metodo==="letta in bolletta"?"letta in bolletta":m.metodo!=="calcolata"?"stima indiretta":m.r2>=.9?"affidabilità alta":m.r2>=.7?"affidabilità media":"affidabilità bassa";

// ---------- consumi e costi ----------
function renderCon(){
  const rt=S.rt;$$('[data-rt]').forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.rt===rt)));
  $("#con-eyebrow").textContent=casaLabel();
  const tipos=rt==="tot"?["gas","luce"]:[rt];const cs=casas();const tp=rt==="tot"?"gas":rt;const unit=UNIT[tp];
  const body=$("#con-body");
  const agg={};for(const c of cs)for(const t of tipos){for(const[y,v]of Object.entries(annual(c,t))){const r=agg[y]||(agg[y]={n:0,consumo:0,totale:0,canone:0,pagato:0,energia:0,crediti:0,stime:0,byc:{}});r.n+=v.n;r.consumo+=v.consumo;r.totale+=v.totale;r.canone+=v.canone;r.pagato+=v.pagato;r.energia+=v.energia;r.crediti+=v.crediti;r.stime+=v.stime;r.byc[c]=(r.byc[c]||0)+v.pagato}}
  const ys=Object.keys(agg).sort();
  if(!ys.length){$("#con-lead").textContent="";body.replaceChildren(el("div",{class:"panel emptystate",text:"Nessun dato per questa selezione."}));return}
  const M=fvModels();
  // tiles
  const tiles=[];for(const c of cs)for(const t of tipos){const m=currentModel(c,t);if(!m)continue;const ann=fvAnnual([c],[t]);const fy=Object.keys(ann).filter(y=>ann[y].mesi>=10.5).sort();const ly=fy[fy.length-1];const share=ly&&ann[ly].pagato>0?ann[ly].fisso/ann[ly].pagato*100:null;
    tiles.push(el("div",{class:"panel kpi"},el("span",{class:"label",text:`${TIPO_N[t]}${dove(c)} · quota fissa`}),el("span",{class:"v",text:`${EUR0.format(m.F*12)}/anno`}),
      el("span",{class:"s",text:`${EUR.format(m.F)} al mese, poi ${N3.format(m.v)} € per ogni ${UNIT[t]}`}),share!=null?el("span",{class:"s",text:`Nel ${ly} la parte fissa è stata il ${Math.round(share)}% della spesa`}):null,
      el("span",{style:"display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"},el("span",{class:"tag",text:m.offerta}),el("span",{class:"tag",text:relLabel(m)}))))}
  // year table
  const head=["Anno","Bollette"];if(rt!=="tot")head.push(`Consumo (${unit})`);if(rt!=="gas")head.push("Canone RAI");if(cs.length>1)cs.forEach(c=>head.push(CASA_N[c]));head.push("Totale pagato");if(rt!=="tot")head.push(`€/${unit} medio`);head.push("Rispetto all'anno prima");
  const trs=ys.map((y,i)=>{const r=agg[y],p=agg[ys[i-1]];const cells=[el("td",{style:"font-weight:700",text:y}),el("td",{class:"r num",text:(Math.round(r.n*10)/10).toLocaleString("it-IT")+(r.stime?` (${r.stime} stima)`:"")})];
    if(rt!=="tot")cells.push(el("td",{class:"r num",text:N0.format(r.consumo)}));if(rt!=="gas")cells.push(el("td",{class:"r num",text:EUR.format(r.canone)}));if(cs.length>1)cs.forEach(c=>cells.push(el("td",{class:"r num",text:r.byc[c]?EUR.format(r.byc[c]):"—"})));
    cells.push(el("td",{class:"r num",style:"font-weight:700",text:EUR.format(r.pagato)}));if(rt!=="tot")cells.push(el("td",{class:"r num",text:r.consumo?N3.format((rt==="luce"?r.energia:r.totale)/r.consumo):"—"}));
    const dd=p&&p.pagato?(r.pagato-p.pagato)/p.pagato*100:null;cells.push(el("td",{class:"r num"},dd==null?"—":el("span",{class:"delta "+(dd>0?"up":"down"),text:`${dd>0?"+":""}${dd.toFixed(0)}%`})));return el("tr",{},...cells)});
  const table=el("div",{class:"tw"},el("table",{},el("thead",{},el("tr",{},...head.map((h,i)=>el("th",{class:i?"r":"",text:h})))),el("tbody",{},...trs)));
  const showFasce=rt!=="gas";
  body.replaceChildren(el("div",{style:"display:flex;flex-direction:column;gap:16px"},
    tiles.length?el("div",{class:"grid g4"},...tiles):null,
    el("div",{class:"grid g2"},panel(rt==="tot"?"Spesa per casa e fornitura":`Consumi mensili di ${rt} per anno`,rt==="tot"?"Totale pagato per anno":`Una linea per anno, in ${unit}; tratteggiati i mesi stimati`,[chartBox("c-rep1"),el("div",{class:"legend",id:"lg-rep1"})]),
      panel(`Costo per ${unit}, bolletta per bolletta`,`Tutto compreso e sola materia prima; i triangoli segnano i cambi d'offerta`,[chartBox("c-rep2"),el("div",{class:"legend",id:"lg-rep2"})])),
    el("div",{class:"grid g2"},showFasce?panel("Luce per fasce","Ultime bollette, kWh in F1 (giorno feriale), F2 e F3 (sere, notti, festivi)",[chartBox("c-fasce"),el("div",{class:"legend",id:"lg-fasce"})],el("span",{class:"keynum",id:"k-f3"})):null,
      panel("Dove vanno i soldi","Composizione della spesa per anno, in percentuale",[chartBox("c-rep3"),el("div",{class:"legend",id:"lg-rep3"})])),
    el("div",{class:"grid g2"},panel(`${TIPO_N[tp]}: spesa al mese rispetto ai consumi`,"Ogni punto è una bolletta; la retta tocca lo zero alla quota fissa",[chartBox("c-fv2"),el("div",{class:"legend",id:"lg-fv2"})]),
      panel("Cosa dicono i numeri",null,[el("ul",{class:"notes",id:"insights"})])),
    panel("Riepilogo per anno",null,[table],el("div",{class:"controls"},el("button",{class:"btn sm",type:"button","data-exp":"xlsx",text:"Scarica Excel"}),el("button",{class:"btn sm",type:"button","data-exp":"csv",text:"Scarica CSV"})))));
  const pal=y=>{const idx=ys.length-1-ys.indexOf(String(y));const base=rt==="luce"?["--luce","--luce-2","--gas-2","--gas","--muted"]:["--gas","--gas-2","--luce","--luce-2","--muted"];return tok(base[Math.min(idx,base.length-1)])};
  if(rt!=="tot"){
    const ds=[],lg=[];const showYs=ys.slice(-4);
    for(const y of showYs){const vals=Array(12).fill(null);const est=new Set();for(const c of cs){const mo=monthly(c,rt,+y);mo.vals.forEach((v,i)=>{if(v!=null)vals[i]=(vals[i]||0)+v});mo.est.forEach(m=>est.add(m-1))}if(!vals.some(v=>v!=null))continue;const col=pal(y);
      ds.push({label:y,data:vals.map(v=>v==null?null:Math.round(v)),borderColor:col,backgroundColor:col,tension:.3,pointRadius:vals.map((v,i)=>est.has(i)?5:2.5),pointStyle:vals.map((v,i)=>est.has(i)?"rectRot":"circle"),borderWidth:y===showYs[showYs.length-1]?3:1.6,segment:{borderDash:x=>est.has(x.p0DataIndex)||est.has(x.p1DataIndex)?[4,4]:undefined}});lg.push([col,y])}
    lg.push([tok("--muted"),"mese stimato",true]);
    draw("c-rep1",{type:"line",data:{labels:MESI,datasets:ds},options:optsWith({tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${x.raw==null?"—":N0.format(x.raw)+" "+unit}`}}})});legend("lg-rep1",lg);
  }else{
    const ser=[];for(const c of cs)for(const t of tipos){const m=annual(c,t);if(Object.keys(m).length)ser.push({c,t,m})}
    draw("c-rep1",{type:"bar",data:{labels:ys,datasets:ser.map(s=>({label:`${TIPO_N[s.t]} ${CASA_N[s.c]}`,data:ys.map(y=>s.m[y]?r2(s.m[y].pagato):0),backgroundColor:seriesColor(s.c,s.t),borderRadius:4,maxBarThickness:28}))},options:optsWith({y:{ticks:{callback:v=>EUR0.format(v)}},tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${EUR.format(x.raw)}`}}})});legend("lg-rep1",ser.map(s=>[seriesColor(s.c,s.t),`${TIPO_N[s.t]} ${CASA_N[s.c]}`]));
  }
  // unit cost over time
  {const ds2=[],lg2=[],meta={};for(const c of cs){const bs=S.bills.filter(b=>b.casa===c&&b.tipo===tp&&unitCost(b)&&b.consumo>=(tp==="gas"?40:30)).sort((a,b)=>a.al.localeCompare(b.al));if(!bs.length)continue;const col=seriesColor(c,tp);
      const ch=bs.map((b,i)=>i>0&&(b.offerta||"")!==(bs[i-1].offerta||""));
      ds2.push({label:`${CASA_N[c]} tutto compreso`,c,data:bs.map(b=>({x:b.al,y:r2(unitCost(b)*1000)/1000,b})),borderColor:col,backgroundColor:col,pointRadius:bs.map((b,i)=>ch[i]?7:3),pointStyle:bs.map((b,i)=>ch[i]?"triangle":"circle"),tension:.2,borderWidth:2});
      ds2.push({label:`${CASA_N[c]} materia prima`,c,data:bs.map(b=>({x:b.al,y:materiaOf(b)!=null?r2(materiaOf(b)/b.consumo*1000)/1000:null,b})),borderColor:col,borderDash:[5,4],borderWidth:1.6,pointRadius:0,stepped:true});
      lg2.push([col,`${CASA_N[c]}: tutto compreso`],[col,`${CASA_N[c]}: materia prima`,true])}
    const allX=[...new Set(ds2.flatMap(d=>d.data.map(p=>p.x)))].sort();ds2.forEach(d=>{const m=Object.fromEntries(d.data.map(p=>[p.x,p]));d.meta=m;d.data=allX.map(x=>m[x]?m[x].y:null);d.spanGaps=true;
      if(Array.isArray(d.pointRadius)){const pr=d.pointRadius,ps=d.pointStyle,orig=Object.values(m);d.pointRadius=allX.map(x=>m[x]?pr[orig.indexOf(m[x])]:0);d.pointStyle=allX.map(x=>m[x]?ps[orig.indexOf(m[x])]:"circle")}});
    draw("c-rep2",{type:"line",data:{labels:allX.map(x=>{const p=pd(x);return`${MESI[p.m]} ${String(p.y).slice(2)}`}),datasets:ds2},options:optsWith({tooltip:{callbacks:{label:x=>{const m=x.dataset.meta[allX[x.dataIndex]];if(!m||x.raw==null)return null;return`${x.dataset.label} · ${m.b.periodo||periodo(m.b.dal,m.b.al)}: ${N3.format(x.raw)} €/${unit}`},afterBody:it=>{const x=it[0];if(!x)return"";const m=x.dataset.meta[allX[x.dataIndex]];return m&&m.b.offerta?`Offerta: ${m.b.offerta}`:""}}},y:{beginAtZero:false,ticks:{callback:v=>N2.format(v)}}})});
    legend("lg-rep2",lg2.concat([[tok("--muted"),"bollette con consumi minimi escluse",true]]))}
  // fasce
  if(showFasce){const lb=S.bills.filter(b=>cs.includes(b.casa)&&b.tipo==="luce"&&b.f1!=null&&!b.stima).sort((a,b)=>a.al.localeCompare(b.al)).slice(-12);
    const labs=lb.map(b=>{const p=pd(b.al);return`${cs.length>1?CASA_N[b.casa].slice(0,3)+" ":""}${MESI[p.m]} ${String(p.y).slice(2)}`});
    const fc=[tok("--luce"),hexA(tok("--luce"),.55),tok("--gas-2")];
    draw("c-fasce",{type:"bar",data:{labels:labs,datasets:["f1","f2","f3"].map((f,i)=>({label:f.toUpperCase(),data:lb.map(b=>b[f]||0),backgroundColor:fc[i],stack:"s",borderRadius:2,maxBarThickness:34}))},options:optsWith({x:{stacked:true},y:{stacked:true},tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${x.raw} kWh`,footer:it=>{const b=lb[it[0].dataIndex];return`F3: ${Math.round((b.f3||0)/((b.f1||0)+(b.f2||0)+(b.f3||0))*100)}% · ${b.periodo}`}}}})});
    legend("lg-fasce",[[fc[0],"F1"],[fc[1],"F2"],[fc[2],"F3"]]);
    const t=lb.reduce((a,b)=>[a[0]+(b.f3||0),a[1]+(b.f1||0)+(b.f2||0)+(b.f3||0)],[0,0]);$("#k-f3").textContent=t[1]?`F3 ${Math.round(t[0]/t[1]*100)}%`:""}
  // composition 100%
  {const comp=ys.map(y=>{const o={vendita:0,rete:0,tasse:0,altro:0};for(const b of S.bills){if(!cs.includes(b.casa)||!tipos.includes(b.tipo))continue;for(const sh of shares(b)){if(sh.y!==+y)continue;const q=sh.q;const ven=b.tipo==="gas"?(b.vendita||0):((b.spesa_energia||0)-(b.rete_oneri||0));o.vendita+=ven*q;o.rete+=(b.rete_oneri||0)*q;o.tasse+=(b.accise_iva||0)*q;o.altro+=((b.altre||0)+(b.canone||0))*q}}const s=o.vendita+o.rete+o.tasse+Math.max(0,o.altro)||1;return{o,s}});
    const cols=[tok(rt==="luce"?"--luce":"--gas"),tok(rt==="luce"?"--luce-2":"--gas-2"),tok("--muted"),tok("--ok")];
    const keys=[["vendita",rt==="luce"?"Energia":rt==="gas"?"Materia gas":"Materia prima"],["rete","Rete e oneri"],["tasse","Accise e IVA"],["altro","Canone RAI e altre partite"]];
    draw("c-rep3",{type:"bar",data:{labels:ys,datasets:keys.map(([k,n],i)=>({label:n,data:comp.map(({o,s})=>Math.round(Math.max(0,o[k])/s*1000)/10),eur:comp.map(({o})=>o[k]),backgroundColor:cols[i],stack:"s",borderRadius:2,maxBarThickness:42}))},options:optsWith({x:{stacked:true},y:{stacked:true,max:100,ticks:{callback:v=>v+"%"}},tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${N1.format(x.raw)}% (${EUR0.format(x.dataset.eur[x.dataIndex])})`}}})});legend("lg-rep3",keys.map(([k,n],i)=>[cols[i],n]))}
  // scatter fissi/variabili
  {const dsets=[],lg=[];for(const c of cs){const m=currentModel(c,tp);const col=seriesColor(c,tp);const pts=Object.values(M).filter(o=>o.casa===c&&o.tipo===tp).flatMap(o=>o.pts.map(p=>({x:r2(p.x),y:r2(p.y),p:p.b.periodo||periodo(p.b.dal,p.b.al),o:o.offerta,cur:o===m})));if(!pts.length)continue;
      dsets.push({type:"scatter",label:CASA_N[c],data:pts,backgroundColor:pts.map(p=>p.cur?col:hexA(col,.35)),borderColor:col,pointRadius:pts.map(p=>p.cur?4.5:3)});lg.push([col,`${CASA_N[c]} (pieni: offerta attuale)`]);
      if(m){const mx=Math.max(...pts.map(p=>p.x))*1.05;dsets.push({type:"line",label:`Retta ${CASA_N[c]}`,data:[{x:0,y:r2(m.F)},{x:r2(mx),y:r2(m.F+m.v*mx)}],borderColor:col,borderDash:[6,4],borderWidth:2,pointRadius:[5,0],pointBackgroundColor:col,fill:false});lg.push([col,`${CASA_N[c]}: quota fissa + costo per ${unit}`,true])}}
    const g=tok("--line"),mu=tok("--muted");
    draw("c-fv2",{type:"scatter",data:{datasets:dsets},options:B({interaction:{mode:"nearest",intersect:true},plugins:{...B().plugins,tooltip:{...B().plugins.tooltip,callbacks:{label:x=>{const d=x.raw;return d.p?`${x.dataset.label} · ${d.p}: ${N0.format(d.x)} ${unit}/mese → ${EUR.format(d.y)}/mese`:`${x.dataset.label}: ${EUR.format(d.y)}/mese a ${N0.format(d.x)} ${unit}`}}}},
      scales:{x:{type:"linear",min:0,grid:{color:g},ticks:{color:mu,font:{family:"Instrument Sans",size:11}},title:{display:true,text:`${unit} al mese`,color:mu}},y:{min:0,grid:{color:g},border:{display:false},ticks:{color:mu,font:{family:"Instrument Sans",size:11},callback:v=>EUR0.format(v)},title:{display:true,text:"€ al mese",color:mu}}}})});legend("lg-fv2",lg)}
  // insights
  const ins=[];const last=ys[ys.length-1];
  const full=ys.filter(y=>{const months=new Set();for(const b of S.bills)if(cs.includes(b.casa)&&tipos.includes(b.tipo))for(const[yy,mm]of monthsIn(b.dal,b.al))if(yy===+y)months.add(mm);return months.size>=12});
  if(full.length>1){const best=full.reduce((a,b)=>agg[a].pagato<agg[b].pagato?a:b),worst=full.reduce((a,b)=>agg[a].pagato>agg[b].pagato?a:b);if(best!==worst)ins.push(`Fra gli anni completi il più caro è il ${worst} (${EUR0.format(agg[worst].pagato)}), il più leggero il ${best} (${EUR0.format(agg[best].pagato)}).`)}
  if(rt!=="tot"&&full.length>=2){const a=full[full.length-2],b=full[full.length-1];const ua=(rt==="luce"?agg[a].energia:agg[a].totale)/agg[a].consumo,ub=(rt==="luce"?agg[b].energia:agg[b].totale)/agg[b].consumo;const dc=(agg[b].consumo-agg[a].consumo)/agg[a].consumo*100,du=(ub-ua)/ua*100;ins.push(`Dal ${a} al ${b} i consumi sono ${dc>=0?"saliti":"scesi"} del ${Math.abs(dc).toFixed(0)}% e il costo medio per ${unit} è ${du>=0?"salito":"sceso"} del ${Math.abs(du).toFixed(0)}% (${N3.format(ua)} → ${N3.format(ub)} €).`)}
  for(const c of cs){const g=annual(c,"gas"),lu=annual(c,"luce");const fy=full.filter(y=>g[y]&&lu[y]);const y=fy[fy.length-1];if(y&&rt==="tot")ins.push(`${casaIds().length>1?CASA_N[c]+": n":"N"}el ${y} il gas vale il ${Math.round(g[y].pagato/(g[y].pagato+lu[y].pagato)*100)}% della spesa per l'energia.`);
    if(rt!=="luce"){const s=S.bills.filter(b=>b.casa===c&&b.tipo==="gas");let w=0,t=0;for(const b of s){const ms=monthsIn(b.dal,b.al);for(const[,mm]of ms){const per=(b.consumo||0)/ms.length;t+=per;if(mm>=10||mm<=2)w+=per}}if(t&&s.length>=4&&w/t>0.5)ins.push(`${casaIds().length>1?CASA_N[c]+": c":"C"}irca il ${Math.round(w/t*100)}% del gas si consuma fra novembre e marzo: è il riscaldamento a fare la bolletta.`)}}
  if(rt!=="gas"){const lb=S.bills.filter(b=>cs.includes(b.casa)&&b.tipo==="luce"&&b.f1!=null&&!b.stima);if(lb.length){const f=lb.reduce((a,b)=>[a[0]+(b.f1||0),a[1]+(b.f2||0),a[2]+(b.f3||0)],[0,0,0]);const t=f[0]+f[1]+f[2];if(t)ins.push(`Luce per fasce: F1 ${Math.round(f[0]/t*100)}%, F2 ${Math.round(f[1]/t*100)}%, F3 ${Math.round(f[2]/t*100)}%. Se consumi soprattutto la sera e nel weekend (F2 e F3), un'offerta bioraria può convenire.`)}}
  for(const c of cs)for(const t of tipos){const m=currentModel(c,t);if(!m)continue;const step=t==="gas"?100:500;ins.push(`${TIPO_N[t]}${dove(c)}: anche senza consumare paghi circa ${EUR0.format(m.F*12)} l'anno; ${N0.format(step)} ${UNIT[t]} in meno valgono circa ${EUR0.format(m.v*step)}.`)}
  if(agg[last]&&!full.includes(last))ins.push(`Il ${last} è ancora parziale: i totali crescono con le prossime bollette.`);
  $("#insights").replaceChildren(...ins.map(t=>el("li",{text:t})));
  const fy=full[full.length-1];$("#con-lead").textContent=fy?`Nel ${fy} ${S.casa==="tutte"&&casaIds().length>1?"le tue case hanno":"hai"} pagato ${EUR0.format(agg[fy].pagato)}${rt!=="tot"?` per ${N0.format(agg[fy].consumo)} ${unit}`:""}. Qui sotto l'andamento dei consumi, del costo unitario e di dove vanno i soldi.`:"";
}
