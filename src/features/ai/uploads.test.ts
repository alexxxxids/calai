import { describe, expect, it } from 'vitest';
import { ownUploadMimeType, uploadPath } from '@/features/ai/uploads';

const USER = '3f1c2a4e-9b7d-4c1e-8f2a-1234567890ab';
const OTHER_USER = '9d8c7b6a-5f4e-4d3c-8b2a-0987654321fe';
const FILE = '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d';

describe('uploadPath', () => {
  it('should put the file into the folder of the user with the extension of its type', () => {
    expect(uploadPath(USER, FILE, 'image/jpeg')).toBe(`${USER}/${FILE}.jpg`);
    expect(uploadPath(USER, FILE, 'application/pdf')).toBe(`${USER}/${FILE}.pdf`);
  });
});

describe('ownUploadMimeType', () => {
  it('should return the file type when the path is an upload of this user', () => {
    expect(ownUploadMimeType(`${USER}/${FILE}.png`, USER)).toBe('image/png');
    expect(ownUploadMimeType(`${USER}/${FILE}.heic`, USER)).toBe('image/heic');
  });

  it('should return null when the file is in the folder of another user', () => {
    expect(ownUploadMimeType(`${OTHER_USER}/${FILE}.png`, USER)).toBeNull();
  });

  it('should return null when the path tries to leave the folder', () => {
    expect(ownUploadMimeType(`${USER}/../${OTHER_USER}/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.png/../x.png`, USER)).toBeNull();
  });

  it('should return null when the extension is not a type the bucket accepts', () => {
    expect(ownUploadMimeType(`${USER}/${FILE}.exe`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}`, USER)).toBeNull();
  });
});
