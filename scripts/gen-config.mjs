// Génère js/firebase-config.js à partir des variables d'environnement.
// Lit aussi le fichier .env à la racine s'il existe (développement local).
// Sur Vercel : définis les variables dans Settings → Environment Variables.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const keys = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID",
};
const config = {};
const missing = [];
for (const [k, env] of Object.entries(keys)) {
  if (process.env[env]) config[k] = process.env[env];
  else missing.push(env);
}
if (missing.length) {
  console.error("Variables manquantes : " + missing.join(", "));
  process.exit(1);
}
writeFileSync(
  "js/firebase-config.js",
  "// Fichier généré par scripts/gen-config.mjs — ne pas modifier ni committer.\n" +
    "export const firebaseConfig = " + JSON.stringify(config, null, 2) + ";\n"
);
console.log("js/firebase-config.js généré pour le projet " + config.projectId);
