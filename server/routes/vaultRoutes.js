import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createVault, verifyPasskey, getVaultAccess, addVaultContent, updateVault, generateLetter, getVoiceNotes, addVoiceNote } from '../controllers/vaultController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

// Rate limiting for verify endpoints to prevent brute force
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: "Too many attempts, please try again later" }
});

router.post('/', createVault);
router.post('/verify', verifyLimiter, verifyPasskey);
router.get('/access/:passkey', getVaultAccess);
router.post('/:vaultId/content', addVaultContent);
router.post('/generate-letter', generateLetter);
router.get('/:vaultId/voice-notes', getVoiceNotes);
router.post('/:vaultId/voice-notes', addVoiceNote);

// File upload route
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({ file_url: fileUrl });
});

export default router;
