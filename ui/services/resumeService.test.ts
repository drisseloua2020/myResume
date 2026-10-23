import { describe, expect, it, vi } from 'vitest';
import { api, getToken } from './apiClient';
import { saveDraft } from './resumeService';
vi.mock('./apiClient', () => ({ api: { post: vi.fn() }, getToken: vi.fn(() => 'session') }));

describe('draft serialization', () => {
  it('serializes writes for a resume across editor remounts', async () => {
    let release: () => void;
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({}); })).mockResolvedValue({});
    const first = saveDraft({ resumeId: 'a', content: { targetRole: 'First' } });
    const second = saveDraft({ resumeId: 'a', content: { targetRole: 'Second' } });
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    release!();
    await Promise.all([first, second]);
    expect(api.post).toHaveBeenLastCalledWith('/resumes/draft', { resumeId: 'a', content: { targetRole: 'Second' } });
  });
  it('does not send an old draft under a different login session', async () => {
    vi.mocked(api.post).mockClear();
    vi.mocked(getToken).mockReturnValueOnce('old-session').mockReturnValue('new-session');
    await expect(saveDraft({ resumeId: 'a', content: { targetRole: 'Private' } })).rejects.toThrow('Session changed');
    expect(api.post).not.toHaveBeenCalled();
  });
});
