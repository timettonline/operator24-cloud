import express from "express";
import cors from "cors";
import multer from "multer";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: accetta richieste da Wix e da qualsiasi origine
app.use(cors({ origin: true }));
app.use(express.json());

// Salvataggio su disco temporaneo (Render/Railway usano /tmp)
const upload = multer({ dest: "/tmp" });

// OpenAI (la chiave la metterai come variabile d'ambiente)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utilità
const execAsync = (cmd) =>
  new Promise((resolve, reject) => exec(cmd, (e, so, se) => e ? reject(se || e) : resolve(so)));

app.get("/", (_, res) => res.json({ ok: true, service: "Operator24 API online" }));

// Estrae N fotogrammi jpg dal video
async function extractFrames(inputPath, outDir, count = 3) {
  fs.mkdirSync(outDir, { recursive: true });
  // prende frame uniformemente distribuiti
  const cmd = `ffmpeg -y -i "${inputPath}" -vf "fps=${count}/min(30\\,30)" "${path.join(outDir, "frame-%02d.jpg")}"`;
  await execAsync(cmd);
  const frames = fs.readdirSync(outDir)
    .filter(f => f.endsWith(".jpg"))
    .map(f => path.join(outDir, f));
  return frames.slice(0, count);
}

app.post("/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nessun file ricevuto" });
    const videoPath = req.file.path;
    const workDir = path.join("/tmp", `op24-${Date.now()}`);
    const framesDir = path.join(workDir, "frames");
    fs.mkdirSync(workDir, { recursive: true });

    // 1) Riduce la risoluzione (veloce da processare)
    const smallPath = path.join(workDir, "video-small.mp4");
    await execAsync(`ffmpeg -y -i "${videoPath}" -vf "scale=640:-1" -c:v libx264 -preset veryfast -crf 28 -an "${smallPath}"`);

    // 2) Estrae 3 frame rappresentativi
    const frames = await extractFrames(smallPath, framesDir, 3);
    if (frames.length === 0) throw new Error("Impossibile estrarre fotogrammi");

    // 3) Converte i frame in base64 e prepara il messaggio multimodale
    const images = frames.map(p => {
      const b64 = fs.readFileSync(p).toString("base64");
      return { type: "image_url", image_url: `data:image/jpeg;base64,${b64}` };
    });

    // Prompt
    const userText = `Analizza l'azione mostrata nei fotogrammi (ordine cronologico). 
Fornisci una procedura operativa passo-passo (click, campi, menu, testi letti/scritti), 
evidenzia elementi UI (etichette, bottoni) e l'obiettivo finale. 
Sii tecnico e specifico, utile per automatizzare con un RPA.`;

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Sei un analista di processi. Genera istruzioni chiare, cronologiche e azionabili." },
        { role: "user", content: [{ type: "text", text: userText }, ...images] }
      ]
    });

    const analysis = chat.choices?.[0]?.message?.content || "Nessuna analisi generata.";

    // pulizia
    try { fs.unlinkSync(videoPath); } catch {}
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}

    res.json({ success: true, analysis });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Errore durante l'analisi video" });
  }
});

app.listen(PORT, () => console.log(`✅ Operator24 online on :${PORT}`));
