import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createVault, verifyPasskey, getVaultAccess, addVaultContent, updateVault, generateLetter, getVoiceNotes, addVoiceNote } from '../controllers/vaultController.js';
import rateLimit from 'express-rate-limit';
import supabase from '../db/database.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, please try again later" }
});

router.post('/', createVault);
router.post('/verify', verifyLimiter, verifyPasskey);
router.get('/access/:passkey', getVaultAccess);
router.post('/:vaultId/content', addVaultContent);
router.post('/generate-letter', generateLetter);
router.get('/:vaultId/voice-notes', getVoiceNotes);
router.post('/:vaultId/voice-notes', addVoiceNote);

// File upload route via Supabase Storage
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const ext = req.file.originalname.split('.').pop();
    const filename = `${uuidv4()}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
      
    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).json({ error: "Failed to upload file to storage" });
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filename);
      
    res.status(200).json({ file_url: publicUrlData.publicUrl });
  } catch (err) {
    console.error("Server upload error:", err);
    res.status(500).json({ error: "Server upload error" });
  }
});

export default router;
