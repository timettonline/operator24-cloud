// Operator24 – Vision + Action Plan (Render-ready)
// Richiede: OPENAI_API_KEY (già impostata su Render) e ffmpeg (apt.txt)

import express from "express";
import cors from "cors";
import multer from "multer";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

// Su Render è meglio usare /tmp come storage temporaneo
const upload = multer({ dest: "/tmp" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utility: exec promesso
const sh = (cmd) => new Promise((res, rej) =>
  exec(cmd, (e, so, se) => e ? rej(se || e) : res(so))
);

// Estrae fino a 8 fotogrammi uniformi (1 ogni 5s) in JPG
async function extractFrames(inputPath, outDir, everySeconds = 5, maxFrames = 8) {
  fs.mkdirSync(outDir, { recursive: true });
  // 1 frame ogni X secondi
  await sh(`ffmpeg -y -i "${inputPath}" -vf "fps=1/${everySeconds}" "${path.join(outDir, "frame-%02d.jpg")}"`);
  const all = fs.readdirSync(outDir).filter(f => f.endsWith(".jpg"))
    .map(f => path.join(outDir, f))
    .slice(0, maxFrames);
  return all;
}

// Health check
app.get("/", (_req, res) => {
  res.json({ messaggio: "✅ Operator24 backend attivo e funzionante!" });
});

// Endpoint principale: riceve il video, estrae frame, chiede a GPT-4o un PIANO
app.post("/avvia", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ messaggio: "❌ Nessun file ricevuto." });

    const descrizione = req.body?.descrizione || "";
    const original = req.file.path;
    const workDir = path.join("/tmp", `op24-${Date.now()}`);
    const small = path.join(workDir, "video-small.mp4");
    const framesDir = path.join(workDir, "frames");

    fs.mkdirSync(workDir, { recursive: true });

    // 1) Riduci il video (più veloce da campionare)
    await sh(`ffmpeg -y -i "${original}" -vf "scale=640:-1" -c:v libx264 -preset veryfast -crf 28 -an "${small}"`);

    // 2) Estrai frame rappresentativi
    const frames = await extractFrames(small, framesDir, 5, 8);
    if (frames.length === 0) {
      throw new Error("Impossibile estrarre fotogrammi dal video.");
    }

    // 3) Prepara messaggio multimodale per GPT-4o
    const images = frames.map(p => {
      const b64 = fs.readFileSync(p).toString("base64");
      return { type: "image_url", image_url: `data:image/jpeg;base64,${b64}` };
    });

    const userPrompt = `
Sei un analista di processi. Guarda i fotogrammi (in ordine) del video caricato dall'utente.
OBIETTIVO UTENTE (se fornito): ${descrizione || "(non specificato)"}

1) Descrivi brevemente cosa sta facendo l'operatore (summary).
2) Genera un PIANO OPERATIVO come array di azioni, con campi standardizzati:
   - type: "navigate" | "click" | "type" | "waitFor" | "press" | "repeat_while" | "screenshot"
   - selector (se noto) oppure "target" testuale (es. "cella A1", "bottone Salva")
   - text/url (se serve)
   - condition (per repeat_while)
3) Inserisci pattern intelligenti (es: repeat_while finché riga non vuota, gestione errori base).
4) Rispondi SOLO in JSON con la forma:
{
  "summary": "...",
  "plan": [ { "type":"...", "target":"...", "selector":"...", "text":"...", "url":"...", "condition":"..." }, ... ]
}
Niente testo fuori dal JSON.
    `.trim();

    // 4) Chiamata a GPT-4o-mini con response_format JSON
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Sei un planner di automazione. Rispondi SOLO con JSON valido." },
        { role: "user", content: [{ type: "text", text: userPrompt }, ...images] }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { summary: "Analisi non strutturata.", plan: [] }; }

    // Pulizia
    try { fs.unlinkSync(original); } catch {}
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}

    // Risposta
    res.json({
      messaggio: "✅ Analisi completata",
      stato: "ok",
      summary: parsed.summary || "",
      plan: Array.isArray(parsed.plan) ? parsed.plan : []
    });

  } catch (err) {
    console.error("Errore /avvia:", err);
    res.status(500).json({ messaggio: "Errore durante l'analisi del video.", dettaglio: String(err).slice(0,300) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Operator24 (Vision+Plan) in esecuzione su porta ${PORT}`);
});
