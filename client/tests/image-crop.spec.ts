import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePng = path.resolve(__dirname, '../../server/public/uploads/d77deaa3-b0b7-4752-b381-3e490bb191ed.png');

const cropDocument = {
  id: 'image-crop-e2e',
  title: 'Image Crop E2E',
  content: `<p>before</p><img class="feishu-image" src="/static/uploads/d77deaa3-b0b7-4752-b381-3e490bb191ed.png" data-align="center"><p>after</p>`,
  author: 'E2E',
  created_at: '2026-05-24T00:00:00.000Z',
  updated_at: '2026-05-24T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/image-crop-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/image-crop-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: cropDocument } });
    }
    return route.fulfill({ json: { code: 0, data: cropDocument } });
  });
  await page.route('**/static/uploads/*', async route => {
    await route.fulfill({ path: samplePng });
  });
});

test('crops image when clicking document blank area', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  let uploadCount = 0;
  await page.route('**/api/uploads', async route => {
    uploadCount += 1;
    const request = route.request();
    const postData = request.postDataBuffer();
    expect(request.method()).toBe('POST');
    await route.fulfill({
      status: 201,
      json: {
        code: 0,
        data: {
          name: 'cropped.png',
          size: postData?.length || 1,
          type: 'image/png',
          url: '/static/uploads/cropped-e2e.png',
        },
      },
    });
  });

  await page.goto('/doc/image-crop-e2e');
  await expect(page.locator('.editor-content-area')).toBeVisible();
  await expect(page.locator('.feishu-image')).toBeVisible();

  const image = page.locator('.feishu-image-block-wrap .feishu-image, .feishu-image').first();
  await image.click();

  const cropBtn = page.locator('.docx-menu-container .panel-menu-item[data-name="Crop"]');
  await expect(cropBtn).toBeVisible();
  await cropBtn.click();

  await expect(page.locator('.feishu-image-crop-layer')).toBeVisible();

  const handle = page.locator('.feishu-image-crop-layer__handle--se');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x - 80, box!.y - 60, { steps: 8 });
  await page.mouse.up();

  await page.locator('.tiptap p', { hasText: 'after' }).click();

  await expect(page.locator('.feishu-image-crop-layer')).toHaveCount(0, { timeout: 10000 });
  expect(uploadCount).toBeGreaterThan(0);
  await expect(page.locator('.feishu-image')).toHaveAttribute('src', /cropped-e2e\.png/);
  expect(errors.filter(text => !text.includes('favicon'))).toEqual([]);
});

test('shades the right side when resizing from the right crop handle', async ({ page }) => {
  await page.goto('/doc/image-crop-e2e');
  await page.locator('.feishu-image').first().click();
  await page.locator('.docx-menu-container .panel-menu-item[data-name="Crop"]').click();

  const layer = page.locator('.feishu-image-crop-layer');
  const rightHandle = layer.locator('.feishu-image-crop-layer__handle--e');
  await expect(rightHandle).toBeVisible();

  const handleBox = await rightHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2, { steps: 8 });
  await page.mouse.up();

  const positions = await layer.evaluate(element => {
    const box = element.querySelector<HTMLElement>('.feishu-image-crop-layer__box')!;
    const left = element.querySelector<HTMLElement>('.feishu-image-crop-layer__shade--left')!;
    const right = element.querySelector<HTMLElement>('.feishu-image-crop-layer__shade--right')!;
    const boxRect = box.getBoundingClientRect();
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return {
      leftWidth: leftRect.width,
      rightWidth: rightRect.width,
      cropRight: boxRect.right,
      shadeRightStart: rightRect.left,
    };
  });

  expect(positions.leftWidth).toBe(0);
  expect(positions.rightWidth).toBeGreaterThan(80);
  expect(Math.abs(positions.cropRight - positions.shadeRightStart)).toBeLessThan(1);
});
