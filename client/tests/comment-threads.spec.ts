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

  await panel.locator('.comment-panel__textarea-inner--idle').click();
  await panel.locator('.comment-panel__textarea-editor').fill('quick reply');
  await panel.locator('.comment-panel__textarea-editor').press('Enter');
  await expect(page.locator('.comment-panel__reply-content').filter({ hasText: 'quick reply' })).toBeVisible();
});

test('deletes own comment and closes confirm dialog', async ({ page }) => {
  const comments: any[] = [
    {
      id: 'comment-to-delete',
      document_id: 'comment-threads-e2e',
      block_id: 'block-1',
      thread_id: 'block-1',
      content: '发动反攻',
      author: 'E2E',
      position_from: 0,
      position_to: 5,
      quote: 'www.baidu.com',
      anchor_type: 'text-range',
      created_at: '2026-05-24T08:42:54.580Z',
      updated_at: '2026-05-24T08:42:54.580Z',
      resolved: 0,
      status: 'open',
    },
  ];

  await page.route('**/api/documents/comment-threads-e2e/comments/comment-to-delete', route => {
    if (route.request().method() === 'DELETE') {
      const idx = comments.findIndex(item => item.id === 'comment-to-delete');
      if (idx >= 0) comments.splice(idx, 1);
      return route.fulfill({ json: { code: 0, message: '删除成功' } });
    }
    return route.continue();
  });

  await page.route('**/api/documents/comment-threads-e2e/comments', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: comments } });
    }
    return route.continue();
  });

  await page.route('**/api/documents/comment-threads-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          code: 0,
          data: {
            ...commentDocument,
            content: '<p>before comment anchor</p><p><span data-comment-thread-id="block-1" data-block-id="block-1" data-comment-status="open" class="feishu-comment-highlight">www.baidu.com</span></p><p>after</p>',
          },
        },
      });
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        json: {
          code: 0,
          data: { ...commentDocument, updated_at: new Date().toISOString() },
        },
      });
    }
    return route.continue();
  });

  await page.goto('/doc/comment-threads-e2e');

  await expect(page.locator('.feishu-comment-highlight', { hasText: 'www.baidu.com' })).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: { blockId: 'block-1', threadId: 'block-1' },
    }));
  });

  const panel = page.locator('.comment-panel').first();
  await expect(panel).toBeVisible();
  await expect(panel.locator('.comment-panel__reply-content')).toContainText('发动反攻');

  await panel.locator('.comment-panel__icon-btn[aria-label="更多"]').click();
  await page.locator('.comment-panel-more-dropdown .t-dropdown__item', { hasText: '删除' }).click();

  const dialog = page.locator('.t-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('确定删除这条评论吗');

  await dialog.locator('.t-dialog__cancel').click();
  await expect(dialog).toBeHidden();
  await expect(panel.locator('.comment-panel__reply-content')).toContainText('发动反攻');

  await panel.locator('.comment-panel__icon-btn[aria-label="更多"]').click();
  await page.locator('.comment-panel-more-dropdown .t-dropdown__item', { hasText: '删除' }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('.t-dialog__confirm').click();

  await expect(dialog).toBeHidden({ timeout: 3000 });
  await expect(panel.locator('.comment-panel__reply-content')).toHaveCount(0);
  await expect(page.locator('.feishu-comment-highlight')).toHaveCount(0);
  await expect(page.locator('.comment-sidebar-positioned')).toBeHidden();
});

test('removes orphaned comments when commented document text is deleted', async ({ page }) => {
  const threadId = 'comment-thread-remove-text';
  const comments: any[] = [
    {
      id: 'comment-on-text',
      document_id: 'comment-threads-e2e',
      block_id: threadId,
      thread_id: threadId,
      content: '将被同步删除',
      author: 'E2E',
      position_from: 0,
      position_to: 13,
      quote: 'www.baidu.com',
      anchor_type: 'text-range',
      created_at: '2026-05-24T08:42:54.580Z',
      updated_at: '2026-05-24T08:42:54.580Z',
      resolved: 0,
      status: 'open',
    },
  ];

  const docWithHighlight = {
    ...commentDocument,
    content: '<p>before comment anchor</p><p><span data-comment-thread-id="comment-thread-remove-text" data-block-id="comment-thread-remove-text" data-comment-status="open" class="feishu-comment-highlight">www.baidu.com</span></p><p>after</p>',
  };

  let deletedComment = false;

  await page.route('**/api/documents/comment-threads-e2e/comments/comment-on-text', route => {
    if (route.request().method() === 'DELETE') {
      deletedComment = true;
      comments.splice(0, comments.length);
      return route.fulfill({ json: { code: 0, message: '删除成功' } });
    }
    return route.continue();
  });

  await page.route('**/api/documents/comment-threads-e2e/comments', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: comments } });
    }
    return route.continue();
  });

  await page.route('**/api/documents/comment-threads-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: docWithHighlight } });
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        json: {
          code: 0,
          data: { ...docWithHighlight, updated_at: new Date().toISOString() },
        },
      });
    }
    return route.continue();
  });

  await page.goto('/doc/comment-threads-e2e');
  await expect(page.locator('.feishu-comment-highlight', { hasText: 'www.baidu.com' })).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('feishu-open-comment-sidebar', {
      detail: { blockId: 'comment-thread-remove-text', threadId: 'comment-thread-remove-text' },
    }));
  });
  await expect(page.locator('.comment-panel__reply-content')).toContainText('将被同步删除');

  const highlight = page.locator('.feishu-comment-highlight', { hasText: 'www.baidu.com' }).first();
  await highlight.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');

  await expect(page.locator('.feishu-comment-highlight')).toHaveCount(0, { timeout: 3000 });
  await expect.poll(() => deletedComment, { timeout: 5000 }).toBe(true);
  await expect(page.locator('.comment-panel__reply-content')).toHaveCount(0);
  await expect(page.locator('.comment-sidebar-positioned')).toBeHidden();
});
