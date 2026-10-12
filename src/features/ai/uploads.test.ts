import { describe, expect, it } from 'vitest';
import {
  AI_ACCEPT,
  AI_MAX_FILE_BYTES,
  AI_UPLOAD_BUCKET,
  isAiMimeType,
  ownUploadMimeType,
  uploadPath,
} from '@/features/ai/uploads';

const USER = '3f1c2a4e-9b7d-4c1e-8f2a-1234567890ab';
const OTHER_USER = '9d8c7b6a-5f4e-4d3c-8b2a-0987654321fe';
const FILE = '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d';

describe('uploadPath', () => {
  it('should put the file into the folder of the user with the extension of its type', () => {
    expect(uploadPath(USER, FILE, 'image/jpeg')).toBe(`${USER}/${FILE}.jpg`);
    expect(uploadPath(USER, FILE, 'application/pdf')).toBe(`${USER}/${FILE}.pdf`);
    expect(uploadPath(USER, FILE, 'image/png')).toBe(`${USER}/${FILE}.png`);
    expect(uploadPath(USER, FILE, 'image/webp')).toBe(`${USER}/${FILE}.webp`);
    expect(uploadPath(USER, FILE, 'image/heic')).toBe(`${USER}/${FILE}.heic`);
    expect(uploadPath(USER, FILE, 'image/heif')).toBe(`${USER}/${FILE}.heif`);
  });
});

describe('isAiMimeType', () => {
  it('should return true for supported mime types', () => {
    expect(isAiMimeType('application/pdf')).toBe(true);
    expect(isAiMimeType('image/jpeg')).toBe(true);
    expect(isAiMimeType('image/png')).toBe(true);
    expect(isAiMimeType('image/webp')).toBe(true);
    expect(isAiMimeType('image/heic')).toBe(true);
    expect(isAiMimeType('image/heif')).toBe(true);
  });

  it('should return false for unsupported mime types', () => {
    expect(isAiMimeType('image/gif')).toBe(false);
    expect(isAiMimeType('text/plain')).toBe(false);
    expect(isAiMimeType('application/json')).toBe(false);
    expect(isAiMimeType('')).toBe(false);
  });
});

describe('ownUploadMimeType', () => {
  it('should return the file type when the path is an upload of this user', () => {
    expect(ownUploadMimeType(`${USER}/${FILE}.png`, USER)).toBe('image/png');
    expect(ownUploadMimeType(`${USER}/${FILE}.heic`, USER)).toBe('image/heic');
    expect(ownUploadMimeType(`${USER}/${FILE}.heif`, USER)).toBe('image/heif');
    expect(ownUploadMimeType(`${USER}/${FILE}.webp`, USER)).toBe('image/webp');
    expect(ownUploadMimeType(`${USER}/${FILE}.pdf`, USER)).toBe('application/pdf');
    expect(ownUploadMimeType(`${USER}/${FILE}.jpg`, USER)).toBe('image/jpeg');
    expect(ownUploadMimeType(`${USER}/${FILE}.jpeg`, USER)).toBe('image/jpeg');
  });

  it('should return null when the file is in the folder of another user', () => {
    expect(ownUploadMimeType(`${OTHER_USER}/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}-suffix/${FILE}.png`, USER)).toBeNull();
  });

  it('should return null when the path tries to leave the folder with forward slashes', () => {
    expect(ownUploadMimeType(`${USER}/../${OTHER_USER}/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.png/../x.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`../${USER}/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`../../${USER}/${FILE}.png`, USER)).toBeNull();
  });

  it('should return null when the path uses backslashes or mixed slashes', () => {
    expect(ownUploadMimeType(`${USER}\\${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}\\..\\${OTHER_USER}\\${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/..\\${OTHER_USER}/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`..\\${USER}\\${FILE}.png`, USER)).toBeNull();
  });

  it('should return null on double slashes or url-encoded traversal attempts', () => {
    expect(ownUploadMimeType(`//${USER}/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}//${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/%2e%2e/${FILE}.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/..%2f${FILE}.png`, USER)).toBeNull();
  });

  it('should return null when the file id is not a valid uuid', () => {
    expect(ownUploadMimeType(`${USER}/photo.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/not-a-uuid.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/12345.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/0a1b2c3z-4e5f-4a6b-9c7d-8e9f0a1b2c3d.png`, USER)).toBeNull();
  });

  it('should return null when the extension is not a type the bucket accepts', () => {
    expect(ownUploadMimeType(`${USER}/${FILE}.exe`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.sh`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.png.exe`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.exe.png`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/${FILE}.PNG`, USER)).toBeNull();
  });

  it('should return null for empty or malformed paths', () => {
    expect(ownUploadMimeType('', USER)).toBeNull();
    expect(ownUploadMimeType('   ', USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}`, USER)).toBeNull();
    expect(ownUploadMimeType(`${USER}/`, USER)).toBeNull();
    expect(ownUploadMimeType(`/${FILE}.png`, USER)).toBeNull();
  });
});

describe('upload constants', () => {
  it('should expose the bucket name and size limits matching storage sql policies', () => {
    const bytesPerMebibyte = 1024 * 1024;
    const expectedBytes = 20 * bytesPerMebibyte;
    expect(AI_UPLOAD_BUCKET).toBe('ai-uploads');
    expect(AI_MAX_FILE_BYTES).toBe(expectedBytes);
    expect(AI_ACCEPT).toContain('application/pdf');
    expect(AI_ACCEPT).toContain('image/png');
  });
});
