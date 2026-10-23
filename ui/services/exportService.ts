import { exportResumeFormats } from './careerService';

export async function downloadResumeFile(resume: Record<string, any>, title: string, format: 'pdf' | 'docx' | 'txt') {
  const { exports } = await exportResumeFormats({ resumeJson: resume, title, format });
  const mime = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain;charset=utf-8' };
  const bytes = Uint8Array.from(atob(exports[`${format}Base64`]), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime[format] }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'resume'}.${format}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
