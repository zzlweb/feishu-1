export interface SlashTriggerMatch {
  slashIndex: number;
  query: string;
}

/** A slash command starts at a text-block boundary or after whitespace, never inside URLs/words. */
export function resolveSlashTrigger(textBeforeCursor: string): SlashTriggerMatch | null {
  const slashIndex = textBeforeCursor.lastIndexOf('/');
  if (slashIndex < 0) return null;
  const beforeSlash = textBeforeCursor[slashIndex - 1] || '';
  if (slashIndex > 0 && !/[\s\u00a0]/.test(beforeSlash)) return null;
  const query = textBeforeCursor.slice(slashIndex + 1);
  if (/[\s/\n\r]/.test(query)) return null;
  return { slashIndex, query };
}
