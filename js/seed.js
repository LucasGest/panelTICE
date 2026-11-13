// Données de départ, proposées une seule fois quand la base est vide.
export const SEED={
  chantiers:{
    "migration-ad-w11":{titre:"Migration Active Directory + Windows 11",statut:"en_cours",priorite:"haute",echeance:"",interlocuteur:"Iris Technology",description:"Passage du parc à l'AD puis à Windows 11 sous Kwartz. Le passage des postes à W11 attend la bascule AD. Passer par Iris Technology (prestataire Kwartz).",taches:[{id:"t1",t:"Contacter Iris Technology pour planifier la migration AD",done:false},{id:"t2",t:"Migration AD",done:false},{id:"t3",t:"Passage W11 salle 101",done:false},{id:"t4",t:"Passage W11 salle pupitre",done:false}]},
    "image-pc-modele":{titre:"Préparer l'image du PC modèle (« image », ex perm-p05)",statut:"en_cours",priorite:"haute",echeance:"",interlocuteur:"",description:"PC modèle dont l'image sera envoyée sur les autres postes. Fond d'écran figé (Bloom sombre par défaut de W11), impossible de changer l'arrière-plan ou de déplacer les icônes du bureau.",taches:[{id:"t1",t:"Verrouiller le fond d'écran (Bloom sombre)",done:false},{id:"t2",t:"Bloquer le déplacement des icônes du bureau",done:false},{id:"t3",t:"Capturer l'image (Pulse)",done:false},{id:"t4",t:"Déployer sur les autres postes",done:false}]},
    "cablage-baies":{titre:"Refaire le rangement des câbles des baies de brassage",statut:"a_faire",priorite:"normale",echeance:"",interlocuteur:"Nicolas Bourrel (DSIN)",description:"Feu vert de Nicolas Bourrel (nov. 2026).",taches:[]},
    "pc-110-vo":{titre:"Changer / améliorer les PC des salles 110 et VO",statut:"a_faire",priorite:"normale",echeance:"",interlocuteur:"Nicolas Bourrel (DSIN)",description:"PC achetés sur fonds propres du collège, hors parc du Département. Feu vert de Nicolas Bourrel (nov. 2026).",taches:[{id:"t1",t:"Salle 110",done:false},{id:"t2",t:"Salle VO",done:false}]},
    "filtrage-internet":{titre:"Filtrage internet",statut:"a_faire",priorite:"normale",echeance:"",interlocuteur:"",description:"",taches:[]},
    "reaffectation-eleves":{titre:"Réaffecter les élèves dans les nouvelles classes Kwartz",statut:"a_faire",priorite:"normale",echeance:"",interlocuteur:"",description:"",taches:[]},
    "inventaire-bourrel":{titre:"Récupérer et importer l'ancien inventaire de M. Bourrel",statut:"en_cours",priorite:"normale",echeance:"",interlocuteur:"Nicolas Bourrel (DSIN)",description:"Pièce jointe non reçue : relance envoyée.",taches:[{id:"t1",t:"Recevoir le fichier",done:false},{id:"t2",t:"Importer dans le Parc",done:false}]}
  },
  parc:{
    "image":{nom:"image",salle:"",type:"PC",modele:"Dell OptiPlex 7010",os:"Windows 11",etat:"ok",serie:"",ip:"",notes:"PC modèle (ex perm-p05) : son image sera déployée sur les autres postes."},
    "tice-poste-aed":{nom:"tice-poste-aed",salle:"",type:"PC",modele:"Meerkat",os:"—",etat:"ok",serie:"",ip:"",notes:"Mon poste de travail (ex-poste du prédécesseur)."}
  },
  journal:{
    "2026-11-12-retrait-211":{date:"2026-11-12",categorie:"Intervention",salle:"211",poste:"",description:"Retrait de 2 PC de la salle 211.",duree:null,ticketId:null}
  }
};
