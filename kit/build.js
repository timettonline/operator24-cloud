#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Build degli embed Frigo Control
   - legge  src/*.html   (sorgenti degli embed, con il segnaposto <!--FC-KIT-->)
   - inserisce kit/fc-kit.js con URL/chiave Supabase e impronta della password
   - scrive embed/*.html (i file da incollare su Wix)

   Uso:  node kit/build.js [--url https://xxx.supabase.co --anon eyJ...] [--out dir]
   Senza chiavi gli embed funzionano in "modalità locale" (anteprima).
   Le chiavi si possono anche mettere in kit/config.json: {"url":"…","anon":"…"}
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PASSWORD = "Frigocontrol1";

function arg(nome) { const i = process.argv.indexOf("--" + nome); return i > 0 ? process.argv[i + 1] : undefined; }
let conf = {};
const fconf = path.join(__dirname, "config.json");
if (fs.existsSync(fconf)) conf = JSON.parse(fs.readFileSync(fconf, "utf8"));
const url = (arg("url") ?? conf.url ?? "").replace(/\/+$/, "");
const anon = arg("anon") ?? conf.anon ?? "";
const out = path.resolve(ROOT, arg("out") ?? "embed");
const src = path.resolve(ROOT, arg("src") ?? "src");

const hash = crypto.createHash("sha256").update(PASSWORD).digest("hex");
let kit = fs.readFileSync(path.join(__dirname, "fc-kit.js"), "utf8")
  .replace("__FC_URL__", url)
  .replace("__FC_ANON__", anon)
  .replace("__FC_HASH__", hash);
if (/<\/script/i.test(kit)) throw new Error("il kit contiene </script>");

fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter(f => f.endsWith(".html")).sort();
let n = 0;
for (const f of files) {
  const h = fs.readFileSync(path.join(src, f), "utf8");
  if (!h.includes("<!--FC-KIT-->")) { console.warn("  ! " + f + ": manca <!--FC-KIT-->, saltato"); continue; }
  const res = h.replace("<!--FC-KIT-->", "<script>\n" + kit + "\n</script>");
  fs.writeFileSync(path.join(out, f), res);
  n++;
  console.log("  ✓ " + f.padEnd(44) + (Buffer.byteLength(res) / 1024).toFixed(0).padStart(5) + " KB");
}
console.log(`\n${n} embed scritti in ${path.relative(ROOT, out) || "."}  ·  database: ${url ? url : "NON collegato (modalità locale)"}`);
