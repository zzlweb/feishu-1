import { expect, test } from '@playwright/test';

const duplicateHeadingDocument = {
  id: 'heading-id-uniqueness-e2e',
  title: 'Heading IDs',
  content: '<h1 data-heading-id="heading-duplicate" data-block-id="heading-duplicate">First</h1><h2 data-heading-id="heading-duplicate" data-block-id="heading-duplicate">Second</h2>',
  author: 'E2E',
  created_at: '2026-05-25T00:00:00.000Z',
  updated_at: '2026-05-25T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test('normalizes duplicated heading ids before rendering the catalogue', async ({ page }) => {
  const duplicateKeyWarnings: string[] = [];
  page.on('console', message => {
    const text = message.text();
    if (text.includes('Encountered two children with the same key')) duplicateKeyWarnings.push(text);
  });
  await page.route('**/api/documents/heading-id-uniqueness-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/heading-id-uniqueness-e2e', route =>
    route.fulfill({ json: { code: 0, data: duplicateHeadingDocument } }),
  );

  await page.goto('/doc/heading-id-uniqueness-e2e');
  await expect(page.locator('.catalogue__list-item').filter({ hasText: 'First' })).toBeVisible();
  await expect(page.locator('.catalogue__list-item').filter({ hasText: 'Second' })).toBeVisible();

  const headingIds = await page.locator('.ProseMirror h1, .ProseMirror h2').evaluateAll(headings =>
    headings.map(element => element.getAttribute('data-heading-id')),
  );
  expect(new Set(headingIds).size).toBe(2);
  expect(duplicateKeyWarnings).toEqual([]);
});
