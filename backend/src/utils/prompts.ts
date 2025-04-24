import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(__dirname, '../prompts');

export function loadPrompt(filename: string): string {
  try {
    const filePath = path.join(PROMPTS_DIR, filename);
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    console.error(`Error loading prompt from ${filename}:`, error);
    throw new Error(`Failed to load prompt: ${filename}`);
  }
}

export const systemPrompt = loadPrompt('system.txt'); 