import { test, expect } from '@playwright/test';
import { collectErrors } from './helpers';

test('trang chủ mở được, có link vào bài đầu tiên, không lỗi console', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DSA Visual');
  await page.getByRole('link', { name: /Bắt đầu với Binary Search/ }).click();
  await expect(page).toHaveURL(/\/learn\/binary-search/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Binary Search');
  expect(errors).toEqual([]);
});

test('bản demo cũ vẫn mở được và chuyển được sang bước 2', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/demo.html');
  await expect(page.locator('#lTitle')).toHaveText('Binary Search');
  await expect(page.locator('#stepNo')).toHaveText('BƯỚC 1 / 8');
  await page.locator('#btnNext').click();
  await expect(page.locator('#stepNo')).toHaveText('BƯỚC 2 / 8');
  expect(errors).toEqual([]);
});
