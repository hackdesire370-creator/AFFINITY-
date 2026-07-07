import { v4 as uuidv4 } from 'uuid';
import supabase from '../db/database.js';
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
      const { data: existing } = await supabase.from('vaults').select('id').eq('passkey', passkey).maybeSingle();
      if (existing) {
        return res.status(409).json({ error: "Passkey already in use. Please choose another one." });
      }
    } else {
      passkey = generatePasskey();
    }

    const id = uuidv4();
    const collab_key = 'C-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error: vaultError } = await supabase.from('vaults').insert({
      id, title: title || 'My Vault', category: category || 'Custom', passkey, theme: theme || 'aurora', status: 'active', created_by: user_id, unlock_date: unlock_date || null, collab_key
    });
    if (vaultError) throw vaultError;

    await supabase.from('vault_participants').insert({
      id: uuidv4(), vault_id: id, user_id, user_name: user_name || 'Anonymous', role: 'creator'
    });

    await supabase.from('vault_activity').insert({
      id: uuidv4(), vault_id: id, user_id, action: 'created_vault'
    });

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

    const { data: vault } = await supabase.from('vaults').select('id, created_by').eq('passkey', passkey).maybeSingle();
    if (!vault) return res.status(404).json({ error: "Vault not found" });

    if (vault.created_by !== user_id) {
        return res.status(403).json({ error: "Only the creator can update vault metadata" });
    }

    await supabase.from('vaults').update({ title, theme, unlock_date }).eq('id', vault.id);

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
    let { data: vault } = await supabase.from('vaults').select('id, passkey, collab_key').eq('passkey', passkey).maybeSingle();
    
    if (!vault) {
      const { data: collabVault } = await supabase.from('vaults').select('id, passkey, collab_key').eq('collab_key', passkey).maybeSingle();
      if (collabVault) {
        vault = collabVault;
        isCollab = true;
      }
    }

    if (!vault) return res.status(401).json({ valid: false, message: "Invalid passkey or collab key" });

    const { data: participant } = await supabase.from('vault_participants').select('role').eq('vault_id', vault.id).eq('user_id', user_id).maybeSingle();
    let role = participant ? participant.role : 'collaborator';

    if (!participant) {
      await supabase.from('vault_participants').insert({
        id: uuidv4(), vault_id: vault.id, user_id, user_name: user_name || 'Anonymous', role: 'collaborator'
      });
      await supabase.from('vault_activity').insert({
        id: uuidv4(), vault_id: vault.id, user_id, action: 'joined_vault'
      });
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
    const { data: vault } = await supabase.from('vaults').select('*').eq('passkey', passkey).maybeSingle();
    if (!vault) return res.status(404).json({ error: "Vault not found" });

    const [
      { data: wishes },
      { data: memories },
      { data: letters },
      { data: soundtracks },
      { data: participants }
    ] = await Promise.all([
      supabase.from('vault_wishes').select('*').eq('vault_id', vault.id).order('created_at', { ascending: true }),
      supabase.from('vault_memories').select('*').eq('vault_id', vault.id).order('created_at', { ascending: true }),
      supabase.from('vault_letters').select('*').eq('vault_id', vault.id).order('created_at', { ascending: true }),
      supabase.from('vault_soundtracks').select('*').eq('vault_id', vault.id).order('created_at', { ascending: true }),
      supabase.from('vault_participants').select('*').eq('vault_id', vault.id)
    ]);

    const userId = req.query.user_id;
    let collabKey = null;
    if (userId && vault.created_by === userId) {
      if (!vault.collab_key) {
        collabKey = 'C-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await supabase.from('vaults').update({ collab_key: collabKey }).eq('id', vault.id);
      } else {
        collabKey = vault.collab_key;
      }
    }

    res.status(200).json({
      vault,
      wishes: wishes || [],
      memories: memories || [],
      letters: letters || [],
      soundtracks: soundtracks || [],
      participants: participants || [],
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

    const { data: participant } = await supabase.from('vault_participants').select('role').eq('vault_id', vaultId).eq('user_id', user_id).maybeSingle();
    if (!participant) return res.status(403).json({ error: "Not a participant of this vault" });

    const id = uuidv4();
    let action = '';

    if (type === 'wish') {
      await supabase.from('vault_wishes').insert({ id, vault_id: vaultId, user_id, message: data.message });
      action = 'added_wish';
    } else if (type === 'memory') {
      await supabase.from('vault_memories').insert({ id, vault_id: vaultId, user_id, type: data.type, title: data.title, file_url: data.file_url });
      action = 'added_memory';
    } else if (type === 'letter') {
      await supabase.from('vault_letters').insert({ id, vault_id: vaultId, user_id, title: data.title, content: data.content });
      action = 'added_letter';
    } else if (type === 'soundtrack') {
      await supabase.from('vault_soundtracks').insert({ id, vault_id: vaultId, user_id, title: data.title, file_url: data.file_url, duration: data.duration || 0 });
      action = 'added_song';
    }

    await supabase.from('vault_activity').insert({ id: uuidv4(), vault_id: vaultId, user_id, action });

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

export const getVoiceNotes = async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { data: voiceNotes } = await supabase.from('vault_voice_notes').select('*').eq('vault_id', vaultId).order('created_at', { ascending: false });
    res.status(200).json({ voiceNotes: voiceNotes || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch voice notes" });
  }
};

export const addVoiceNote = async (req, res) => {
  try {
    const { vaultId } = req.params;
    const { userId, title, fileUrl, duration } = req.body;
    const id = uuidv4(); 

    await supabase.from('vault_voice_notes').insert({
      id, vault_id: vaultId, user_id: userId, title, file_url: fileUrl, duration
    });
    
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
