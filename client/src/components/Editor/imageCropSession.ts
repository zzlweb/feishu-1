export interface ImageCropSession {
  shouldSkipConfirmTarget: (target: EventTarget | null) => boolean;
  confirm: () => Promise<boolean>;
  cancel: () => void;
}

let activeSession: ImageCropSession | null = null;

export function registerImageCropSession(session: ImageCropSession): () => void {
  activeSession = session;
  return () => {
    if (activeSession === session) activeSession = null;
  };
}

export function getActiveImageCropSession(): ImageCropSession | null {
  return activeSession;
}

export async function confirmActiveImageCropSession(): Promise<boolean> {
  if (!activeSession) return false;
  return activeSession.confirm();
}
