import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'warung_db.json');

// Ensure local data directory exists for Termux / local storage
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'Termux / Local Server Warung POS',
    dbFile: DB_FILE,
    timestamp: new Date().toISOString(),
  });
});

// Get Database from local file
app.get('/api/db', (req, res) => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return res.json(JSON.parse(content));
    }
    return res.json(null);
  } catch (err) {
    console.error('Error reading local DB:', err);
    return res.status(500).json({ error: 'Gagal membaca database lokal' });
  }
});

// Sync / Save entire Database to local file
app.post('/api/db/sync', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.products) {
      return res.status(400).json({ error: 'Payload tidak valid' });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    return res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Error writing local DB:', err);
    return res.status(500).json({ error: 'Gagal menyimpan ke database lokal server' });
  }
});

// Start Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`WARUNG POS LOCAL SERVER RUNNING ON PORT ${PORT}`);
    console.log(`Akses: http://localhost:${PORT}`);
    console.log(`Database File: ${DB_FILE}`);
    console.log(`===============================================`);
  });
}

startServer();
