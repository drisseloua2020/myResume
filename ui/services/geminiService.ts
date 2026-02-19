import { api } from "./apiClient";
import { UserInputData, ParsedResponse } from "../types";

/**
 * Resume generation is performed server-side to avoid exposing API keys in the browser.
 * The backend endpoint returns raw model text, which we parse into sections.
 */
export const generateResumeContent = async (
  input: UserInputData,
  mode: "MODE_A" | "MODE_B"
): Promise<ParsedResponse> => {
  const { text } = await api.post<{ text: string }>("/agent/generate-resume", { input, mode });
  return parseResponse(text);
};

const parseResponse = (rawText: string): ParsedResponse => {
  const sections: ParsedResponse = { raw: rawText };

  const extract = (startMarker: string, endMarker: string | null) => {
    const startIndex = rawText.indexOf(startMarker);
    if (startIndex === -1) return undefined;
    const start = startIndex + startMarker.length;
    const end = endMarker ? rawText.indexOf(endMarker, start) : rawText.length;
    if (end === -1) return rawText.slice(start).trim();
    return rawText.slice(start, end).trim();
  };

  const jsonStr = extract("JSON:", "GAP_AND_FIX_LIST:");
  if (jsonStr) {
    try {
      sections.json = JSON.parse(jsonStr);
    } catch {
      // Keep going even if JSON parsing fails
    }
  }

  const gapStr = extract("GAP_AND_FIX_LIST:", "RESUME_ATS:");
  if (gapStr) {
    sections.gapAndFix = gapStr
      .split("\n")
      .map((l) => l.trim())
      .filter((line) => line.length > 0);
  }

  sections.resumeAts = extract("RESUME_ATS:", "RESUME_HUMAN:");
  sections.resumeHuman = extract("RESUME_HUMAN:", "RESUME_TARGETED:");
  sections.resumeTargeted = extract("RESUME_TARGETED:", "RESUME_WITH_PHOTO:");
  sections.resumePhoto = extract("RESUME_WITH_PHOTO:", "COVER_LETTER_FULL:");
  sections.coverLetterFull = extract("COVER_LETTER_FULL:", "COVER_LETTER_SHORT:");
  sections.coverLetterShort = extract("COVER_LETTER_SHORT:", "COLD_EMAIL:");
  sections.coldEmail = extract("COLD_EMAIL:", null);

  return sections;
};
