import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import vaultRoutes from './routes/vaultRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/vaults', vaultRoutes);

// Serve static frontend files
const distPath = path.join(__dirname, '../dist');
const uploadsPath = path.join(__dirname, '../uploads');
app.use(express.static(distPath));
app.use('/uploads', express.static(uploadsPath));

// Catch-all middleware to serve index.html for any other requests (for client-side routing)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Affinity Backend running on http://localhost:${PORT}`);
});
