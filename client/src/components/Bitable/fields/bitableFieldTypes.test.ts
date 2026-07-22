import { describe, expect, test } from 'vitest';
import {
  fieldTypeUnavailableReason,
  filterFieldTypeGroups,
  isFieldTypeCreatable,
} from './bitableFieldTypes';

describe('Bitable field creation availability', () => {
  test('keeps implemented field types creatable', () => {
    expect(isFieldTypeCreatable('text')).toBe(true);
    expect(isFieldTypeCreatable('single_select')).toBe(true);
    expect(isFieldTypeCreatable('attachment')).toBe(true);
  });

  test('blocks types without strict data semantics', () => {
    for (const type of [
      'user',
      'formula',
      'lookup',
      'relation',
      'created_by',
      'updated_by',
      'created_time',
      'updated_time',
    ] as const) {
      expect(isFieldTypeCreatable(type)).toBe(false);
      expect(fieldTypeUnavailableReason(type)).toContain('暂不能创建');
    }
  });

  test('search still exposes unavailable types with an explicit marker', () => {
    const groups = filterFieldTypeGroups('公式');
    expect(groups).toHaveLength(1);
    expect(groups[0].options).toEqual([
      expect.objectContaining({ type: 'formula', unsupported: true }),
    ]);
  });
});
