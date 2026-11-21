import { test, expect, type Page } from '@playwright/test';

// Gom lỗi console và lỗi JavaScript chưa được bắt trong lúc trang chạy.
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('trang chủ mở được và không có lỗi console', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DSA Visual');
  await expect(page.getByRole('link', { name: 'bản demo đầu tiên' })).toHaveAttribute(
    'href',
    '/demo.html',
  );
  expect(errors).toEqual([]);
});

test('bản demo mở được và chuyển được sang bước 2', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/demo.html');
  await expect(page.locator('#lTitle')).toHaveText('Binary Search');
  await expect(page.locator('#stepNo')).toHaveText('BƯỚC 1 / 8');
  await page.locator('#btnNext').click();
  await expect(page.locator('#stepNo')).toHaveText('BƯỚC 2 / 8');
  expect(errors).toEqual([]);
});
