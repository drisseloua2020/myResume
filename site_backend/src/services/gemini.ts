import { GoogleGenAI } from '@google/genai';

export type ResumeMode = 'MODE_A' | 'MODE_B';

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
  return new GoogleGenAI({ apiKey });
}

export function getModelName(): string {
  return process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
}
