import { expect, test } from '@playwright/test';

const e2eDocument = {
  id: 'hover-floating-e2e',
  title: 'Hover Floating E2E',
  content: '<p></p>',
  author: 'E2E',
  created_at: '2026-05-23T00:00:00.000Z',
  updated_at: '2026-05-23T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/documents/hover-floating-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/hover-floating-e2e', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: e2eDocument } });
    }
    return route.fulfill({ json: { code: 0, data: e2eDocument } });
  });
});

test('keeps block controls and portal panel stable across hover gaps', async ({ page }) => {
  await page.goto('/doc/hover-floating-e2e');

  const editorArea = page.locator('.editor-content-area');
  await expect(editorArea).toBeVisible();

  const firstParagraph = page.locator('.ProseMirror p').first();
  await expect(firstParagraph).toBeVisible();
  await firstParagraph.hover();

  const inlineTools = page.locator('.block-inline-tools');
  const addButton = page.locator('.block-add-btn').first();
  await expect(inlineTools).toBeVisible();
  await expect(addButton).toBeVisible();

  await addButton.hover();

  const slashMenu = page.locator('.block-plus-menu-shell .slash-menu-feishu, .slash-menu-feishu').first();
  await expect(slashMenu).toBeVisible();

  const menuBox = await slashMenu.boundingBox();
  const buttonBox = await addButton.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  if (menuBox && buttonBox) {
    await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
    await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + 12, { steps: 8 });
  }

  await expect(slashMenu).toBeVisible();
  const panelItem = slashMenu.locator('.slash-item:not(.slash-item--has-submenu), .slash-basic-cell').first();
  await expect(panelItem).toBeVisible();
  const panelItemBox = await panelItem.boundingBox();
  expect(panelItemBox).not.toBeNull();
  if (panelItemBox) {
    await page.mouse.click(panelItemBox.x + panelItemBox.width / 2, panelItemBox.y + panelItemBox.height / 2);
  }

  await expect(slashMenu).toBeHidden();
});

test('closes plus slash menu when pointer leaves panel for editor content', async ({ page }) => {
  await page.goto('/doc/hover-floating-e2e');

  const firstParagraph = page.locator('.ProseMirror p').first();
  await expect(firstParagraph).toBeVisible();
  await firstParagraph.hover();

  const addButton = page.locator('.block-add-btn').first();
  await expect(addButton).toBeVisible();
  await addButton.hover();

  const slashMenu = page.locator('.block-plus-menu-shell .slash-menu-feishu').first();
  await expect(slashMenu).toBeVisible();

  const menuBox = await slashMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  if (menuBox) {
    await page.mouse.move(menuBox.x + menuBox.width / 2, menuBox.y + 40);
  }

  const editorArea = page.locator('.editor-content-area');
  const areaBox = await editorArea.boundingBox();
  expect(areaBox).not.toBeNull();
  if (areaBox) {
    await page.mouse.move(areaBox.x + areaBox.width * 0.7, areaBox.y + areaBox.height * 0.6, { steps: 10 });
  }

  await expect(slashMenu).toBeHidden({ timeout: 2000 });
});

test('shows the plus button beside a focused empty paragraph', async ({ page }) => {
  await page.goto('/doc/hover-floating-e2e');

  const firstParagraph = page.locator('.ProseMirror p').first();
  await expect(firstParagraph).toBeVisible();
  await firstParagraph.hover();
  await firstParagraph.click();

  const addButton = page.locator('.block-add-btn').first();
  await expect(addButton).toBeVisible();
  const buttonBox = await addButton.boundingBox();
  const paragraphBox = await firstParagraph.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(paragraphBox).not.toBeNull();
  if (!buttonBox || !paragraphBox) return;

  expect(buttonBox.y).toBeGreaterThan(0);
  expect(Math.abs((buttonBox.y + buttonBox.height / 2) - (paragraphBox.y + paragraphBox.height / 2))).toBeLessThanOrEqual(4);
});
