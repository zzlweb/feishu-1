import { expect, test } from '@playwright/test';

const commentDocument = {
  id: 'comment-threads-e2e',
  title: 'Comment Threads E2E',
  content: '<p>before comment anchor</p><p>www.baidu.com</p><p>after</p>',
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  const comments: any[] = [];

  await page.route('**/api/documents/comment-threads-e2e/comments', async route => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const now = new Date().toISOString();
      const comment = {
        id: body.id || `server-${comments.length + 1}`,
        document_id: 'comment-threads-e2e',
        block_id: body.block_id || '',
        thread_id: body.thread_id || body.block_id || body.id,
        parent_id: body.parent_id || '',
        content: body.content,
        author: body.author || 'E2E',
        position_from: body.position_from || 0,
        position_to: body.position_to || 0,
        quote: body.quote || '',
        anchor_type: body.anchor_type || 'block',
        anchor_json: body.anchor_json || '',
        created_at: now,
        updated_at: now,
        resolved: 0,
        status: 'open',
        visibility: 'public',
      };
      comments.push(comment);
      return route.fulfill({ status: 201, json: { code: 0, data: comment } });
    }

    return route.fulfill({ json: { code: 0, data: comments } });
  });

  await page.route('**/api/documents/comment-threads-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: commentDocument } });
    }
    return route.fulfill({ json: { code: 0, data: commentDocument } });
  });
});

test('creates a text-range comment thread and links highlight with sidebar', async ({ page }) => {
  await page.goto('/doc/comment-threads-e2e');
  const anchor = page.locator('.ProseMirror p', { hasText: 'www.baidu.com' }).first();
  await expect(anchor).toBeVisible();

  const box = await anchor.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + Math.min(box!.width - 2, 120), box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.selection-bubble')).toBeVisible();
  await page.locator('.selection-bubble-btn--icon-quiet').last().click();

  const panel = page.locator('.comment-panel').first();
  await expect(panel).toBeVisible();
  await panel.locator('.comment-panel__textarea-editor').fill('text range comment');
  await panel.locator('.comment-panel__textarea-btn-submit').click();

  const highlight = page.locator('.feishu-comment-highlight', { hasText: 'www.baidu.com' }).first();
  await expect(highlight).toBeVisible();
  await expect(page.locator('.comment-panel__reply-content')).toContainText('text range comment');

  await highlight.click();
  await expect(page.locator('.comment-panel--active')).toBeVisible();
});
