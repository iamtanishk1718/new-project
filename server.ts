import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/apiApp.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// Health check for Cloud Run / container probes
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes + JSON 404 fallback
app.use('/api', apiRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve static frontend build
const distPath = path.join(__dirname, 'dist');
const indexHtmlPath = path.join(distPath, 'index.html');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  if (!fs.existsSync(indexHtmlPath)) {
    res.status(503).send('Application bundle is building or unavailable. Run npm run build.');
    return;
  }
  res.sendFile(indexHtmlPath);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Flame in Firefall server running on port ${port}`);
});
