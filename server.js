// server.js
// Express server per upload video -> Whisper transcription -> ChatGPT analysis
// Requisiti npm: express, multer, node-fetch, form-data
// Installa con: npm i express multer node-fetch form-data
// Imposta la env var OPENAI_API_KEY in Render / sistema.

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fetch = require('node-fetch'); // require('node-fetch') v3 compat (CommonJS)
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3001;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// helper: check ffmpeg availability
function haveFfmpeg() {
  try {
    const res = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    return res.status === 0 || (res.stdout && res.stdout.toLowerCase().includes('ffmpeg'));
  } catch (e) {
    return false;
  }
}

// helper: extract audio to wav using ffmpeg (returns output path)
function extractAudioToWav(videoPath) {
  const outPath = videoPath + '.wav';
  // -y overwrite, -vn no video, -ac 1 mono, -ar 16000 sample rate (good for speech)
  const args = ['-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-y', outPath];
  const res = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    // return null on fail
    return null;
  }
  if (!fs.existsSync(outPath)) return null;
  return outPath;
}

// call OpenAI Whisper (audio transcription) via REST
async function transcribeWithOpenAI(filePath, openaiKey) {
  const url = 'https://api.openai.com/v1/audio/transcriptions';
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath));
  // whisper-1 is standard; if unavailable you can change
  fd.append('model', 'whisper-1');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`
      // IMPORTANT: do NOT set Content-Type; form-data sets it.
    },
    body: fd
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI transcription failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  return data.text; // Whisper returns { text: "..." }
}

// call ChatGPT (gpt-3.5-turbo) to analyze transcription
async function analyzeTextWithChatGPT(transcription, openaiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const systemPrompt = `You are an expert automation analyst that reads a transcription of a video where a human performs a sequence of GUI/desktop steps. Produce:
1) A concise numbered list of discrete actions the agent should perform to replicate the operation (one action per line).
2) If any step requires waiting, inputs, or variable values, mark them clearly.
3) Return also a short "checks" list (what to verify after each step).
Format the response as JSON with fields: "steps" (array of strings), "checks" (array of strings), "notes" (string).`;
  const userPrompt = `Transcription:\n${transcription}\n\nProvide the JSON described above.`;

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 800
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI chat failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  const reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  return reply;
}

// route
app.post('/avvia', upload.single('video'), async (req, res) => {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ ok: false, messaggio: 'OPENAI_API_KEY mancante nelle env. Impostala su Render/Server.' });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, messaggio: 'Nessun file video ricevuto. Usa campo "video".' });
    }
    const videoPath = req.file.path;

    console.log('File ricevuto:', req.file.originalname, '->', videoPath);

    // try ffmpeg
    let transcription = null;
    const ff = haveFfmpeg();
    console.log('ffmpeg disponibile?', ff);

    if (ff) {
      const wav = extractAudioToWav(videoPath);
      if (wav) {
        console.log('Audio estratto in', wav, ' - inviando a Whisper...');
        transcription = await transcribeWithOpenAI(wav, openaiKey);
        // optional: delete wav after
        try { fs.unlinkSync(wav); } catch (e) {}
      } else {
        console.warn('Fallita estrazione audio con ffmpeg -> proverò a inviare il file video direttamente.');
      }
    }

    // if no transcription yet, try sending the (original) video file directly to Whisper
    if (!transcription) {
      try {
        console.log('Invio file video direttamente a Whisper...');
        transcription = await transcribeWithOpenAI(videoPath, openaiKey);
      } catch (err) {
        console.warn('Trascrizione con file video fallita:', err.message);
        // we continue but inform user
      }
    }

    // if we have transcription, call ChatGPT to analyze
    let analysis = null;
    if (transcription) {
      console.log('Trascrizione ottenuta, invio a ChatGPT per analisi...');
      const chatReply = await analyzeTextWithChatGPT(transcription, openaiKey);
      analysis = chatReply;
    }

    return res.json({
      ok: true,
      messaggio: `Analisi completata${transcription ? '' : ' (trascrizione non disponibile)'} per il file ${req.file.originalname}`,
      trascrizione: transcription || null,
      analisi: analysis || null
    });

  } catch (err) {
    console.error('Errore /avvia:', err);
    return res.status(500).json({ ok: false, messaggio: 'Errore durante l\'analisi: ' + (err.message || String(err)) });
  }
});

// simple homepage
app.get('/', (req, res) => {
  res.send('Operator24 server: endpoint POST /avvia (multipart/form-data campo "video")');
});

app.listen(PORT, () => {
  console.log(`Server Operator24 avviato su porta ${PORT}`);
});
