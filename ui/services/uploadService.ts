import { api } from './apiClient';

export type UploadedProfilePhoto = {
  url: string;
  filename: string;
  contentType: string;
  size: number;
};

export async function uploadProfilePhoto(file: File): Promise<UploadedProfilePhoto> {
  const body = new FormData();
  body.append('file', file);
  return api.postForm<UploadedProfilePhoto>('/uploads/profile-photo', body);
}
