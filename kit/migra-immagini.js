#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Migrazione immagini → Supabase Storage (bucket "media")
   - carica le foto prese dall'ARCHIVIO LOCALE (media/originali, già scaricato),
     quindi funziona anche se il sito provvisorio 10web non è più online
   - carica anche le foto incorporate nel codice (data:image/…;base64)
   - sostituisce gli indirizzi dentro src/*.html
   Rilanciabile: i file già caricati vengono riconosciuti e non duplicati.

   Uso:  node kit/migra-immagini.js --url https://xxx.supabase.co --anon eyJ...
         [--src src] [--prova]   (--prova: non scrive i file, mostra cosa farebbe)
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");
const arg = n => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : undefined; };
const URLSB = (arg("url") || "").replace(/\/+$/, ""), ANON = arg("anon") || "";
const SRC = path.resolve(ROOT, arg("src") || "src"), PROVA = process.argv.includes("--prova");
if (!URLSB || !ANON) { console.error("Servono --url e --anon"); process.exit(1); }

const ARCH = path.join(ROOT, "media/originali");
const indice = JSON.parse(fs.readFileSync(path.join(ARCH, "_indice.json"), "utf8")).filter(x => x.ok);
const daUrl = new Map(indice.map(x => [x.u, x.file]));
const TIPI = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", gif: "image/gif", avif: "image/avif" };
const pubblico = k => URLSB + "/storage/v1/object/public/media/" + k;

async function carica(chiave, buf, tipo) {
  const r = await fetch(URLSB + "/storage/v1/object/media/" + chiave, {
    method: "POST",
    headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": tipo, "x-upsert": "false", "cache-control": "max-age=31536000" },
    body: buf
  });
  if (r.ok) return "caricato";
  const t = await r.text();
  if (r.status === 409 || /duplicate|already exists/i.test(t)) return "già presente";
  throw new Error(r.status + " " + t.slice(0, 160));
}
function chiaveDa(u) {
  const x = new URL(u);
  let p = (x.hostname + decodeURIComponent(x.pathname)).replace(/[^A-Za-z0-9._/-]+/g, "-").replace(/\/+/g, "/");
  if (!/\.(webp|png|jpe?g|svg|gif|avif)$/i.test(p)) p += path.extname(daUrl.get(u) || ".jpg");
  return "sito/" + p;
}

(async () => {
  const files = fs.readdirSync(SRC).filter(f => f.endsWith(".html"));
  const testi = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(SRC, f), "utf8")]));
  const sost = new Map();          // vecchio → nuovo
  let car = 0, gia = 0, err = 0;

  // 1) immagini esterne presenti nell'archivio
  const usate = [...daUrl.keys()].filter(u => files.some(f => testi[f].includes(u)));
  for (const u of usate) {
    const k = chiaveDa(u), file = path.join(ARCH, daUrl.get(u));
    const ext = path.extname(file).slice(1).toLowerCase();
    try {
      const esito = PROVA ? "prova" : await carica(k, fs.readFileSync(file), TIPI[ext] || "application/octet-stream");
      esito === "già presente" ? gia++ : car++;
      sost.set(u, pubblico(k));
    } catch (e) { err++; console.log("  ✗ " + u + " → " + e.message); }
  }

  // 2) foto incorporate nel codice (base64)
  const dati = new Set();
  for (const f of files) for (const m of testi[f].matchAll(/data:image\/(webp|png|jpe?g|gif);base64,[A-Za-z0-9+/=]+/g)) dati.add(m[0]);
  for (const d of dati) {
    const [, ext, b64] = d.match(/^data:image\/(\w+);base64,(.+)$/);
    const buf = Buffer.from(b64, "base64");
    const k = "incorporate/" + crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16) + "." + (ext === "jpeg" ? "jpg" : ext);
    try {
      const esito = PROVA ? "prova" : await carica(k, buf, "image/" + ext);
      esito === "già presente" ? gia++ : car++;
      sost.set(d, pubblico(k));
    } catch (e) { err++; console.log("  ✗ foto incorporata → " + e.message); }
  }

  // 3) sostituzione negli src
  let mod = 0;
  for (const f of files) {
    let t = testi[f], n = 0;
    for (const [a, b] of sost) { const p = t.split(a); if (p.length > 1) { n += p.length - 1; t = p.join(b); } }
    if (n) { mod++; if (!PROVA) fs.writeFileSync(path.join(SRC, f), t); console.log("  ✓ " + f.padEnd(40) + n + " indirizzi aggiornati"); }
  }

  // 4) cosa resta fuori da Supabase
  const resto = new Set();
  for (const f of files) {
    const t = PROVA ? testi[f] : fs.readFileSync(path.join(SRC, f), "utf8");
    for (const m of t.matchAll(/https?:\/\/[^"'\s)<>\\]+\.(?:webp|png|jpe?g|svg|gif)(?:\?[^"'\s)<>\\]*)?/gi))
      if (!m[0].startsWith(URLSB) && !/unsplash|placeholder|xxx|yyy/.test(m[0])) resto.add(m[0]);
  }
  console.log(`\nFoto caricate: ${car} · già presenti: ${gia} · errori: ${err} · file aggiornati: ${mod}${PROVA ? " (PROVA: nessun file scritto)" : ""}`);
  if (resto.size) { console.log("Indirizzi esterni rimasti (non presenti in archivio):"); resto.forEach(u => console.log("  - " + u)); }
  if (err) process.exit(2);
})();
