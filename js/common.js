// Constantes et utilitaires partagés
export const TYPES=["PC","Portable","Tablette","Imprimante","Vidéoprojecteur","TBI / ENI","Switch / réseau","Borne Wi-Fi","Serveur","Autre"];
export const OS=["Windows 11","Windows 10","Linux","Autre","—"];
export const ETATS={ok:["OK","p-green"],surv:["À surveiller","p-amber"],panne:["En panne","p-red"],hs:["Hors service",""]};
export const TCAT=["Le PC ne démarre pas","Réseau / Internet","Session / mot de passe","Imprimante / copieur","Vidéoprojecteur / TBI","Logiciel","Son / périphérique","Autre"];
export const URG={faible:["Faible",""],normale:["Normale","p-blue"],urgente:["Urgente","p-red"]};
export const TSTAT={ouvert:["Ouvert","p-red"],en_cours:["En cours","p-amber"],resolu:["Résolu","p-green"]};
export const JCAT=["Intervention","Maintenance","Installation","Réseau","Kwartz","Pulse / image","Câblage","Achat / matériel","Autre"];
export const CSTAT={a_faire:["À faire",""],en_cours:["En cours","p-blue"],bloque:["Bloqué","p-red"],termine:["Terminé","p-green"]};
export const PRIO={basse:["Basse",""],normale:["Normale","p-blue"],haute:["Haute","p-red"]};

export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const $=s=>document.querySelector(s);
export const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
export const fmtD=d=>{if(!d)return"";const x=new Date(d.length===10?d+"T12:00:00":d);return isNaN(x)?esc(d):x.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})};
export const fmtDT=d=>{if(!d)return"";const x=new Date(d);return isNaN(x)?"":x.toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})};
export const pill=(map,k)=>{const v=map[k];return v?`<span class="pill ${v[1]}">${v[0]}</span>`:""};
export const opts=(arr,sel,blank)=>(blank!=null?`<option value="">${blank}</option>`:"")+arr.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${v===sel?" selected":""}>${esc(l)}</option>`}).join("");
export const mopts=(map,sel)=>Object.entries(map).map(([k,v])=>`<option value="${k}"${k===sel?" selected":""}>${v[0]}</option>`).join("");
export function toast(m){const t=$("#toast");if(!t)return;t.innerHTML=`<div class="toast">${esc(m)}</div>`;clearTimeout(toast._t);toast._t=setTimeout(()=>t.innerHTML="",2800)}

// Convertit les Timestamp Firestore en chaînes ISO pour un affichage/tri uniforme
export function plain(snap){
  const d=snap.data({serverTimestamps:"estimate"})||{};
  for(const k in d){const v=d[k];if(v&&typeof v.toDate==="function")d[k]=v.toDate().toISOString()}
  return {id:snap.id,...d};
}
