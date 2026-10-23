import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadResumeFile } from './exportService';
import { exportResumeFormats } from './careerService';
vi.mock('./careerService', () => ({ exportResumeFormats: vi.fn() }));

describe('resume downloads', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('downloads backend text PDF bytes without a canvas capture', async () => {
    vi.mocked(exportResumeFormats).mockResolvedValue({ exports: { pdfBase64: btoa('%PDF-text') } });
    const create = vi.fn((_blob: Blob) => 'blob:resume');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadResumeFile({ targetRole: 'Engineer' }, 'My Resume', 'pdf');
    expect(exportResumeFormats).toHaveBeenCalledWith({ resumeJson: { targetRole: 'Engineer' }, title: 'My Resume', format: 'pdf' });
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect((create.mock.calls[0][0] as Blob).type).toBe('application/pdf');
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});
