import { expect, test } from '@playwright/test';

test('persists browser edits through Express and restores them after reload', async ({ page, request }) => {
  const createdResponse = await request.post('/api/documents', {
    data: {
      title: 'Full-stack persistence',
      content: '<p>Initial persisted content</p>',
      author: 'Full-stack test',
    },
  });
  expect(createdResponse.ok()).toBeTruthy();
  const createdPayload = await createdResponse.json();
  const documentId = createdPayload.data.id as string;

  await page.goto(`/doc/${documentId}`);
  const paragraph = page.locator('.ProseMirror p').first();
  await expect(paragraph).toHaveText('Initial persisted content');

  const updateResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/documents/${documentId}`)
      && response.request().method() === 'PUT'
      && response.ok(),
  );
  await paragraph.fill('Saved through the real browser and server');
  await updateResponse;

  const storedResponse = await request.get(`/api/documents/${documentId}`);
  expect(storedResponse.ok()).toBeTruthy();
  const storedPayload = await storedResponse.json();
  expect(storedPayload.data.content).toContain('Saved through the real browser and server');

  await page.reload();
  await expect(page.locator('.ProseMirror p').first()).toHaveText('Saved through the real browser and server');
});