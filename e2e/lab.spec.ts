import { test, expect } from '@playwright/test';
import { collectErrors, readFrameCounter, seek } from './helpers';

test('trang thử scene đồ thị tua được mọi frame và trả lời được câu đoán', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/lab/graph');
  await expect(page.getByTestId('graph-scene')).toBeVisible();

  const { count } = await readFrameCounter(page);
  for (let f = count - 1; f >= 0; f--) {
    await seek(page, f);
    await expect(page.getByTestId('frame-counter')).toHaveText(`${f + 1} / ${count}`);
  }

  // Đi từng frame từ đầu, gặp câu đoán thì chọn đại một đáp án rồi đi tiếp.
  for (let guard = 0; guard < 100; guard++) {
    const ask = page.getByTestId('ask-card');
    if (await ask.isVisible()) {
      await ask.getByTestId('ask-choice').first().click();
      await page.getByTestId('ask-continue').click();
      const { current } = await readFrameCounter(page);
      await seek(page, current - 1);
      continue;
    }
    const next = page.getByTestId('frame-next');
    if (await next.isDisabled()) break;
    await next.click();
  }
  const end = await readFrameCounter(page);
  expect(end.current).toBe(end.count);
  await expect(page.locator('[data-mark="done"]')).toHaveCount(5);
  expect(errors).toEqual([]);
});
