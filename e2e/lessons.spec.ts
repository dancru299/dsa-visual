import { test, expect } from '@playwright/test';
import { BUILT_LESSONS, lessonHref } from '../src/lessons/catalog';
import { collectErrors, readFrameCounter, seek, stepTotal } from './helpers';

for (const lesson of BUILT_LESSONS) {
  test.describe(`bài ${lesson.title}`, () => {
    // Chạy ở chế độ giảm chuyển động: vừa kiểm tra bài vẫn học được khi tắt hiệu ứng (một mục
    // trong checklist review), vừa để nút không nảy khiến mỗi lần bấm phải chờ. Bấm qua từng frame
    // của cả bài nên cần nhiều thời gian hơn mức 30 giây mặc định.
    test('đi hết mọi bước và trả lời mọi câu đoán mà không lỗi', async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = collectErrors(page);
      await page.goto(lessonHref(lesson.slug));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(lesson.title);
      const total = await stepTotal(page);

      for (let s = 1; s <= total; s++) {
        await expect(page.getByTestId('step-counter')).toHaveText(`BƯỚC ${s} / ${total}`);
        await seek(page, 0);

        // Đi từng frame tới cuối bước. Gặp câu đoán thì chọn đại một đáp án rồi đi tiếp.
        for (let guard = 0; guard < 300; guard++) {
          const ask = page.getByTestId('ask-card');
          if (await ask.isVisible()) {
            await ask.getByTestId('ask-choice').first().click();
            await page.getByTestId('ask-continue').click();
            await expect(ask).toBeHidden();
            const { current } = await readFrameCounter(page);
            await seek(page, current - 1); // trả lời xong player chạy tiếp; tua để dừng lại
            continue;
          }
          const next = page.getByTestId('frame-next');
          if (await next.isDisabled()) break;
          await next.click();
        }

        const { current, count } = await readFrameCounter(page);
        expect(current).toBe(count);
        if (s < total) await page.getByTestId('step-next').click();
      }

      await expect(page.getByTestId('progress-chip')).toHaveText(/Đã xong bài/);
      expect(errors).toEqual([]);
    });

    test('tua được tới mọi frame của mọi bước', async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(lessonHref(lesson.slug));
      const total = await stepTotal(page);

      for (let s = 1; s <= total; s++) {
        await page.getByRole('button', { name: new RegExp(`^Bước ${s}:`) }).click();
        await expect(page.getByTestId('step-counter')).toHaveText(`BƯỚC ${s} / ${total}`);
        const { count } = await readFrameCounter(page);
        for (let f = count - 1; f >= 0; f--) {
          await seek(page, f);
          await expect(page.getByTestId('frame-counter')).toHaveText(`${f + 1} / ${count}`);
        }
      }
      expect(errors).toEqual([]);
    });

    test('link tới một bước mở đúng bước đó', async ({ page }) => {
      await page.goto(`${lessonHref(lesson.slug)}#buoc-2`);
      await expect(page.getByTestId('step-counter')).toHaveText(/^BƯỚC 2 \//);
    });
  });
}

test('slug không có trả về trang không tìm thấy', async ({ page }) => {
  await page.goto('/learn/khong-ton-tai');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});
