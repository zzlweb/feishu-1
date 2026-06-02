/** Multer/busboy 将 multipart 文件名按 latin1 解码，需转回 UTF-8 */
export function decodeUploadedFilename(name: string): string {
  if (!name) return name;
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}
