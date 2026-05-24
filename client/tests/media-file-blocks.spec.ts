import { expect, test } from '@playwright/test';

const mediaDocument = {
  id: 'media-file-blocks-e2e',
  title: 'Media File Blocks E2E',
  content: '<p>before</p><p>after</p>',
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/media-file-blocks-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/media-file-blocks-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: mediaDocument } });
    }
    return route.fulfill({ json: { code: 0, data: mediaDocument } });
  });
});

async function openMediaDoc(page: import('@playwright/test').Page) {
  await page.goto('/doc/media-file-blocks-e2e');
  await expect(page.locator('.editor-content-area')).toBeVisible();
  await expect(page.locator('.tiptap p', { hasText: 'before' })).toBeVisible();
}

async function dropFiles(
  page: import('@playwright/test').Page,
  files: Array<{ name: string; type: string; body: string }>,
) {
  const area = page.locator('.editor-content-area');
  const box = await area.boundingBox();
  expect(box).not.toBeNull();
  await area.evaluate((element, payload) => {
    const data = new DataTransfer();
    payload.files.forEach(file => {
      data.items.add(new File([file.body], file.name, { type: file.type }));
    });
    const x = payload.x;
    const y = payload.y;
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: data }));
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: data }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: data }));
  }, { files, x: box!.x + 260, y: box!.y + 110 });
}

test('drops an image as a preview media block and updates it after upload', async ({ page }) => {
  await page.route('**/api/uploads', route =>
    route.fulfill({
      status: 201,
      json: { code: 0, data: { name: 'photo.png', size: 12, type: 'image/png', url: '/static/uploads/photo.png' } },
    }),
  );
  await openMediaDoc(page);

  await dropFiles(page, [{ name: 'photo.png', type: 'image/png', body: 'fake-image' }]);

  const block = page.locator('[data-local-block="file"][data-upload-id]').first();
  await expect(block).toBeVisible();
  await expect(block).toContainText('photo.png');
  await expect(block.locator('.feishu-media-preview__image')).toBeVisible();
  await expect(block).toHaveAttribute('data-upload-status', 'success');
  await expect(block.locator('.feishu-media-preview__image')).toHaveAttribute('src', /\/static\/uploads\/photo\.png$/);
});

test('drops video and normal files as independent attachment blocks', async ({ page }) => {
  let uploadIndex = 0;
  await page.route('**/api/uploads', route => {
    uploadIndex += 1;
    const isVideo = uploadIndex === 1;
    return route.fulfill({
      status: 201,
      json: {
        code: 0,
        data: {
          name: isVideo ? 'clip.mp4' : 'report.pdf',
          size: isVideo ? 24 : 18,
          type: isVideo ? 'video/mp4' : 'application/pdf',
          url: isVideo ? '/static/uploads/clip.mp4' : '/static/uploads/report.pdf',
        },
      },
    });
  });
  await openMediaDoc(page);

  await dropFiles(page, [
    { name: 'clip.mp4', type: 'video/mp4', body: 'fake-video' },
    { name: 'report.pdf', type: 'application/pdf', body: '%PDF-1.4' },
  ]);

  const blocks = page.locator('[data-local-block="file"][data-upload-id]');
  await expect(blocks).toHaveCount(2);
  await expect(blocks.nth(0)).toContainText('clip.mp4');
  await expect(blocks.nth(0).locator('video')).toBeVisible();
  await expect(blocks.nth(1)).toContainText('report.pdf');
  await expect(blocks.nth(1)).toHaveAttribute('data-upload-status', 'success');
});

test('keeps failed file blocks with a retry action', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/uploads', route => {
    calls += 1;
    if (calls === 1) {
      return route.fulfill({ status: 500, json: { code: -1, message: 'mock failed' } });
    }
    return route.fulfill({
      status: 201,
      json: { code: 0, data: { name: 'archive.zip', size: 42, type: 'application/zip', url: '/static/uploads/archive.zip' } },
    });
  });
  await openMediaDoc(page);

  await dropFiles(page, [{ name: 'archive.zip', type: 'application/zip', body: 'zip' }]);

  const block = page.locator('[data-local-block="file"][data-upload-id]').first();
  await expect(block).toHaveAttribute('data-upload-status', 'failed');
  await expect(block).toContainText('mock failed');
  await block.getByRole('button', { name: '重试' }).click();
  await expect(block).toHaveAttribute('data-upload-status', 'success');
});
