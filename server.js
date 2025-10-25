import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import { exec as execCallback } from "child_process";
import util from "util";

const exec = util.promisify(execCallback);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ cartella temporanea
const upload = multer({ dest: "uploads/" });

// ✅ OpenAI con chiave da variabile di ambiente
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ test iniziale del server
app.get("/", (req, res) => {
  res.json({ messaggio: "✅ Operator24 backend attivo e funzionante!" });
});

// ✅ endpoint principale
app.post("/avvia", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ errore: "Nessun file video ricevuto." });
    }

    const filePath = path.resolve(req.file.path);
    const outputDir = path.resolve("frames");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    // ✅ ridimensionamento con altezza pari (risolve il bug 'height not divisible by 2')
    const reducedPath = path.resolve("uploads", `reduced-${Date.now()}.mp4`);
    await exec(
      `ffmpeg -y -i "${filePath}" -vf "scale=640:trunc(ow/a/2)*2" -c:v libx264 -preset veryfast -crf 28 -an "${reducedPath}"`
    );

    // ✅ estrazione frame principali
    await exec(`ffmpeg -i "${reducedPath}" -vf fps=1 "${outputDir}/frame-%03d.jpg"`);

    // ✅ creazione lista frame
    const frames = fs.readdirSync(outputDir)
      .filter(f => f.endsWith(".jpg"))
      .map(f => path.join(outputDir, f));

    if (frames.length === 0) {
      throw new Error("Nessun frame estratto dal video");
    }

    // ✅ descrizione opzionale utente
    const descrizione = req.body.descrizione || "Analizza il video e spiega le azioni principali passo per passo.";

    // ✅ analisi visiva AI
    const frameAnalyses = [];
    for (let i = 0; i < Math.min(frames.length, 8); i++) {
      const img = fs.readFileSync(frames[i]);
      const b64 = img.toString("base64");

      const prompt = `
Sei un agente di automazione video.
Analizza questa immagine estratta da un video dimostrativo e spiega:
1️⃣ L'azione visibile nella scena
2️⃣ L'obiettivo di quell'azione
3️⃣ Eventuali elementi da replicare (testo, clic, moduli, oggetti, ecc.)
`;

      const gptResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sei un assistente esperto di visione artificiale e automazioni software." },
          { role: "user", content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: `data:image/jpeg;base64,${b64}` }
            ]
          }
        ],
      });

      frameAnalyses.push(gptResponse.choices[0].message.content);
    }

    // ✅ sintesi finale
    const sintesiPrompt = `
Hai analizzato diverse immagini da un video.
Racchiudi i punti chiave in un piano operativo strutturato, con uno stile comprensibile a un agente automatizzato.
Includi i seguenti elementi se possibile:
- Descrizione generale del compito
- Step numerati con le azioni principali
- Condizioni o eccezioni osservate
`;

    const summary = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Riassumi come un assistente che scrive un piano operativo per un software automatizzato." },
        { role: "user", content: frameAnalyses.join("\n\n") },
        { role: "user", content: sintesiPrompt },
      ],
    });

    const risultatoFinale = summary.choices[0].message.content;

    // ✅ risposta al frontend
    res.json({
      messaggio: `Analisi completata con successo per il file ${req.file.originalname}`,
      summary: risultatoFinale,
      plan: [
        { type: "click", target: "#start-button" },
        { type: "input", target: "#user-field", text: "inserisci dati utente" },
        { type: "wait", seconds: 2 },
        { type: "click", target: "#confirm" },
      ]
    });

    // ✅ pulizia file
    fs.unlinkSync(filePath);
    fs.unlinkSync(reducedPath);
    frames.forEach(f => fs.unlinkSync(f));

  } catch (err) {
    console.error("Errore:", err);
    res.status(500).json({ errore: err.message || "Errore durante l'elaborazione del video." });
  }
});

// ✅ avvio server
app.listen(PORT, () => {
  console.log(`🚀 Operator24 server attivo sulla porta ${PORT}`);
});
