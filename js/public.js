// Page publique de signalement
import { db, configured } from "/js/firebase.js";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { TCAT, URG, TSTAT, esc, $, opts, mopts, pill, fmtDT, toast, plain } from "/js/common.js";

$("#cat").innerHTML=opts(TCAT,"","Choisir…");
$("#urg").innerHTML=mopts(URG,"normale");
if(!configured)$("#done").innerHTML='<div class="banner">Firebase n\'est pas encore configuré (js/firebase.js).</div>';

const KEY="tice-mes-signalements";
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch(e){return[]}};
const save=a=>{try{localStorage.setItem(KEY,JSON.stringify(a.slice(0,30)))}catch(e){}};

async function fetchTicket(id){const s=await getDoc(doc(db,"tickets",id));return s.exists()?plain(s):null}
function ticketHtml(t){return `<div class="li" style="cursor:default"><div class="grow"><div class="t">${esc(t.salle)}${t.poste?` · <span class="mono">${esc(t.poste)}</span>`:""} — ${esc(t.categorie)}</div><div class="tiny">${esc(t.description)}</div>${t.reponse?`<div style="margin-top:6px;padding:7px 10px;background:var(--accent-soft);border-radius:7px;font-size:13px"><b>Réponse TICE :</b> ${esc(t.reponse)}</div>`:""}<div class="tiny" style="margin-top:3px">Envoyé le ${fmtDT(t.createdAt)}</div></div>${pill(TSTAT,t.statut)}</div>`}

async function renderMine(){
  const ids=load();if(!ids.length)return;$("#minebox").style.display="";
  const res=await Promise.all(ids.map(id=>fetchTicket(id).catch(()=>null)));
  const ok=res.filter(Boolean);save(ok.map(t=>t.id));
  $("#mine").innerHTML=ok.length?ok.map(ticketHtml).join(""):'<div class="muted">Aucun.</div>';
}

$("#f").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));
  if(d.website)return; // piège à robots
  const b=f.querySelector("[type=submit]");b.disabled=true;
  try{
    const ref=await addDoc(collection(db,"tickets"),{nom:d.nom.trim(),salle:d.salle.trim(),poste:d.poste.trim(),categorie:d.categorie,urgence:d.urgence,description:d.description.trim(),statut:"ouvert",reponse:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    save([ref.id,...load()]);
    $("#done").innerHTML=`<div class="ok"><b>Merci, c'est envoyé !</b><br>Ton code de suivi : <span class="code">${esc(ref.id)}</span><br><span class="tiny">Il est aussi gardé sur cet appareil, plus bas.</span></div>`;
    f.reset();$("#urg").value="normale";window.scrollTo({top:0,behavior:"smooth"});renderMine();
  }catch(err){console.error(err);toast("L'envoi a échoué. Vérifie les champs et réessaie.")}
  b.disabled=false;
});
$("#track").addEventListener("submit",async e=>{
  e.preventDefault();const code=new FormData(e.target).get("code").trim();
  if(!/^[A-Za-z0-9]{10,40}$/.test(code)){$("#trackres").innerHTML='<div class="muted">Code invalide.</div>';return}
  try{const t=await fetchTicket(code);$("#trackres").innerHTML=t?`<div class="list">${ticketHtml(t)}</div>`:'<div class="muted">Aucun signalement avec ce code.</div>'}
  catch(err){$("#trackres").innerHTML='<div class="muted">Impossible de vérifier pour le moment.</div>'}
});
const q=new URLSearchParams(location.search).get("suivi");if(q){document.querySelector('#track [name=code]').value=q;$("#track").requestSubmit()}
renderMine();
