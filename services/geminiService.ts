import { GoogleGenAI } from "@google/genai";
import { RESUME_FORGE_SYSTEM_PROMPT } from "../constants";
import { UserInputData, ParsedResponse } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateResumeContent = async (
  input: UserInputData, 
  mode: 'MODE_A' | 'MODE_B'
): Promise<ParsedResponse> => {
  const ai = getClient();
  
  // Construct the prompt based on inputs
  let userPrompt = `
role: "${input.role}"
plan: "${input.plan}"
Template ID: "${input.templateId || 'None (Default)'}"
Preferences: Tone=${input.preferences?.tone}, Region=${input.preferences?.region}, Photo=${input.preferences?.photo ? 'Yes' : 'No'}
`;

  if (input.jobDescription) {
    userPrompt += `Job description: \n${input.jobDescription}\n`;
  }

  // Construct Content Parts
  const parts: any[] = [];

  // Handle Profile Photo (Common to both modes)
  if (input.preferences?.photo && input.profileImageData) {
      parts.push({ text: "User Profile Photo (for context/verification only):" });
      parts.push({
        inlineData: {
          mimeType: input.profileImageData.mimeType,
          data: input.profileImageData.data
        }
      });
  }

  if (mode === 'MODE_A') {
    if (input.fileData) {
      // Handle File Upload (PDF or Image)
      parts.push({
        inlineData: {
          mimeType: input.fileData.mimeType,
          data: input.fileData.data
        }
      });
      userPrompt += `\nThe existing resume is attached as a file above. Please extract all information from it to build the new resume.\n`;
    } else if (input.currentResumeText) {
      // Handle Pasted Text
      userPrompt += `\nExisting resume text: \n${input.currentResumeText}\n`;
    } else {
      throw new Error("For Mode A, you must provide either an uploaded resume file or resume text.");
    }
  } else {
    // Mode B - Create from Scratch with Structured Data
    userPrompt += `\nCREATE FROM SCRATCH DATA:\n`;
    
    userPrompt += `Target Role: ${input.targetRole || 'Not specified'}\n`;

    if (input.experienceItems && input.experienceItems.length > 0) {
      userPrompt += `\nWORK EXPERIENCE:\n`;
      input.experienceItems.forEach(item => {
        userPrompt += `- Role: ${item.role} at ${item.company} (${item.dates}). Details: ${item.description}\n`;
      });
    }

    if (input.educationItems && input.educationItems.length > 0) {
      userPrompt += `\nEDUCATION:\n`;
      input.educationItems.forEach(item => {
        userPrompt += `- ${item.degree} from ${item.school} (${item.dates})\n`;
      });
    }

    if (input.skillItems && input.skillItems.length > 0) {
      userPrompt += `\nSKILLS & OTHER SECTIONS:\n`;
      input.skillItems.forEach(item => {
        userPrompt += `- Category: ${item.category}. Items: ${item.items}\n`;
      });
    }
  }

  // Add the text prompt as the last part
  parts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: parts }
      ],
      config: {
        systemInstruction: RESUME_FORGE_SYSTEM_PROMPT,
        temperature: 0.4, // Lower temperature for more consistent formatting
      }
    });

    const text = response.text || '';
    return parseResponse(text);

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

const parseResponse = (rawText: string): ParsedResponse => {
  const sections: ParsedResponse = { raw: rawText };

  // Helper to extract content between markers
  const extract = (startMarker: string, endMarker: string | null) => {
    const startIndex = rawText.indexOf(startMarker);
    if (startIndex === -1) return undefined;
    
    const contentStart = startIndex + startMarker.length;
    let contentEnd = rawText.length;
    
    if (endMarker) {
      const nextIndex = rawText.indexOf(endMarker, contentStart);
      if (nextIndex !== -1) {
        contentEnd = nextIndex;
      }
    } else {
      // If no end marker, look for the next known marker just in case
      const knownMarkers = [
        'RESUME_JSON:', 'GAP_AND_FIX_LIST:', 'RESUME_ATS:', 'RESUME_HUMAN:', 
        'RESUME_TARGETED:', 'RESUME_WITH_PHOTO:', 'COVER_LETTER_FULL:', 
        'COVER_LETTER_SHORT:', 'COLD_EMAIL:'
      ];
      // Find the earliest occurrence of another marker after contentStart
      let earliestNextMarker = -1;
      for (const marker of knownMarkers) {
        const idx = rawText.indexOf(marker, contentStart);
        if (idx !== -1 && (earliestNextMarker === -1 || idx < earliestNextMarker)) {
          earliestNextMarker = idx;
        }
      }
      if (earliestNextMarker !== -1) contentEnd = earliestNextMarker;
    }

    return rawText.substring(contentStart, contentEnd).trim();
  };

  try {
    const jsonStr = extract('RESUME_JSON:', 'GAP_AND_FIX_LIST:');
    if (jsonStr) {
      // Sanitize JSON string just in case markdown blocks were included
      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
      sections.json = JSON.parse(cleanJson);
    }
  } catch (e) {
    console.warn("Failed to parse Resume JSON", e);
  }

  const gapStr = extract('GAP_AND_FIX_LIST:', 'RESUME_ATS:');
  if (gapStr) {
    sections.gapAndFix = gapStr.split('\n').filter(line => line.trim().length > 0);
  }

  sections.resumeAts = extract('RESUME_ATS:', 'RESUME_HUMAN:');
  sections.resumeHuman = extract('RESUME_HUMAN:', 'RESUME_TARGETED:');
  sections.resumeTargeted = extract('RESUME_TARGETED:', 'RESUME_WITH_PHOTO:');
  sections.resumePhoto = extract('RESUME_WITH_PHOTO:', 'COVER_LETTER_FULL:');
  sections.coverLetterFull = extract('COVER_LETTER_FULL:', 'COVER_LETTER_SHORT:');
  sections.coverLetterShort = extract('COVER_LETTER_SHORT:', 'COLD_EMAIL:');
  sections.coldEmail = extract('COLD_EMAIL:', null);

  return sections;
};