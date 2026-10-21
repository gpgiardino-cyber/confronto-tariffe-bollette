<script>
(function(){
"use strict";
// ---------- utils ----------
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const el=(tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(v==null||v===false)continue;if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else if(k==="html")e.innerHTML=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(c))}return e};
const EUR=new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"});
const EUR0=new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const N0=new Intl.NumberFormat("it-IT",{maximumFractionDigits:0});
const N1=new Intl.NumberFormat("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1});
const N2=new Intl.NumberFormat("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const N3=new Intl.NumberFormat("it-IT",{minimumFractionDigits:3,maximumFractionDigits:3});
const MESI=["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const MESI_L=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const UNIT={gas:"Smc",luce:"kWh"};
// houses are the visitor's own (collection "case", field nome); a default one exists until they add more
const CASA_N={};const CASA0="casa1";
const TIPO_N={gas:"Gas",luce:"Luce"};
const pd=s=>{if(!s||typeof s!=="string")return null;const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?{y:+m[1],m:+m[2]-1,d:+m[3]}:null};
const fmtD=s=>{const p=pd(s);return p?`${String(p.d).padStart(2,"0")}/${String(p.m+1).padStart(2,"0")}/${p.y}`:"—"};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY=iso(new Date());
const daysBetween=(a,b)=>{const p=pd(a),q=pd(b);return Math.round((Date.UTC(q.y,q.m,q.d)-Date.UTC(p.y,p.m,p.d))/864e5)};
const num=v=>{if(v===""||v==null)return null;if(typeof v==="number")return isFinite(v)?v:null;let s=String(v).trim().replace(/[€\s]/g,"");if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");else s=s.replace(",",".");const n=parseFloat(s);return isFinite(n)?n:null};
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
const periodo=(dal,al)=>{const a=pd(dal),b=pd(al);if(!a||!b)return"";if(a.y===b.y&&a.m===b.m)return`${MESI[a.m]} ${a.y}`;if(a.y===b.y)return`${MESI[a.m]}–${MESI[b.m]} ${b.y}`;return`${MESI[a.m]} ${a.y}–${MESI[b.m]} ${b.y}`};
const monthsIn=(dal,al)=>{const a=pd(dal),b=pd(al);if(!a||!b)return[];const out=[];let y=a.y,m=a.m;while(y<b.y||(y===b.y&&m<=b.m)){out.push([y,m]);m++;if(m>11){m=0;y++}if(out.length>36)break}return out};
const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const safeLS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let toastT;function toast(msg){$$(".toast").forEach(t=>t.remove());const t=el("div",{class:"toast",role:"status",text:msg});document.body.append(t);clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),2800)}
const ICON={gas:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c-4 0-6.5-2.8-6.5-6.2 0-3.6 3-5.4 3.6-9.3 2.6 1.6 3.6 4 3.3 6.2 1.6-.9 2.3-2.6 2.1-4.3 3.2 2.3 4.5 5.4 4 8.1C17.9 19.6 15.6 22 12 22z"/></svg>',luce:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2 5 13.5h5.5L9 22l9-12h-5.6L14.8 2z"/></svg>'};
const SV=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const NAV_ICON={
  pan:SV('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  bol:SV('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>'),
  con:SV('<path d="M3 20h18"/><path d="M6 16v-5M11 16V6M16 16v-8M21 16v-3"/>'),
  off:SV('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  fab:SV('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
  pro:SV('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/>'),
  dat:SV('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
  chi:SV('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
  altro:SV('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>')};
const NAV=[["pan","Panoramica","Come sto andando quest'anno"],["bol","Bollette","Archivio, voci e verifica dei totali"],["con","Consumi e costi","Andamenti, fasce, fissi e variabili"],["off","Offerte","Mi conviene cambiare?"],["chi","Assistente","Domande sui tuoi dati"],["dat","Dati","Aggiungi bollette o consumi, esporta"]];
const NAV_NAME=Object.fromEntries(NAV.map(([k,n])=>[k,n]));

// ---------- state ----------
const S={bills:[],mensili:{},case:{},offerte:{},myOff:{},param:{},
  casa:"tutte",tab:"pan",mt:"gas",rt:"gas",dt:"add",sort:{k:"al",dir:-1},sim:null,
  loaded:false,nodb:false,db:null,sample:null,limits:null,downloads:null,canWrite:true};
const charts={};
{const c=safeLS.get("bic.casa");if(c)S.casa=c;const t=location.hash.replace("#","");if(NAV_NAME[t])S.tab=t;else{const l=safeLS.get("bic.tab");if(l&&NAV_NAME[l])S.tab=l}}
function syncCase(){for(const k of Object.keys(CASA_N))delete CASA_N[k];for(const[id,c]of Object.entries(S.case).sort((a,b)=>(a[1].creata||"").localeCompare(b[1].creata||"")))CASA_N[id]=c.nome||"Casa";
  for(const b of S.bills)if(!CASA_N[b.casa])CASA_N[b.casa]="Casa";if(!Object.keys(CASA_N).length)CASA_N[CASA0]="Casa mia";
  if(S.casa!=="tutte"&&!CASA_N[S.casa])S.casa="tutte";if(Object.keys(CASA_N).length===1)S.casa="tutte"}
const casaIds=()=>Object.keys(CASA_N);
const dove=c=>casaIds().length>1?` (${CASA_N[c]})`:"";
const newCasaId=()=>"casa-"+Date.now().toString(36);

// ---------- domain ----------
const billId=b=>`${b.casa}-${b.tipo}-${String(b.n||"").replace(/[^A-Za-z0-9_\-.~:@+]/g,"-")}`;
function shares(b){if(b.quota1!=null&&b.anno1&&b.anno2&&b.quota1<1)return[{y:+b.anno1,q:+b.quota1},{y:+b.anno2,q:1-b.quota1}];const p=pd(b.al);return p?[{y:p.y,q:1}]:[]}
const paid=b=>b.pagato!=null?b.pagato:r2((b.totale||0)+(b.canone||0)+(b.crediti||0));
const unitCost=b=>{if(!b.consumo||b.consumo<=0)return null;if(b.tipo==="luce"){const e=(b.spesa_energia||0)+(b.altre||0)+(b.accise_iva||0);return e>0?e/b.consumo:(b.totale||0)/b.consumo}return(b.totale||0)/b.consumo};
const materiaOf=b=>b.tipo==="gas"?b.vendita:(b.spesa_energia!=null?(b.spesa_energia||0)-(b.rete_oneri||0):null);
const inCasa=b=>S.casa==="tutte"||b.casa===S.casa;
const casas=()=>S.casa==="tutte"?casaIds():[S.casa];
const casaLabel=()=>casaIds().length===1?CASA_N[casaIds()[0]]:S.casa==="tutte"?"Tutte le case":CASA_N[S.casa];
function verify(b){
  if(b.stima)return{k:"stima",lbl:"stima",cls:"warn",txt:"Riga di stima, non una bolletta: sostituiscila quando arriva quella vera."};
  const has=b.tipo==="gas"?b.vendita!=null:b.spesa_energia!=null;
  if(!has||b.totale==null)return{k:"check",lbl:"da controllare",cls:"warn",txt:"Mancano le voci di spesa: non posso verificare il totale."};
  const parts=b.tipo==="gas"?(b.vendita||0)+(b.rete_oneri||0)+(b.altre||0)+(b.accise_iva||0):(b.spesa_energia||0)+(b.altre||0)+(b.accise_iva||0);
  const diff=r2(parts-b.totale);
  if(Math.abs(diff)<=0.01)return{k:"ok",lbl:"verificata",cls:"ok",parts,diff,txt:`La somma delle voci (${EUR.format(parts)}) è uguale al totale stampato.`};
  return{k:"bad",lbl:"non torna",cls:"bad",parts,diff,txt:`La somma delle voci è ${EUR.format(parts)}, il totale stampato ${EUR.format(b.totale)}: differenza di ${EUR.format(diff)}.`}}
function annual(casa,tipo){const m={};for(const b of S.bills){if(casa&&b.casa!==casa)continue;if(tipo&&b.tipo!==tipo)continue;for(const{y,q}of shares(b)){const r=m[y]||(m[y]={n:0,consumo:0,totale:0,canone:0,crediti:0,pagato:0,stime:0,energia:0});r.n+=q;r.consumo+=(b.consumo||0)*q;r.totale+=(b.totale||0)*q;r.canone+=(b.canone||0)*q;r.crediti+=(b.crediti||0)*q;r.pagato+=paid(b)*q;if(b.stima)r.stime++;
  const en=b.tipo==="luce"?((b.spesa_energia||0)+(b.altre||0)+(b.accise_iva||0)||b.totale||0):(b.totale||0);r.energia+=en*q}}return m}
// monthly consumption: stored history if present, else spread bill consumption evenly over covered months
function monthly(casa,tipo,y){const doc=S.mensili[`${casa}-${tipo}-${y}`];if(doc&&Array.isArray(doc.valori)&&doc.valori.some(v=>v!=null))return{vals:doc.valori.map(v=>v==null?null:+v),est:(doc.stimati||[]).map(Number),src:"bolletta"};
  const vals=Array(12).fill(null);let any=false;for(const b of S.bills){if(b.casa!==casa||b.tipo!==tipo||!b.consumo)continue;const ms=monthsIn(b.dal,b.al);if(!ms.length)continue;const per=b.consumo/ms.length;for(const[yy,mm]of ms)if(yy===y){vals[mm]=(vals[mm]||0)+per;any=true}}return{vals:any?vals:Array(12).fill(null),est:[],src:"stima"}}
const mval=(casa,tipo,y,m)=>{while(m<0){m+=12;y--}while(m>11){m-=12;y++}const v=monthly(casa,tipo,y).vals[m];return v==null?null:v};
function years(filterFn=()=>true){const s=new Set();for(const b of S.bills)if(filterFn(b))for(const{y}of shares(b))s.add(y);return[...s].sort()}
function seriesColor(casa,tipo){const alt=casaIds().indexOf(casa)%2===1;return tok(tipo==="gas"?(alt?"--gas-2":"--gas"):(alt?"--luce-2":"--luce"))}
const lastBill=(c,t)=>S.bills.filter(b=>b.casa===c&&b.tipo===t&&!b.stima).sort((a,b)=>(b.al||"").localeCompare(a.al||""))[0];

// ---------- charts ----------
function baseOpts(extra={}){const fg=tok("--muted"),grid=tok("--line");return Object.assign({responsive:true,maintainAspectRatio:false,animation:{duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:450},interaction:{mode:"index",intersect:false},
  plugins:{legend:{display:false},tooltip:{backgroundColor:tok("--fg"),titleColor:tok("--bg"),bodyColor:tok("--bg"),footerColor:tok("--bg"),padding:10,cornerRadius:8,titleFont:{family:"Instrument Sans",weight:"600"},bodyFont:{family:"Instrument Sans"}}},
  scales:{x:{grid:{display:false},ticks:{color:fg,font:{family:"Instrument Sans",size:11}},border:{color:grid}},y:{grid:{color:grid},border:{display:false},ticks:{color:fg,font:{family:"Instrument Sans",size:11}},beginAtZero:true}}},extra)}
const B=baseOpts;
function optsWith({tooltip,x,y,extra}={}){const b=B();return B({...(extra||{}),plugins:{...b.plugins,...((extra||{}).plugins||{}),tooltip:{...b.plugins.tooltip,...(tooltip||{})}},scales:{...b.scales,x:{...b.scales.x,...(x||{})},y:{...b.scales.y,...(y||{}),ticks:{...b.scales.y.ticks,...((y||{}).ticks||{})}}}})}
function draw(id,cfg){if(typeof Chart==="undefined")return;if(charts[id]){charts[id].destroy();delete charts[id]}const c=document.getElementById(id);if(!c)return;charts[id]=new Chart(c,cfg)}
function legend(id,items){const box=document.getElementById(id);if(!box)return;box.replaceChildren(...items.map(([c,t,dash])=>el("span",{},el("i",{style:`background:${dash?"transparent":c};border:2px ${dash?"dashed":"solid"} ${c}`}),t)))}
const alpha=(c,a)=>`color-mix(in srgb, ${c} ${Math.round(a*100)}%, transparent)`;
function hexA(c,a){const m=c.match(/^#([0-9a-f]{6})$/i);if(!m)return c;const n=parseInt(m[1],16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
const chartBox=(id,cls="chart")=>el("div",{class:cls},el("canvas",{id}));
const panel=(title,sub,body,right)=>el("div",{class:"panel"},el("div",{class:"ph"},el("div",{},el("h2",{text:title}),sub?el("span",{class:"sub",text:sub}):null),right||null),...[].concat(body));

// ---------- modal ----------
function closeModal(){$("#modal-root").replaceChildren();document.removeEventListener("keydown",escClose)}
function escClose(e){if(e.key==="Escape")closeModal()}
function modal(content){const ov=el("div",{class:"overlay",onclick:e=>{if(e.target===ov)closeModal()}},el("div",{class:"modal",role:"dialog","aria-modal":"true"},...content));$("#modal-root").replaceChildren(ov);document.addEventListener("keydown",escClose);setTimeout(()=>{const f=ov.querySelector("button,input,select");f&&f.focus()},0)}
const dbErr=e=>e&&e.code==="quota_exceeded"?"Lo spazio del browser per questo sito è pieno: esporta una copia e cancella le bollette che non ti servono.":"Salvataggio non riuscito: riprova tra poco.";
function localDB(){const KEY="bic.dati.v1";let mem={},persist=true;
  try{const raw=localStorage.getItem(KEY);mem=raw?JSON.parse(raw):{};localStorage.setItem(KEY+".t","1");localStorage.removeItem(KEY+".t")}catch(e){persist=false;mem={}}
  const subs={};const snap=col=>{const docs=Object.entries(mem[col]||{}).map(([id,d])=>({id,exists:true,data:()=>d}));return{docs,size:docs.length,empty:!docs.length}};
  const emit=col=>(subs[col]||[]).forEach(fn=>{try{fn(snap(col))}catch(e){console.error(e)}});
  const write=(col,fn)=>{const before=JSON.stringify(mem);fn();if(persist){try{localStorage.setItem(KEY,JSON.stringify(mem))}catch(e){mem=JSON.parse(before);throw{code:"quota_exceeded"}}}emit(col)};
  const split=p=>{const i=p.indexOf("/");return[p.slice(0,i),p.slice(i+1)]};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==="object"&&!Array.isArray(v)&&a[k]&&typeof a[k]==="object"&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  try{window.addEventListener("storage",e=>{if(e.key!==KEY)return;try{mem=e.newValue?JSON.parse(e.newValue):{}}catch(x){return}Object.keys(subs).forEach(emit)})}catch(e){}
  return{persistent:persist,
    doc(path){const[col,id]=split(path);return{
      async get(){const d=(mem[col]||{})[id];return{id,exists:!!d,data:()=>d}},
      async set(d){write(col,()=>{(mem[col]=mem[col]||{})[id]=JSON.parse(JSON.stringify(d))})},
      async update(d){if(!(mem[col]||{})[id])throw{code:"invalid_argument"};write(col,()=>merge(mem[col][id],JSON.parse(JSON.stringify(d))))},
      async delete(){if(!(mem[col]||{})[id])return;write(col,()=>{delete mem[col][id]})}}},
    collection(col){return{onSnapshot(fn){(subs[col]=subs[col]||[]).push(fn);setTimeout(()=>fn(snap(col)),0);return()=>{subs[col]=subs[col].filter(x=>x!==fn)}}}},
    wipe(){const cols=Object.keys(mem);mem={};if(persist){try{localStorage.removeItem(KEY)}catch(e){}}cols.concat(Object.keys(subs)).forEach(emit)},
    count(){return Object.values(mem).reduce((a,o)=>a+Object.keys(o).length,0)}}}
async function dbSet(path,data){if(!S.db)throw{code:"nodb"};return S.db.doc(path).set(data)}
async function dbDel(path){if(!S.db)throw{code:"nodb"};return S.db.doc(path).delete()}
