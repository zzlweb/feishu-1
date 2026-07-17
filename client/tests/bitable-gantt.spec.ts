import { expect, test, type Page } from '@playwright/test';

const ganttModel = {
  id: 'tbl_gantt_e2e',
  name: '甘特 E2E',
  primaryFieldId: 'title',
  activeViewId: 'gantt',
  fields: [
    { id: 'title', name: '任务名', type: 'text' },
    { id: 'start', name: '开始日期', type: 'date' },
    { id: 'end', name: '结束日期', type: 'date' },
  ],
  records: [
    {
      id: 'rec_a',
      tableId: 'tbl_gantt_e2e',
      fields: { title: '任务 A', start: '2026-07-10', end: '2026-07-14' },
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      createdBy: 'E2E',
    },
    {
      id: 'rec_b',
      tableId: 'tbl_gantt_e2e',
      fields: { title: '任务 B', start: '', end: '' },
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'gantt',
      tableId: 'tbl_gantt_e2e',
      name: '甘特图',
      type: 'gantt',
      config: {
        titleFieldId: 'title',
        startDateFieldId: 'start',
        endDateFieldId: 'end',
        dayWidth: 40,
      },
      filters: [],
      sorts: [],
    },
  ],
};

const ganttNoDateModel = {
  id: 'tbl_gantt_no_date',
  name: '甘特无日期',
  primaryFieldId: 'title',
  activeViewId: 'gantt',
  fields: [
    { id: 'title', name: '任务名', type: 'text' },
    { id: 'note', name: '备注', type: 'text' },
  ],
  records: [
    {
      id: 'rec_plain',
      tableId: 'tbl_gantt_no_date',
      fields: { title: '无排期任务', note: '' },
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
      createdBy: 'E2E',
    },
  ],
  views: [
    {
      id: 'gantt',
      tableId: 'tbl_gantt_no_date',
      name: '甘特图',
      type: 'gantt',
      config: { dayWidth: 40 },
      filters: [],
      sorts: [],
    },
  ],
};

const ganttDocument = {
  id: 'bitable-gantt-e2e',
  title: 'Bitable Gantt E2E',
  content: `<div data-local-block="bitable" data-model='${JSON.stringify(ganttModel)}'></div>`,
  author: 'E2E',
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
  is_template: 0,
  parent_id: null,
  cover_url: '',
  icon: '',
};

async function openGantt(page: Page, model = ganttModel) {
  const document = {
    ...ganttDocument,
    content: `<div data-local-block="bitable" data-model='${JSON.stringify(model)}'></div>`,
  };
  await page.route('**/api/documents/bitable-gantt-e2e/comments', route =>
    route.fulfill({ json: { code: 0, data: [] } }),
  );
  await page.route('**/api/documents/bitable-gantt-e2e', route =>
    route.fulfill({ json: { code: 0, data: document } }),
  );
  await page.goto('/doc/bitable-gantt-e2e');
  const block = page.locator('.feishu-base-block').first();
  await expect(block).toBeVisible();
  await expect(block).toHaveAttribute('data-base-view-type', 'gantt');
  return block;
}

test('renders timeline, task bars and unscheduled schedule entry', async ({ page }) => {
  const block = await openGantt(page);

  await expect(block.locator('.base-gantt__months span').first()).toBeVisible();
  await expect(block.locator('.base-gantt__days span').first()).toBeVisible();
  await expect(block.locator('.base-gantt__bar')).toHaveCount(1);
  await expect(block.locator('.base-gantt__bar-title')).toContainText('任务 A');
  await expect(block.locator('.base-gantt__bar-duration')).toContainText('5天');
  await expect(block.locator('.base-gantt__schedule')).toHaveCount(1);
  await expect(block.locator('.base-gantt__today-line')).toBeVisible();

  await block.locator('.base-gantt__scale').getByRole('button', { name: '周' }).click();
  await expect(block.locator('.base-gantt__scale button.is-active')).toHaveText('周');
  await block.locator('.base-gantt__scale').getByRole('button', { name: '月' }).click();
  await expect(block.locator('.base-gantt__scale button.is-active')).toHaveText('月');
});

test('gantt settings configures title and date fields', async ({ page }) => {
  const block = await openGantt(page);
  await block.hover();

  await block.getByRole('button', { name: '甘特设置' }).click();
  const settings = page.locator('.base-settings--gantt');
  await expect(settings).toBeVisible();
  await expect(settings.getByText('任务名称字段')).toBeVisible();
  await expect(settings.getByText('开始日期')).toBeVisible();
  await expect(settings.getByText('结束日期')).toBeVisible();
  await expect(settings.getByText('时间刻度')).toBeVisible();
  await expect(settings.getByText('排序字段')).toBeVisible();

  await settings.getByRole('button', { name: '×' }).click();
  await expect(settings).toHaveCount(0);
});

test('shows empty state without date fields and can create them', async ({ page }) => {
  const block = await openGantt(page, ganttNoDateModel);

  await expect(block.locator('[data-testid="gantt-empty-state"]')).toBeVisible();
  await expect(block.locator('[data-testid="gantt-empty-state"]')).toContainText('暂无日期字段');
  await expect(block.locator('.base-gantt__bar')).toHaveCount(0);

  await block.getByRole('button', { name: '创建日期字段' }).click();
  await expect(block.locator('[data-testid="gantt-empty-state"]')).toHaveCount(0);
  await expect(block.locator('.base-gantt__scroll')).toBeVisible();
  await expect(block.locator('.base-gantt__schedule')).toHaveCount(1);

  await block.hover();
  await block.getByRole('button', { name: '甘特设置' }).click();
  const settings = page.locator('.base-settings--gantt');
  await expect(settings).toBeVisible();
  await expect(settings.locator('.base-settings__hint')).toHaveCount(0);
  await expect(settings.getByText('开始日期')).toBeVisible();
});
