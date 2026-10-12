// Files for the AI (spec FR-90, FR-94, ADR-017). The browser uploads a file straight to the private
// bucket, into the folder named after the user; the server reads it, sends it to Gemini, deletes it.
// The bucket repeats the same limits in SQL (supabase/migrations/…_ai.sql): size and file types.

export const AI_UPLOAD_BUCKET = 'ai-uploads';

const BYTES_PER_KIBIBYTE = 1024;
const KIBIBYTES_PER_MEBIBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KIBIBYTE * KIBIBYTES_PER_MEBIBYTE;
/** 20 MB, like the bucket's file_size_limit. */
export const AI_MAX_FILE_MEGABYTES = 20;
export const AI_MAX_FILE_BYTES = AI_MAX_FILE_MEGABYTES * BYTES_PER_MEGABYTE;

/** File types the bucket accepts, with the extension the file gets in storage. */
export const AI_FILE_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
} as const;

export type AiMimeType = keyof typeof AI_FILE_EXTENSIONS;

/** For <input type="file" accept>: the browser offers only these files. */
export const AI_ACCEPT = Object.keys(AI_FILE_EXTENSIONS).join(',');

export function isAiMimeType(type: string): type is AiMimeType {
  return Object.hasOwn(AI_FILE_EXTENSIONS, type);
}

/** '<user id>/<random uuid>.<ext>': the first folder is the owner, as the storage policies expect. */
export function uploadPath(userId: string, fileId: string, mimeType: AiMimeType): string {
  return `${userId}/${fileId}.${AI_FILE_EXTENSIONS[mimeType]}`;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UPLOAD_PATH = new RegExp(`^(${UUID})/${UUID}\\.([a-z]+)$`);

/**
 * The file type of an upload path, or null when the path is not an upload of this user.
 * The path comes from the browser, so it is checked strictly: exactly '<userId>/<uuid>.<known ext>',
 * with no room for '..' or another user's folder. (Storage policies would refuse another
 * folder anyway; this check gives a clear 400 instead of a confusing "file not found".)
 */
export function ownUploadMimeType(path: string, userId: string): AiMimeType | null {
  const match = UPLOAD_PATH.exec(path);
  if (match === null || match[1] !== userId) {
    return null;
  }
  const extension = match[2];
  const entry = Object.entries(AI_FILE_EXTENSIONS).find(([, ext]) => ext === extension);
  return entry !== undefined && isAiMimeType(entry[0]) ? entry[0] : null;
}
