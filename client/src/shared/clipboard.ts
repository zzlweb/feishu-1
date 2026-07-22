export type ClipboardCommand = 'copy' | 'cut';

export function executeClipboardCommand(command: ClipboardCommand): boolean {
  try {
    return document.execCommand(command);
  } catch {
    return false;
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissions can be denied even when the async clipboard API exists.
      // Fall through to the selection-based browser fallback.
    }
  }

  const activeElement = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  const succeeded = executeClipboardCommand('copy');
  textarea.remove();
  if (activeElement instanceof HTMLElement && activeElement.isConnected) {
    activeElement.focus({ preventScroll: true });
  }
  return succeeded;
}
