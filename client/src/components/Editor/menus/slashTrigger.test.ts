import { describe, expect, it } from 'vitest';
import { resolveSlashTrigger } from './slashTrigger';

describe('resolveSlashTrigger', () => {
  it('accepts block-start and whitespace-delimited slash commands', () => {
    expect(resolveSlashTrigger('/table')).toEqual({ slashIndex: 0, query: 'table' });
    expect(resolveSlashTrigger('正文 /表格')).toEqual({ slashIndex: 3, query: '表格' });
  });

  it('rejects URLs, paths, words and queries containing whitespace', () => {
    expect(resolveSlashTrigger('https://example.com')).toBeNull();
    expect(resolveSlashTrigger('docs/readme')).toBeNull();
    expect(resolveSlashTrigger('word/query')).toBeNull();
    expect(resolveSlashTrigger('/table now')).toBeNull();
  });
});
