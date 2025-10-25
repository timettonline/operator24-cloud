import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Rotta di test base
app.get("/", (req, res) => {
  res.json({ message: "✅ Operator24 backend attivo e funzionante!" });
});

// Rotta principale per l’analisi video
app.post("/avvia", upload.single("video"), async (req, res) => {
  try {
    const file = req.file;
    const descrizione = req.body.descrizione;

    if (!file) {
      return res.status(400).json({ messaggio: "❌ Nessun file ricevuto." });
    }

    // Simula analisi o invia a OpenAI
    console.log("🎥 File ricevuto:", file.originalname);
    console.log("🧠 Descrizione:", descrizione);

    res.json({
      messaggio: `Analisi completata con successo per il file ${file.originalname}`,
      stato: "ok"
    });
  } catch (error) {
    console.error("Errore backend:", error);
    res.status(500).json({ messaggio: "Errore interno al server." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server Operator24 attivo su porta ${PORT}`);
});
