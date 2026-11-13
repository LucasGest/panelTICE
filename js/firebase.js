// Initialisation Firebase — partagée par la page publique et le panel admin.
// La configuration vient de js/firebase-config.js, généré à partir du fichier .env
// (en local : `node scripts/gen-config.mjs` ; sur Vercel : automatique au build).
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { firebaseConfig } from "/js/firebase-config.js";

export const configured = !!(firebaseConfig && firebaseConfig.apiKey);
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
