import { db, auth, configured } from "/js/firebase.js";
import { collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { TYPES, OS, ETATS, TCAT, URG, TSTAT, JCAT, CSTAT, PRIO, esc, $, today, fmtD, fmtDT, pill, opts, mopts, toast, plain } from "/js/common.js";
import { SEED } from "/js/seed.js";

const S={phase:"loading",error:"",user:null,stale:false,
  parc:[],journal:[],tickets:[],chantiers:[],loaded:{},
  f:{parc:{q:"",salle:"",type:"",os:"",etat:""},journal:{q:"",cat:"",salle:""},tickets:{q:"",statut:"actifs"}}};
let unsubs=[];

/* ---------- Accès aux données ---------- */
const ref=(c,id)=>doc(db,c,id);
const slug=s=>String(s).trim().toLowerCase().replace(/[^a-z0-9_\-.~]/g,"-").replace(/^\.+$/,"x").slice(0,150)||("x"+Date.now());
const salles=()=>[...new Set([...S.parc.map(p=>p.salle),...S.tickets.map(t=>t.salle)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr",{numeric:true}));
function errMsg(e){const c=e&&e.code;if(c==="permission-denied")return"Action refusée : ce compte n'est pas administrateur.";if(c==="resource-exhausted")return"Quota Firebase atteint, réessaie plus tard.";if(c==="unavailable")return"Hors ligne : la modification sera envoyée au retour du réseau.";return"Échec de l'enregistrement, réessaie."}
async function write(fn,okMsg){try{await fn();if(okMsg)toast(okMsg);return true}catch(e){console.error(e);toast(errMsg(e));return false}}
// Neutralise les formules (=, +, -, @) venant de saisies publiques : protection contre l'injection CSV dans Excel
const csvCell=v=>{v=String(v??"");if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};
function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function csv(name,rows,cols){download(`${name}-${today()}.csv`,"﻿"+[cols.map(c=>c[1]).join(";"),...rows.map(r=>cols.map(c=>csvCell(r[c[0]])).join(";"))].join("\n"),"text/csv;charset=utf-8");toast(`${rows.length} lignes exportées`)}
function backup(){const data={exportedAt:new Date().toISOString()};for(const k of ["parc","journal","tickets","chantiers"])data[k]=S[k];download(`sauvegarde-panel-tice-${today()}.json`,JSON.stringify(data,null,2),"application/json");toast("Sauvegarde téléchargée")}

/* ---------- Icônes ---------- */
const I={
 tableau:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
 parc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
 journal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h6"/></svg>',
 signalements:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
 chantiers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
};

/* ---------- Routage ---------- */
const VIEWS={tableau:"Tableau de bord",parc:"Parc",journal:"Journal de bord",signalements:"Signalements",chantiers:"Chantiers"};
const view=()=>{const h=location.hash.slice(1);return VIEWS[h]?h:"tableau"};
const go=v=>{if(location.hash.slice(1)===v)render();else location.hash=v};
window.addEventListener("hashchange",render);

/* ---------- Rendu ---------- */
function render(){
  const root=$("#root");
  if(S.phase==="loading"){root.innerHTML='<div style="padding:40px" class="muted">Chargement…</div>';return}
  if(S.phase==="config"){root.innerHTML='<div class="login"><div class="card"><h3>Configuration requise</h3><p class="muted">Renseigne la configuration de ton projet Firebase dans <span class="mono">js/firebase.js</span>, puis redéploie.</p></div></div>';return}
  if(S.phase==="login"||S.phase==="denied"){root.innerHTML=loginView();return}
  const v=view(),open=S.tickets.filter(t=>t.statut!=="resolu").length;
  const nav=Object.entries(VIEWS).map(([k,l])=>`<a class="nav${k===v?" on":""}" href="#${k}">${I[k]}${l}${k==="signalements"&&open?`<span class="badge">${open}</span>`:""}</a>`).join("");
  const body={tableau:dashView,parc:parcView,journal:journalView,signalements:ticketsView,chantiers:chantiersView}[v]();
  root.innerHTML=`<div class="app"><aside><div class="brand"><b>Panel TICE</b><span>Collège Anne Frank · Lambersart</span></div>${nav}
   <div class="sidefoot">Lucas GEST, AED TICE<br><a href="/" target="_blank" style="color:inherit">Page de signalement ↗</a><br><a data-a="backup" style="color:inherit;cursor:pointer">Sauvegarde JSON</a> · <a data-a="logout" style="color:inherit;cursor:pointer">Déconnexion</a></div></aside>
   <main>${S.stale?'<div class="banner">Connexion lente : les données ne sont peut-être pas à jour…</div>':""}${body}</main></div>`;
}
function head(t,sub,actions=""){return `<div class="head"><div><h1>${t}</h1>${sub?`<div class="sub">${sub}</div>`:""}</div><div class="row">${actions}</div></div>`}
function loginView(){return `<div class="login"><div class="pubhead"><div class="logo">TICE</div><div><h1 style="font-size:20px">Panel TICE</h1><div class="sub">Espace réservé au référent</div></div></div>
 <div class="card">${S.phase==="denied"?`<div class="banner">Le compte <b>${esc(S.user?.email)}</b> n'est pas administrateur. Ajoute son UID dans la collection <span class="mono">admins</span> (voir README).<div class="mono tiny" style="margin-top:6px;user-select:all">${esc(S.user?.uid)}</div></div><button class="btn" data-a="logout">Changer de compte</button>`:
 `<form id="login"><div class="f" style="margin-bottom:10px"><label>E-mail</label><input name="email" type="email" required autocomplete="username"></div><div class="f"><label>Mot de passe</label><input name="password" type="password" required autocomplete="current-password"></div><div class="err" id="lerr"></div><div class="mfoot"><button type="button" class="btn sm" data-a="reset">Mot de passe oublié</button><button class="btn primary" type="submit">Se connecter</button></div></form>`}</div></div>`}

/* ----- Tableau de bord ----- */
function prog(c){const t=c.taches||[];const d=t.filter(x=>x.done).length;return{n:t.length,d,pct:t.length?Math.round(d/t.length*100):0}}
function dashView(){
  const pcs=S.parc.filter(p=>p.type==="PC"||p.type==="Portable");
  const w11=pcs.filter(p=>p.os==="Windows 11").length,pct=pcs.length?Math.round(w11/pcs.length*100):0;
  const panne=S.parc.filter(p=>p.etat==="panne"||p.etat==="hs").length;
  const open=S.tickets.filter(t=>t.statut!=="resolu"),urg=open.filter(t=>t.urgence==="urgente").length;
  const act=S.chantiers.filter(c=>c.statut!=="termine");
  const ord={urgente:0,normale:1,faible:2};
  const openSorted=[...open].sort((a,b)=>(ord[a.urgence]??1)-(ord[b.urgence]??1)||String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,6);
  const bySalle={};for(const p of pcs){const s=p.salle||"Sans salle";(bySalle[s]??={n:0,w:0,k:0});bySalle[s].n++;if(p.os==="Windows 11")bySalle[s].w++;if(p.etat==="panne"||p.etat==="hs")bySalle[s].k++}
  const sk=Object.keys(bySalle).sort((a,b)=>a.localeCompare(b,"fr",{numeric:true}));
  const empty=S.loaded.all&&!S.parc.length&&!S.journal.length&&!S.chantiers.length;
  const d=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  return head("Tableau de bord",d.charAt(0).toUpperCase()+d.slice(1),`<button class="btn" data-a="newJournal">+ Journal</button><button class="btn primary" data-a="newTicket">+ Signalement</button>`)+
  (empty?`<div class="card" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>Base vide.</b> <span class="muted">Charger les chantiers en cours, tes 2 postes connus et l'entrée du 12 novembre (salle 211) ?</span></div><button class="btn primary" data-a="seed">Charger les données de départ</button></div>`:"")+
  `<div class="kpis">
    <div class="kpi" data-go="signalements"><div class="l">Signalements ouverts</div><div class="v">${open.length}</div><div class="h">${urg?`<span style="color:var(--red)">${urg} urgent${urg>1?"s":""}</span>`:"aucun urgent"}</div></div>
    <div class="kpi" data-go="parc"><div class="l">Matériel en panne / HS</div><div class="v">${panne}</div><div class="h">sur ${S.parc.length} équipements</div></div>
    <div class="kpi" data-go="parc"><div class="l">Passage Windows 11</div><div class="v">${pct}<span style="font-size:18px">%</span></div><div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div><div class="h" style="margin-top:4px">${w11} / ${pcs.length} postes</div></div>
    <div class="kpi" data-go="chantiers"><div class="l">Chantiers actifs</div><div class="v">${act.length}</div><div class="h">${S.chantiers.filter(c=>c.statut==="bloque").length} bloqué(s)</div></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Signalements à traiter <a data-go="signalements">Tout voir</a></h3>${openSorted.length?`<div class="list">${openSorted.map(t=>`<div class="li" data-a="ticket" data-id="${t.id}"><div class="grow"><div class="t clip">${esc(t.salle)}${t.poste?` · <span class="mono">${esc(t.poste)}</span>`:""} — ${esc(t.categorie)}</div><div class="tiny clip">${esc(t.description)}</div><div class="tiny">${esc(t.nom||"Anonyme")} · ${fmtDT(t.createdAt)}</div></div>${pill(URG,t.urgence)} ${pill(TSTAT,t.statut)}</div>`).join("")}</div>`:`<div class="muted">Rien en attente.</div>`}</div>
    <div class="card"><h3>Chantiers en cours <a data-go="chantiers">Tout voir</a></h3>${act.length?`<div class="list">${act.slice(0,6).map(c=>{const p=prog(c);return `<div class="li" data-a="chantier" data-id="${c.id}"><div class="grow"><div class="row" style="justify-content:space-between"><span class="t clip">${esc(c.titre)}</span>${pill(CSTAT,c.statut)}</div>${p.n?`<div class="bar" style="margin-top:6px"><i style="width:${p.pct}%"></i></div><div class="tiny" style="margin-top:3px">${p.d}/${p.n} étapes${c.echeance?` · échéance ${fmtD(c.echeance)}`:""}</div>`:`<div class="tiny">${c.echeance?`échéance ${fmtD(c.echeance)}`:"pas d'étapes"}</div>`}</div></div>`}).join("")}</div>`:`<div class="muted">Aucun chantier actif.</div>`}</div>
    <div class="card"><h3>Dernières interventions <a data-go="journal">Journal</a></h3>${S.journal.length?`<div class="list">${S.journal.slice(0,6).map(j=>`<div class="li" data-a="journal" data-id="${j.id}"><div class="tiny mono" style="width:78px;flex:none;padding-top:2px">${fmtD(j.date)}</div><div class="grow"><div class="t clip">${esc(j.description)}</div><div class="tiny">${esc(j.categorie)}${j.salle?` · ${esc(j.salle)}`:""}${j.poste?` · ${esc(j.poste)}`:""}</div></div></div>`).join("")}</div>`:`<div class="muted">Le journal est vide.</div>`}</div>
    <div class="card"><h3>Parc par salle <a data-go="parc">Inventaire</a></h3>${sk.length?`<div class="salle-grid">${sk.map(s=>{const b=bySalle[s];return `<div class="sg" data-salle="${esc(s)}"><b>${esc(s)}</b><div class="tiny">${b.n} poste${b.n>1?"s":""} · W11 ${b.w}/${b.n}</div>${b.k?`<div class="tiny" style="color:var(--red)">${b.k} en panne</div>`:""}<div class="bar" style="margin-top:6px"><i style="width:${Math.round(b.w/b.n*100)}%"></i></div></div>`}).join("")}</div>`:`<div class="muted">Aucun poste. Importe ton inventaire depuis l'onglet Parc.</div>`}</div>
  </div>`;
}

/* ----- Parc ----- */
function parcRows(){const f=S.f.parc,q=f.q.toLowerCase();return S.parc.filter(p=>(!f.salle||p.salle===f.salle)&&(!f.type||p.type===f.type)&&(!f.os||p.os===f.os)&&(!f.etat||p.etat===f.etat)&&(!q||[p.nom,p.salle,p.modele,p.notes,p.serie,p.ip].join(" ").toLowerCase().includes(q))).sort((a,b)=>String(a.salle).localeCompare(String(b.salle),"fr",{numeric:true})||String(a.nom).localeCompare(String(b.nom),"fr",{numeric:true}))}
function parcList(){const r=parcRows();if(!S.parc.length)return`<div class="empty">Aucun équipement pour l'instant.<br><br><button class="btn primary" data-a="import">Importer un inventaire</button> <button class="btn" data-a="newParc">Ajouter à la main</button></div>`;
  return `<div class="tiny" style="margin-bottom:6px">${r.length} équipement${r.length>1?"s":""}</div><div class="tblwrap"><table class="tbl"><thead><tr><th>Nom</th><th>Salle</th><th>Type</th><th>Modèle</th><th>OS</th><th>État</th><th>Notes</th></tr></thead><tbody>${r.map(p=>`<tr class="click" data-a="parc" data-id="${p.id}"><td class="mono">${esc(p.nom)}</td><td>${esc(p.salle)}</td><td>${esc(p.type)}</td><td class="muted">${esc(p.modele)}</td><td>${p.os==="Windows 11"?'<span class="pill p-teal">W11</span>':p.os==="Windows 10"?'<span class="pill p-amber">W10</span>':esc(p.os)}</td><td>${pill(ETATS,p.etat)}</td><td class="tiny" style="max-width:260px">${esc(p.notes)}</td></tr>`).join("")}</tbody></table></div>`}
function parcView(){const f=S.f.parc;return head("Parc informatique",`${S.parc.length} équipements recensés`,`<button class="btn" data-a="csvParc">Exporter CSV</button><button class="btn" data-a="import">Importer</button><button class="btn primary" data-a="newParc">+ Équipement</button>`)+
 `<div class="filters" data-fl="parc"><input type="search" name="q" placeholder="Rechercher un poste, modèle, n° de série…" value="${esc(f.q)}"><select name="salle">${opts(salles(),f.salle,"Toutes les salles")}</select><select name="type">${opts(TYPES,f.type,"Tous types")}</select><select name="os">${opts(OS,f.os,"Tous OS")}</select><select name="etat">${opts(Object.entries(ETATS).map(([k,v])=>[k,v[0]]),f.etat,"Tous états")}</select></div><div id="list">${parcList()}</div>`}

/* ----- Journal ----- */
function journalRows(){const f=S.f.journal,q=f.q.toLowerCase();return S.journal.filter(j=>(!f.cat||j.categorie===f.cat)&&(!f.salle||j.salle===f.salle)&&(!q||[j.description,j.poste,j.salle].join(" ").toLowerCase().includes(q)))}
function journalList(){const r=journalRows();if(!S.journal.length)return`<div class="empty">Ton journal de bord numérique est vide.<br><br><button class="btn primary" data-a="newJournal">+ Première entrée</button></div>`;
 let last="",out="";for(const j of r){const m=(j.date||"").slice(0,7);if(m!==last){last=m;const x=new Date((m||"2000-01")+"-15");out+=`<tr><td colspan="5" style="background:var(--bg);font-weight:600;font-size:12.5px;color:var(--ink2)">${isNaN(x)?"Sans date":x.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</td></tr>`}
 out+=`<tr class="click" data-a="journal" data-id="${j.id}"><td class="mono tiny" style="white-space:nowrap">${fmtD(j.date)}</td><td><span class="pill">${esc(j.categorie)}</span></td><td>${esc(j.salle)}${j.poste?`<div class="mono tiny">${esc(j.poste)}</div>`:""}</td><td style="white-space:pre-wrap">${esc(j.description)}</td><td class="tiny">${j.duree?esc(j.duree)+" min":""}</td></tr>`}
 return `<div class="tiny" style="margin-bottom:6px">${r.length} entrée${r.length>1?"s":""}</div><div class="tblwrap"><table class="tbl"><thead><tr><th>Date</th><th>Catégorie</th><th>Lieu</th><th>Description</th><th>Durée</th></tr></thead><tbody>${out}</tbody></table></div>`}
function journalView(){const f=S.f.journal;return head("Journal de bord","Tout ce qui a été fait sur le parc, daté",`<button class="btn" data-a="csvJournal">Exporter CSV</button><button class="btn primary" data-a="newJournal">+ Entrée</button>`)+
 `<div class="filters" data-fl="journal"><input type="search" name="q" placeholder="Rechercher…" value="${esc(f.q)}"><select name="cat">${opts(JCAT,f.cat,"Toutes catégories")}</select><select name="salle">${opts([...new Set(S.journal.map(j=>j.salle).filter(Boolean))].sort(),f.salle,"Tous lieux")}</select></div><div id="list">${journalList()}</div>`}

/* ----- Signalements ----- */
function ticketRows(){const f=S.f.tickets,q=f.q.toLowerCase();return S.tickets.filter(t=>(f.statut==="actifs"?t.statut!=="resolu":!f.statut||t.statut===f.statut)&&(!q||[t.salle,t.poste,t.description,t.categorie,t.nom].join(" ").toLowerCase().includes(q)))}
function ticketList(){const r=ticketRows();if(!r.length)return`<div class="empty">${S.tickets.length?"Aucun signalement avec ces filtres.":`Aucun signalement reçu. Donne aux profs le lien de la <a href="/" target="_blank">page de signalement</a>.`}</div>`;
 return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Reçu</th><th>Lieu</th><th>Problème</th><th>Par</th><th>Urgence</th><th>Statut</th></tr></thead><tbody>${r.map(t=>`<tr class="click" data-a="ticket" data-id="${t.id}"><td class="tiny" style="white-space:nowrap">${fmtDT(t.createdAt)}</td><td>${esc(t.salle)}${t.poste?`<div class="mono tiny">${esc(t.poste)}</div>`:""}</td><td><b style="font-weight:500">${esc(t.categorie)}</b><div class="tiny" style="max-width:380px">${esc(t.description)}</div></td><td class="tiny">${esc(t.nom||"Anonyme")}</td><td>${pill(URG,t.urgence)}</td><td>${pill(TSTAT,t.statut)}</td></tr>`).join("")}</tbody></table></div>`}
function ticketsView(){const f=S.f.tickets;return head("Signalements","Pannes remontées par les enseignants",`<button class="btn" data-a="csvTickets">Exporter CSV</button><button class="btn primary" data-a="newTicket">+ Signalement</button>`)+
 `<div class="filters" data-fl="tickets"><input type="search" name="q" placeholder="Rechercher…" value="${esc(f.q)}"><select name="statut">${opts([["actifs","Ouverts + en cours"],["ouvert","Ouverts"],["en_cours","En cours"],["resolu","Résolus"]],f.statut,"Tous")}</select></div><div id="list">${ticketList()}</div>`}

/* ----- Chantiers ----- */
function chantiersView(){
  const po={haute:0,normale:1,basse:2};
  const cols=Object.entries(CSTAT).map(([k,v])=>{const items=S.chantiers.filter(c=>(c.statut||"a_faire")===k).sort((a,b)=>(po[a.priorite]??1)-(po[b.priorite]??1));
   return `<div class="col" data-col="${k}"><h4>${v[0]}<span>${items.length}</span></h4>${items.map(c=>{const p=prog(c);return `<div class="ch" draggable="true" data-a="chantier" data-id="${c.id}"><div class="t">${esc(c.titre)}</div>${c.description?`<div class="tiny" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(c.description)}</div>`:""}<div class="meta">${pill(PRIO,c.priorite)}${c.echeance?`<span class="pill">${fmtD(c.echeance)}</span>`:""}${c.interlocuteur?`<span class="pill">${esc(c.interlocuteur)}</span>`:""}</div>${p.n?`<div class="bar"><i style="width:${p.pct}%"></i></div><div class="tiny" style="margin-top:3px">${p.d}/${p.n} étapes</div>`:""}</div>`}).join("")}</div>`}).join("");
  return head("Chantiers & tâches","Glisse une carte dans une autre colonne pour changer son statut",`<button class="btn primary" data-a="newChantier">+ Chantier</button>`)+(S.chantiers.length?`<div class="kanban">${cols}</div>`:`<div class="empty">Aucun chantier.<br><br><button class="btn primary" data-a="newChantier">+ Créer un chantier</button></div>`);
}

/* ---------- Fenêtres d'édition ---------- */
function openModal(title,html,onSubmit,{onDelete,wide,extra}={}){
  const m=$("#modal");
  m.innerHTML=`<div class="ov"><form class="modal" style="${wide?"max-width:720px":""}"><h2>${title}</h2>${html}<div class="mfoot"><div>${onDelete?'<button type="button" class="btn danger" data-m="del">Supprimer</button>':""}${extra||""}</div><div class="row"><button type="button" class="btn" data-m="close">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></div></form></div>`;
  const form=m.querySelector("form");
  const close=()=>{m.innerHTML="";document.removeEventListener("keydown",esck);render()};
  const esck=e=>{if(e.key==="Escape")close()};document.addEventListener("keydown",esck);
  m.querySelector(".ov").addEventListener("mousedown",e=>{if(e.target.classList.contains("ov"))close()});
  m.querySelector('[data-m="close"]').onclick=close;
  if(onDelete)m.querySelector('[data-m="del"]').onclick=e=>{const b=e.currentTarget;if(b.dataset.c){onDelete().then(ok=>ok!==false&&close())}else{b.dataset.c=1;b.textContent="Confirmer la suppression ?"}};
  form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;const ok=await onSubmit(Object.fromEntries(new FormData(form)),form);btn.disabled=false;if(ok!==false)close()};
  const first=form.querySelector("input:not([disabled]):not([readonly]),select,textarea");if(first)setTimeout(()=>first.focus(),30);
  return form;
}
const dl=id=>`<datalist id="${id}">${salles().map(s=>`<option value="${esc(s)}">`).join("")}</datalist>`;

function editParc(p={}){
  openModal(p.id?"Modifier l'équipement":"Nouvel équipement",`<div class="fg">
   <div class="f"><label>Nom réseau *</label><input name="nom" required class="mono" value="${esc(p.nom)}" ${p.id?"readonly":""} placeholder="ex. s101-p03"></div>
   <div class="f"><label>Salle</label><input name="salle" list="dl-s" value="${esc(p.salle)}">${dl("dl-s")}</div>
   <div class="f"><label>Type</label><select name="type">${opts(TYPES,p.type||"PC")}</select></div>
   <div class="f"><label>Modèle</label><input name="modele" value="${esc(p.modele)}" placeholder="ex. Dell OptiPlex 7010"></div>
   <div class="f"><label>Système</label><select name="os">${opts(OS,p.os||"Windows 10")}</select></div>
   <div class="f"><label>État</label><select name="etat">${mopts(ETATS,p.etat||"ok")}</select></div>
   <div class="f"><label>N° de série / inventaire</label><input name="serie" value="${esc(p.serie)}"></div>
   <div class="f"><label>Adresse IP / MAC</label><input name="ip" class="mono" value="${esc(p.ip)}"></div>
   <div class="f full"><label>Notes</label><textarea name="notes" style="min-height:60px">${esc(p.notes)}</textarea></div></div>
   ${p.id?`<div class="tiny" style="margin-top:8px">Dernière modif : ${fmtDT(p.updatedAt)}</div>`:""}`,
  async d=>{const nom=d.nom.trim();if(!nom)return false;const id=p.id||slug(nom);if(!p.id&&S.parc.some(x=>x.id===id)){toast("Ce nom existe déjà");return false}
    const data={nom,salle:d.salle.trim(),type:d.type,modele:d.modele.trim(),os:d.os,etat:d.etat,serie:d.serie.trim(),ip:d.ip.trim(),notes:d.notes.trim(),updatedAt:serverTimestamp()};
    return write(()=>setDoc(ref("parc",id),data),p.id?"Équipement mis à jour":"Équipement ajouté")},
  {onDelete:p.id?()=>write(()=>deleteDoc(ref("parc",p.id)),"Supprimé"):null,
   extra:p.id?` <button type="button" class="btn" data-a="logFromParc" data-id="${p.id}">+ Intervention</button>`:""});
}
function editJournal(j={}){
  openModal(j.id?"Modifier l'entrée":"Nouvelle entrée au journal",`<div class="fg">
   <div class="f"><label>Date *</label><input type="date" name="date" required value="${esc(j.date||today())}"></div>
   <div class="f"><label>Catégorie</label><select name="categorie">${opts(JCAT,j.categorie||"Intervention")}</select></div>
   <div class="f"><label>Lieu / salle</label><input name="salle" list="dl-s2" value="${esc(j.salle)}">${dl("dl-s2")}</div>
   <div class="f"><label>Poste(s) concerné(s)</label><input name="poste" class="mono" value="${esc(j.poste)}"></div>
   <div class="f full"><label>Ce qui a été fait *</label><textarea name="description" required>${esc(j.description)}</textarea></div>
   <div class="f"><label>Durée (min)</label><input type="number" min="0" name="duree" value="${esc(j.duree)}"></div></div>`,
  async d=>{const data={date:d.date,categorie:d.categorie,salle:d.salle.trim(),poste:d.poste.trim(),description:d.description.trim(),duree:d.duree?Number(d.duree):null,ticketId:j.ticketId||null};
    if(j.id)return write(()=>updateDoc(ref("journal",j.id),data),"Entrée modifiée");
    return write(()=>addDoc(collection(db,"journal"),{...data,createdAt:serverTimestamp()}),"Ajouté au journal")},
  {onDelete:j.id?()=>write(()=>deleteDoc(ref("journal",j.id)),"Entrée supprimée"):null});
}
function editTicket(t={}){
  openModal(t.id?"Signalement":"Nouveau signalement",`<div class="fg">
   <div class="f"><label>Salle *</label><input name="salle" required list="dl-s3" value="${esc(t.salle)}">${dl("dl-s3")}</div>
   <div class="f"><label>Poste</label><input name="poste" class="mono" value="${esc(t.poste)}"></div>
   <div class="f"><label>Type de problème *</label><select name="categorie" required>${opts(TCAT,t.categorie||TCAT[0])}</select></div>
   <div class="f"><label>Urgence</label><select name="urgence">${mopts(URG,t.urgence||"normale")}</select></div>
   <div class="f full"><label>Description *</label><textarea name="description" required>${esc(t.description)}</textarea></div>
   <div class="f"><label>Statut</label><select name="statut">${mopts(TSTAT,t.statut||"ouvert")}</select></div>
   <div class="f"><label>Signalé par</label><input name="nom" value="${esc(t.nom)}"></div>
   <div class="f full"><label>Réponse visible par l'enseignant (avec son code de suivi)</label><textarea name="reponse" style="min-height:60px" placeholder="ex. Câble réseau remplacé, ça remarche.">${esc(t.reponse)}</textarea></div>
   ${t.id&&t.statut!=="resolu"?`<label class="f full" style="flex-direction:row;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="log" checked style="width:auto"> Consigner dans le journal de bord si je passe en « Résolu »</label>`:""}
  </div>${t.id?`<div class="tiny" style="margin-top:8px">Reçu le ${fmtDT(t.createdAt)}${t.resolvedAt?` · résolu le ${fmtDT(t.resolvedAt)}`:""} · code de suivi <span class="mono" style="user-select:all">${esc(t.id)}</span></div>`:""}`,
  async d=>{const data={salle:d.salle.trim(),poste:d.poste.trim(),categorie:d.categorie,urgence:d.urgence,description:d.description.trim(),statut:d.statut,reponse:d.reponse.trim(),nom:d.nom.trim(),updatedAt:serverTimestamp()};
    const becameResolved=d.statut==="resolu"&&t.statut!=="resolu";
    if(becameResolved)data.resolvedAt=serverTimestamp();
    let ok;
    if(t.id)ok=await write(()=>updateDoc(ref("tickets",t.id),data),"Signalement mis à jour");
    else ok=await write(()=>addDoc(collection(db,"tickets"),{...data,createdAt:serverTimestamp()}),"Signalement créé");
    if(ok&&t.id&&becameResolved&&d.log)await write(()=>addDoc(collection(db,"journal"),{date:today(),categorie:"Intervention",salle:data.salle,poste:data.poste,description:`[Signalement] ${data.categorie} — ${data.description}${data.reponse?"\n→ "+data.reponse:""}`,duree:null,ticketId:t.id,createdAt:serverTimestamp()}),"Résolu et consigné au journal");
    return ok},
  {onDelete:t.id?()=>write(()=>deleteDoc(ref("tickets",t.id)),"Signalement supprimé"):null});
}
function editChantier(c={}){
  let taches=(c.taches||[]).map(x=>({...x}));
  const tl=()=>taches.map((x,i)=>`<div class="task${x.done?" done":""}"><input type="checkbox" data-ti="${i}" ${x.done?"checked":""}><input type="text" data-tt="${i}" value="${esc(x.t)}"><button type="button" class="btn sm" data-tx="${i}" title="Retirer">✕</button></div>`).join("");
  const form=openModal(c.id?"Chantier":"Nouveau chantier",`<div class="fg">
   <div class="f full"><label>Titre *</label><input name="titre" required value="${esc(c.titre)}"></div>
   <div class="f"><label>Statut</label><select name="statut">${mopts(CSTAT,c.statut||"a_faire")}</select></div>
   <div class="f"><label>Priorité</label><select name="priorite">${mopts(PRIO,c.priorite||"normale")}</select></div>
   <div class="f"><label>Échéance</label><input type="date" name="echeance" value="${esc(c.echeance)}"></div>
   <div class="f"><label>Interlocuteur</label><input name="interlocuteur" value="${esc(c.interlocuteur)}" placeholder="ex. Iris Technology, DSIN"></div>
   <div class="f full"><label>Description / notes</label><textarea name="description">${esc(c.description)}</textarea></div>
   <div class="f full"><label>Étapes</label><div id="tl">${tl()}</div><div class="row" style="margin-top:6px"><input id="newtask" placeholder="Ajouter une étape puis Entrée" style="flex:1;border:1px solid var(--line);background:var(--bg);padding:7px 10px;border-radius:8px"><button type="button" class="btn sm" id="addtask">Ajouter</button></div></div></div>`,
  async d=>{const data={titre:d.titre.trim(),statut:d.statut,priorite:d.priorite,echeance:d.echeance,interlocuteur:d.interlocuteur.trim(),description:d.description.trim(),taches:taches.filter(x=>x.t.trim()),updatedAt:serverTimestamp()};
    if(c.id)return write(()=>updateDoc(ref("chantiers",c.id),data),"Chantier enregistré");
    return write(()=>addDoc(collection(db,"chantiers"),{...data,createdAt:serverTimestamp()}),"Chantier créé")},
  {wide:true,onDelete:c.id?()=>write(()=>deleteDoc(ref("chantiers",c.id)),"Chantier supprimé"):null});
  const box=form.querySelector("#tl"),inp=form.querySelector("#newtask");
  const add=()=>{const v=inp.value.trim();if(!v)return;taches.push({id:Math.random().toString(36).slice(2,9),t:v,done:false});inp.value="";box.innerHTML=tl();inp.focus()};
  form.querySelector("#addtask").onclick=add;
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();add()}});
  box.addEventListener("change",e=>{const i=e.target.dataset.ti;if(i!=null){taches[i].done=e.target.checked;box.innerHTML=tl()}});
  box.addEventListener("input",e=>{const i=e.target.dataset.tt;if(i!=null)taches[i].t=e.target.value});
  box.addEventListener("click",e=>{const i=e.target.dataset.tx;if(i!=null){taches.splice(i,1);box.innerHTML=tl()}});
}

/* ---------- Import d'inventaire (CSV / tableur collé ou fichier) ---------- */
function importParc(){
  const form=openModal("Importer un inventaire",`<p class="muted" style="margin-top:-6px">Choisis un fichier <span class="mono">.csv</span> ou colle un tableau (export OCS Inventory, Kwartz, Excel). Séparateur <span class="mono">;</span>, <span class="mono">,</span> ou tabulation. Si la 1<sup>re</sup> ligne contient des en-têtes (nom, salle, type, modele, os, etat, serie, ip, notes), ils sont utilisés ; sinon l'ordre est : <span class="mono">nom;salle;type;modele;os;etat</span>.</p>
   <input type="file" accept=".csv,.txt,text/csv" id="impfile" style="margin-bottom:8px">
   <div class="f full"><textarea name="csv" style="min-height:200px" class="mono" placeholder="nom;salle;type;modele;os&#10;s101-p01;101;PC;Dell OptiPlex 7010;Windows 11"></textarea></div>
   <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px"><input type="checkbox" name="merge" checked> Mettre à jour les équipements déjà connus (même nom) sans effacer leurs notes</label>
   <div id="imp" class="tiny" style="margin-top:8px"></div>`,
  async (d,f)=>{
    const lines=d.csv.split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return false;
    const sep=lines[0].includes("\t")?"\t":lines[0].includes(";")?";":",";
    const split=l=>{const out=[];let cur="",q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch=='"'&&l[i+1]=='"'){cur+='"';i++}else if(ch=='"')q=false;else cur+=ch}else if(ch=='"')q=true;else if(ch===sep){out.push(cur);cur=""}else cur+=ch}out.push(cur);return out.map(s=>s.trim())};
    const norm=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z]/g,"");
    const alias={nom:"nom",name:"nom",hostname:"nom",machine:"nom",poste:"nom",ordinateur:"nom",salle:"salle",lieu:"salle",localisation:"salle",room:"salle",type:"type",modele:"modele",model:"modele",os:"os",osname:"os",systeme:"os",etat:"etat",serie:"serie",serial:"serie",ssn:"serie",numerodeserie:"serie",ip:"ip",ipaddr:"ip",adresseip:"ip",notes:"notes",commentaire:"notes"};
    let cols=["nom","salle","type","modele","os","etat"],rows=lines.map(split);
    const h=rows[0].map(c=>alias[norm(c)]);if(h.filter(Boolean).length>=2&&h.includes("nom")){cols=h;rows=rows.slice(1)}
    const osN=v=>{v=(v||"").toLowerCase();return/11/.test(v)&&/win/.test(v)?"Windows 11":/10/.test(v)&&/win/.test(v)?"Windows 10":/linux|ubuntu|debian/.test(v)?"Linux":v?"Autre":"—"};
    const etN=v=>{v=norm(v||"");return v.startsWith("pan")?"panne":v.startsWith("hs")||v.startsWith("hors")?"hs":v.startsWith("sur")?"surv":"ok"};
    const typN=v=>{if(!v)return"PC";const m=TYPES.find(t=>norm(t).startsWith(norm(v).slice(0,4)));return m||v};
    const items=rows.map(r=>{const o={};cols.forEach((c,i)=>{if(c&&r[i]!=null)o[c]=r[i]});return o}).filter(o=>o.nom);
    const st=f.querySelector("#imp");let n=0;
    try{
      for(let i=0;i<items.length;i+=400){ // lots de 400 (limite Firestore : 500 par lot)
        const batch=writeBatch(db);
        for(const o of items.slice(i,i+400)){const id=slug(o.nom),ex=S.parc.find(p=>p.id===id);if(ex&&!d.merge)continue;
          batch.set(ref("parc",id),{nom:o.nom,salle:o.salle??ex?.salle??"",type:o.type?typN(o.type):ex?.type||"PC",modele:o.modele??ex?.modele??"",os:o.os?osN(o.os):ex?.os||"—",etat:o.etat?etN(o.etat):ex?.etat||"ok",serie:o.serie??ex?.serie??"",ip:o.ip??ex?.ip??"",notes:o.notes??ex?.notes??"",updatedAt:serverTimestamp()});n++}
        await batch.commit();st.textContent=`Import… ${Math.min(i+400,items.length)}/${items.length}`;
      }
    }catch(e){console.error(e);st.textContent=errMsg(e);return false}
    toast(`${n} équipement(s) importé(s)`);return true},{wide:true});
  form.querySelector("#impfile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;const buf=await file.arrayBuffer();let txt=new TextDecoder("utf-8").decode(buf);if(txt.includes("�"))txt=new TextDecoder("windows-1252").decode(buf);form.querySelector('[name=csv]').value=txt.replace(/^﻿/,"")});
}

async function seed(){
  const batch=writeBatch(db);
  for(const [c,docs] of Object.entries(SEED))for(const [id,data] of Object.entries(docs))batch.set(ref(c,id),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await write(()=>batch.commit(),"Données de départ chargées");
}

/* ---------- Glisser-déposer des chantiers (kanban) ---------- */
let dragId=null;
document.addEventListener("dragstart",e=>{const card=e.target.closest&&e.target.closest(".ch[draggable]");if(!card)return;dragId=card.dataset.id;card.classList.add("dragging");e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",dragId)}catch(_){}});
document.addEventListener("dragend",()=>{dragId=null;document.querySelectorAll(".ch.dragging").forEach(x=>x.classList.remove("dragging"));document.querySelectorAll(".col.over").forEach(x=>x.classList.remove("over"))});
document.addEventListener("dragover",e=>{if(!dragId)return;const col=e.target.closest&&e.target.closest(".col[data-col]");if(!col)return;e.preventDefault();e.dataTransfer.dropEffect="move";document.querySelectorAll(".col.over").forEach(x=>x!==col&&x.classList.remove("over"));col.classList.add("over")});
document.addEventListener("dragleave",e=>{const col=e.target.closest&&e.target.closest(".col[data-col]");if(col&&!col.contains(e.relatedTarget))col.classList.remove("over")});
document.addEventListener("drop",async e=>{
  const col=e.target.closest&&e.target.closest(".col[data-col]");if(!col||!dragId)return;e.preventDefault();
  const id=dragId,statut=col.dataset.col,c=S.chantiers.find(x=>x.id===id);dragId=null;
  col.classList.remove("over");if(!c||c.statut===statut)return render();
  const avant=c.statut;c.statut=statut;render(); // affichage immédiat
  const ok=await write(()=>updateDoc(ref("chantiers",id),{statut,updatedAt:serverTimestamp()}),`« ${c.titre} » → ${CSTAT[statut][0]}`);
  if(!ok){c.statut=avant;render()}
});

/* ---------- Événements ---------- */
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g){go(g.dataset.go);return}
  const sg=e.target.closest("[data-salle]");if(sg){S.f.parc={q:"",salle:sg.dataset.salle,type:"",os:"",etat:""};go("parc");return}
  const a=e.target.closest("[data-a]");if(!a)return;
  const id=a.dataset.id,find=arr=>S[arr].find(x=>x.id===id);
  switch(a.dataset.a){
    case"newParc":return editParc();case"parc":return editParc(find("parc"));
    case"newJournal":return editJournal();case"journal":return editJournal(find("journal"));
    case"newTicket":return editTicket();case"ticket":return editTicket(find("tickets"));
    case"newChantier":return editChantier();case"chantier":return editChantier(find("chantiers"));
    case"import":return importParc();case"seed":return seed();case"backup":return backup();
    case"logout":return signOut(auth);
    case"reset":{const em=document.querySelector('#login [name=email]').value.trim();if(!em){$("#lerr").textContent="Saisis d'abord ton e-mail.";return}sendPasswordResetEmail(auth,em).then(()=>$("#lerr").textContent="E-mail de réinitialisation envoyé.").catch(()=>$("#lerr").textContent="Impossible d'envoyer l'e-mail.");return}
    case"logFromParc":{const p=find("parc");$("#modal").innerHTML="";return editJournal({salle:p.salle,poste:p.nom})}
    case"csvParc":return csv("parc",parcRows(),[["nom","nom"],["salle","salle"],["type","type"],["modele","modele"],["os","os"],["etat","etat"],["serie","serie"],["ip","ip"],["notes","notes"]]);
    case"csvJournal":return csv("journal",journalRows(),[["date","date"],["categorie","categorie"],["salle","salle"],["poste","poste"],["description","description"],["duree","duree_min"]]);
    case"csvTickets":return csv("signalements",ticketRows(),[["createdAt","recu_le"],["salle","salle"],["poste","poste"],["categorie","categorie"],["description","description"],["nom","auteur"],["urgence","urgence"],["statut","statut"],["reponse","reponse"],["id","code_suivi"]]);
  }
});
const listFns={parc:parcList,journal:journalList,tickets:ticketList};
document.addEventListener("input",e=>{const fl=e.target.closest("[data-fl]");if(!fl)return;const k=fl.dataset.fl;S.f[k][e.target.name]=e.target.value;const l=$("#list");if(l)l.innerHTML=listFns[k]()});
document.addEventListener("submit",async e=>{
  if(e.target.id!=="login")return;e.preventDefault();
  const d=Object.fromEntries(new FormData(e.target));$("#lerr").textContent="";
  try{await signInWithEmailAndPassword(auth,d.email.trim(),d.password)}catch(err){$("#lerr").textContent="E-mail ou mot de passe incorrect."}
});

/* ---------- Abonnements temps réel ---------- */
let rt=null;
function scheduleRender(){if(rt)return;rt=requestAnimationFrame(()=>{rt=null;
  if($("#modal").innerHTML)return; // ne pas écraser une fenêtre ouverte (rendu à la fermeture)
  const ae=document.activeElement,inFilter=ae&&ae.closest&&ae.closest("[data-fl]");
  if(inFilter){const l=$("#list");if(l){l.innerHTML=listFns[inFilter.dataset.fl]();return}}
  render()})}
function sub(key,q,sortFn){
  const timer=setTimeout(()=>{if(!S.loaded[key]){S.stale=true;scheduleRender()}},10000);
  unsubs.push(onSnapshot(q,{includeMetadataChanges:false},snap=>{
    clearTimeout(timer);S[key]=snap.docs.map(plain);if(sortFn)S[key].sort(sortFn);
    S.loaded[key]=true;S.loaded.all=["parc","journal","tickets","chantiers"].every(k=>S.loaded[k]);S.stale=false;scheduleRender()},
    err=>{clearTimeout(timer);console.error(err);toast(errMsg(err))}));
}
function start(){
  sub("tickets",query(collection(db,"tickets"),orderBy("createdAt","desc"),limit(1000)));
  sub("parc",collection(db,"parc"));
  sub("journal",query(collection(db,"journal"),orderBy("date","desc"),limit(2000)),(x,y)=>String(y.date).localeCompare(String(x.date))||String(y.createdAt).localeCompare(String(x.createdAt)));
  sub("chantiers",collection(db,"chantiers"));
}

if(!configured){S.phase="config";render()}
else onAuthStateChanged(auth,async u=>{
  unsubs.forEach(f=>f());unsubs=[];S.user=u;S.loaded={};
  if(!u){S.phase="login";render();return}
  try{const a=await getDoc(doc(db,"admins",u.uid));S.phase=a.exists()?"app":"denied"}catch(e){S.phase="denied"}
  render();if(S.phase==="app")start();
});
render();
