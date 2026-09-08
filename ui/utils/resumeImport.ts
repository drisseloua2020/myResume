export type ResumeImportFileData = {
  mimeType: string;
  data: string;
  name?: string;
};

export const IMPORT_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

export const IMPORT_DOCUMENT_ACCEPT = [
  ...Object.keys(IMPORT_DOCUMENT_TYPES),
  ...Object.values(IMPORT_DOCUMENT_TYPES),
].join(',');

export function getImportDocumentMimeType(file: Pick<File, 'type' | 'name'>): string | null {
  if (file.type && IMPORT_DOCUMENT_TYPES[file.type]) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.doc')) return 'application/msword';
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return null;
}

export function readImportDocumentFile(file: File): Promise<ResumeImportFileData> {
  const mimeType = getImportDocumentMimeType(file);
  if (!mimeType) {
    return Promise.reject(new Error('Supported resume formats: PDF, DOC, DOCX.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that resume file. Please try again.'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const data = result.includes(',') ? result.split(',')[1] : result;
      resolve({ mimeType, data, name: file.name });
    };
    reader.readAsDataURL(file);
  });
}
