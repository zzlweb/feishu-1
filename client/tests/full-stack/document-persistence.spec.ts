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

test('persists rich table structure and sizing through the real server', async ({ page, request }) => {
  const createdResponse = await request.post('/api/documents', {
    data: {
      title: 'Full-stack rich table persistence',
      content: `
        <p>before table</p>
        <table>
          <tbody>
            <tr><td><p>Alpha</p></td><td><p>Beta</p></td><td><p>Gamma</p></td></tr>
            <tr><td><p>Delta</p></td><td><p>Epsilon</p></td><td><p>Zeta</p></td></tr>
            <tr><td><p>Eta</p></td><td><p>Theta</p></td><td><p>Iota</p></td></tr>
          </tbody>
        </table>
        <p>after table</p>
      `,
      author: 'Full-stack test',
    },
  });
  expect(createdResponse.ok()).toBeTruthy();
  const createdPayload = await createdResponse.json();
  const documentId = createdPayload.data.id as string;

  await page.goto(`/doc/${documentId}`);
  const host = page.locator('.feishu-table-host, .tableWrapper').first();
  await expect(host).toBeVisible();

  await host.hover();
  await page.locator('[data-table-axis-handle="true"].feishu-table-chrome__rail-block--row').nth(1).click();
  await page.locator('.feishu-table-selection-toolbar button[title="更多"]').click();
  await page.locator('.feishu-table-selection-toolbar').getByText('下方插入行', { exact: true }).click();
  await expect(page.locator('tr[data-row-index]')).toHaveCount(4);

  const cells = page.locator('td[data-table-cell="true"]');
  const start = await cells.nth(0).boundingBox();
  const end = await cells.nth(4).boundingBox();
  expect(start).not.toBeNull();
  expect(end).not.toBeNull();
  await page.mouse.move(start!.x + start!.width - 6, start!.y + start!.height - 6);
  await page.mouse.down();
  await page.mouse.move(end!.x + end!.width - 6, end!.y + end!.height - 6, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('td.selectedCell')).toHaveCount(4);

  await page.locator('.feishu-table-selection-toolbar button[title="合并单元格"]').click();
  const merged = page.locator('td[data-table-cell="true"]').first();
  await expect(merged).toHaveAttribute('rowspan', '2');
  await expect(merged).toHaveAttribute('colspan', '2');

  await page.locator('.feishu-table-selection-toolbar button[title="单元格背景"]').click();
  await page.locator('.feishu-table-selection-toolbar button[title="浅黄"]').click();
  await expect(merged).toHaveCSS('background-color', 'rgb(255, 241, 184)');

  await host.hover();
  const colResize = page.locator('[data-table-resize-handle="true"].feishu-table-chrome__resize-col').first();
  const colBox = await colResize.boundingBox();
  expect(colBox).not.toBeNull();
  await page.mouse.move(colBox!.x + colBox!.width / 2, colBox!.y + colBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(colBox!.x + 42, colBox!.y + colBox!.height / 2, { steps: 8 });
  await page.mouse.up();

  const rowResize = page.locator('[data-table-resize-handle="true"].feishu-table-chrome__resize-row').first();
  const rowBox = await rowResize.boundingBox();
  expect(rowBox).not.toBeNull();
  const savedResponse = page.waitForResponse(response =>
    response.url().endsWith(`/api/documents/${documentId}`)
      && response.request().method() === 'PUT'
      && response.ok(),
  );
  await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + rowBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + 36, { steps: 8 });
  await page.mouse.up();
  await savedResponse;

  const widthBeforeReload = await page.locator('col[data-col-index="0"]').evaluate(el => getComputedStyle(el).width);
  const heightBeforeReload = await page.locator('tr[data-row-index="0"]').evaluate(el => getComputedStyle(el).height);

  const storedResponse = await request.get(`/api/documents/${documentId}`);
  expect(storedResponse.ok()).toBeTruthy();
  const storedPayload = await storedResponse.json();
  expect(storedPayload.data.content).toContain('rowspan="2"');
  expect(storedPayload.data.content).toContain('colspan="2"');
  expect(storedPayload.data.content).toMatch(/background-color:\s*(#fff1b8|rgb\(255,\s*241,\s*184\))/i);
  expect(storedPayload.data.content).toContain('Alpha');
  expect(storedPayload.data.content).toContain('Epsilon');
  expect((storedPayload.data.content.match(/<tr\b/g) ?? [])).toHaveLength(4);

  await page.reload();
  const restored = page.locator('td[data-table-cell="true"]').first();
  await expect(restored).toHaveAttribute('rowspan', '2');
  await expect(restored).toHaveAttribute('colspan', '2');
  await expect(restored).toHaveCSS('background-color', 'rgb(255, 241, 184)');
  await expect(restored).toContainText('Alpha');
  await expect(restored).toContainText('Epsilon');
  await expect(page.locator('tr[data-row-index]')).toHaveCount(4);
  await expect(page.locator('col[data-col-index="0"]')).toHaveCSS('width', widthBeforeReload);
  await expect(page.locator('tr[data-row-index="0"]')).toHaveCSS('height', heightBeforeReload);
});
