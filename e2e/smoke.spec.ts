import { test, expect } from '@playwright/test';
import { BUILT_LESSONS, lessonHref } from '../src/lessons/catalog';
import { collectErrors } from './helpers';

test('trang chủ mở được, có link vào bài đầu tiên, không lỗi console', async ({ page }) => {
  const errors = collectErrors(page);
  const first = BUILT_LESSONS[0];
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DSA Visual');
  await page.getByRole('link', { name: `Bắt đầu với ${first.title}` }).click();
  await expect(page).toHaveURL(new RegExp(`${lessonHref(first.slug)}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.title);
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
