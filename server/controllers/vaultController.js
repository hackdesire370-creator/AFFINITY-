import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { GoogleGenAI } from '@google/genai';

// Helper to generate AFN-XXXX-XXXX
function generatePasskey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const getGroup = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `AFN-${getGroup()}-${getGroup()}`;
}

export const createVault = async (req, res) => {
  try {
    const { title, category, theme, user_id, user_name, passkey: customPasskey, unlock_date } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id is required" });

    let passkey = customPasskey;
    if (passkey) {
      // Check if passkey already exists
      const existing = db.prepare('SELECT id FROM vaults WHERE passkey = ?').get(passkey);
      if (existing) {
        return res.status(409).json({ error: "Passkey already in use. Please choose another one." });
      }
    } else {
      passkey = generatePasskey();
    }

    const id = uuidv4();
    const collab_key = 'C-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Start transaction
    const insertVault = db.prepare('INSERT INTO vaults (id, title, category, passkey, theme, status, user_id, created_by, unlock_date, collab_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertParticipant = db.prepare('INSERT INTO vault_participants (id, vault_id, user_id, user_name, role) VALUES (?, ?, ?, ?, ?)');
    const insertActivity = db.prepare('INSERT INTO vault_activity (id, vault_id, user_id, action) VALUES (?, ?, ?, ?)');

    db.transaction(() => {
      insertVault.run(id, title || 'My Vault', category || 'Custom', passkey, theme || 'aurora', 'active', user_id, user_id, unlock_date || null, collab_key);
      insertParticipant.run(uuidv4(), id, user_id, user_name || 'Anonymous', 'creator');
      insertActivity.run(uuidv4(), id, user_id, 'created_vault');
    })();

    res.status(201).json({ message: "Vault created successfully", passkey, vaultId: id, collab_key });
  } catch (error) {
    console.error("Error creating vault:", error);
    res.status(500).json({ error: "Failed to create vault" });
  }
};

export const updateVault = async (req, res) => {
  try {
    const passkey = req.params.passkey;
    const { user_id, title, theme, unlock_date } = req.body;
    if (!passkey || !user_id) return res.status(400).json({ error: "passkey and user_id are required" });

    const vault = db.prepare('SELECT id, created_by FROM vaults WHERE passkey = ?').get(passkey);
    if (!vault) return res.status(404).json({ error: "Vault not found" });

    if (vault.created_by !== user_id) {
        return res.status(403).json({ error: "Only the creator can update vault metadata" });
    }

    db.prepare('UPDATE vaults SET title = ?, theme = ?, unlock_date = ? WHERE id = ?').run(title, theme, unlock_date, vault.id);

    res.status(200).json({ message: "Vault updated successfully" });
  } catch (error) {
    console.error("Error updating vault:", error);
    res.status(500).json({ error: "Failed to update vault" });
  }
};

export const verifyPasskey = async (req, res) => {
  try {
    const { passkey, user_id, user_name } = req.body;
    if (!passkey || !user_id) return res.status(400).json({ error: "passkey and user_id are required" });

    let isCollab = false;
    let vault = db.prepare('SELECT id, passkey FROM vaults WHERE passkey = ?').get(passkey);
    
    if (!vault) {
      vault = db.prepare('SELECT id, passkey FROM vaults WHERE collab_key = ?').get(passkey);
      if (vault) isCollab = true;
    }

    if (!vault) return res.status(401).json({ valid: false, message: "Invalid passkey or collab key" });

    const participant = db.prepare('SELECT role FROM vault_participants WHERE vault_id = ? AND user_id = ?').get(vault.id, user_id);
    let role = participant ? participant.role : 'collaborator';

    if (!participant) {
      db.transaction(() => {
        db.prepare('INSERT INTO vault_participants (id, vault_id, user_id, user_name, role) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), vault.id, user_id, user_name || 'Anonymous', 'collaborator');
        db.prepare('INSERT INTO vault_activity (id, vault_id, user_id, action) VALUES (?, ?, ?, ?)').run(uuidv4(), vault.id, user_id, 'joined_vault');
      })();
    }

    res.status(200).json({ valid: true, vaultId: vault.id, role, isCollab, passkey: vault.passkey });
  } catch (error) {
    console.error("Error verifying passkey:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getVaultAccess = async (req, res) => {
  try {
    const { passkey } = req.params;
    const vault = db.prepare('SELECT * FROM vaults WHERE passkey = ?').get(passkey);
    if (!vault) return res.status(404).json({ error: "Vault not found" });

    const wishes = db.prepare('SELECT * FROM vault_wishes WHERE vault_id = ? ORDER BY created_at ASC').all(vault.id);
    const memories = db.prepare('SELECT * FROM vault_memories WHERE vault_id = ? ORDER BY created_at ASC').all(vault.id);
    const letters = db.prepare('SELECT * FROM vault_letters WHERE vault_id = ? ORDER BY created_at ASC').all(vault.id);
    const soundtracks = db.prepare('SELECT * FROM vault_soundtracks WHERE vault_id = ? ORDER BY created_at ASC').all(vault.id);
    const participants = db.prepare('SELECT * FROM vault_participants WHERE vault_id = ?').all(vault.id);

    const userId = req.query.user_id;
    let collabKey = null;
    if (userId && vault.created_by === userId) {
      if (!vault.collab_key) {
        // Auto-generate for legacy vaults
        collabKey = 'C-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
          db.prepare('UPDATE vaults SET collab_key = ? WHERE id = ?').run(collabKey, vault.id);
        } catch (e) {
          console.error("Failed to generate legacy collab key", e);
        }
      } else {
        collabKey = vault.collab_key;
      }
    }

    res.status(200).json({
      vault,
      wishes,
      memories,
      letters,
      soundtracks,
      participants,
      collab_key: collabKey
    });
  } catch (error) {
    console.error("Error getting vault access:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addVaultContent = async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { user_id, type, data } = req.body;
    if (!user_id || !type || !data) return res.status(400).json({ error: "user_id, type, and data are required" });

    const participant = db.prepare('SELECT role FROM vault_participants WHERE vault_id = ? AND user_id = ?').get(vaultId, user_id);
    if (!participant) return res.status(403).json({ error: "Not a participant of this vault" });

    const id = uuidv4();
    let action = '';

    db.transaction(() => {
      if (type === 'wish') {
        db.prepare('INSERT INTO vault_wishes (id, vault_id, user_id, message) VALUES (?, ?, ?, ?)').run(id, vaultId, user_id, data.message);
        action = 'added_wish';
      } else if (type === 'memory') {
        db.prepare('INSERT INTO vault_memories (id, vault_id, user_id, type, title, file_url) VALUES (?, ?, ?, ?, ?, ?)').run(id, vaultId, user_id, data.type, data.title, data.file_url);
        action = 'added_memory';
      } else if (type === 'letter') {
        db.prepare('INSERT INTO vault_letters (id, vault_id, user_id, title, content) VALUES (?, ?, ?, ?, ?)').run(id, vaultId, user_id, data.title, data.content);
        action = 'added_letter';
      } else if (type === 'soundtrack') {
        db.prepare('INSERT INTO vault_soundtracks (id, vault_id, user_id, title, file_url, duration) VALUES (?, ?, ?, ?, ?, ?)').run(id, vaultId, user_id, data.title, data.file_url, data.duration || 0);
        action = 'added_song';
      }
      db.prepare('INSERT INTO vault_activity (id, vault_id, user_id, action) VALUES (?, ?, ?, ?)').run(uuidv4(), vaultId, user_id, action);
    })();

    res.status(201).json({ message: "Content added successfully", id });
  } catch (error) {
    console.error("Error adding content:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const generateLetter = async (req, res) => {
  try {
    const { bulletPoints } = req.body;
    if (!bulletPoints) return res.status(400).json({ error: "Bullet points are required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'replace_this_with_your_actual_key') {
      return res.status(500).json({ error: "Gemini API Key is missing. Please add it to the .env file." });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a warm, heartfelt, and emotional writing assistant.
Write a deeply personal, beautiful letter based on the following bullet points provided by the user. 
The tone should be sincere, cinematic, and touching. Do not include placeholders like [Name] unless absolutely necessary.
Keep the letter around 3-4 paragraphs.

User's input:
${bulletPoints}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.status(200).json({ letter: response.text });
  } catch (error) {
    console.error("Error generating letter:", error);
    res.status(500).json({ error: "Failed to generate letter" });
  }
};

export const getVoiceNotes = (req, res) => {
  try {
    const { vaultId } = req.params;
    const voiceNotes = db.prepare('SELECT * FROM vault_voice_notes WHERE vault_id = ? ORDER BY created_at DESC').all(vaultId);
    res.status(200).json({ voiceNotes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch voice notes" });
  }
};

export const addVoiceNote = (req, res) => {
  try {
    const { vaultId } = req.params;
    const { userId, title, fileUrl, duration } = req.body;
    const id = generatePasskey(); // simple unique id, could use uuid

    const stmt = db.prepare(`
      INSERT INTO vault_voice_notes (id, vault_id, user_id, title, file_url, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, vaultId, userId, title, fileUrl, duration);
    
    res.status(201).json({ 
      id, 
      vault_id: vaultId, 
      user_id: userId, 
      title, 
      file_url: fileUrl, 
      duration 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add voice note" });
  }
};
