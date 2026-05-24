const mediaUploadFiles = new Map<string, File>();

export function registerMediaUploadFile(uploadId: string, file: File) {
  if (!uploadId) return;
  mediaUploadFiles.set(uploadId, file);
}

export function getMediaUploadFile(uploadId: string): File | undefined {
  if (!uploadId) return undefined;
  return mediaUploadFiles.get(uploadId);
}

export function unregisterMediaUploadFile(uploadId: string) {
  if (!uploadId) return;
  mediaUploadFiles.delete(uploadId);
}
