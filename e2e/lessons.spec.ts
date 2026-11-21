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

    test('làm quiz cuối bài, xem lại bước gợi ý, điểm còn sau khi tải lại', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = collectErrors(page);
      await page.goto(lessonHref(lesson.slug));
      const quiz = page.getByTestId('quiz');
      const questions = quiz.getByTestId('quiz-question');
      const n = await questions.count();
      expect(n).toBeGreaterThanOrEqual(3);

      // Chọn đáp án hiện đầu tiên của mỗi câu; chọn xong thì câu đó khoá lại.
      for (let i = 0; i < n; i++) {
        const choices = questions.nth(i).getByTestId('quiz-choice');
        await choices.first().click();
        await expect(choices.first()).toBeDisabled();
      }
      await expect(quiz.getByTestId('quiz-result')).toContainText(`trên ${n} câu`);
      const chip = page.getByTestId('quiz-chip');
      await expect(chip).toHaveText(new RegExp(`Quiz \\d+/${n}`));
      const saved = (await chip.textContent())!;

      // Câu sai có nút đưa về đúng bước cần xem lại.
      const review = quiz.getByTestId('quiz-review').first();
      if (await review.isVisible()) {
        const label = (await review.textContent())!;
        const step = Number(label.match(/bước (\d+)/)![1]);
        await review.click();
        await expect(page.getByTestId('step-counter')).toHaveText(new RegExp(`^BƯỚC ${step} /`));
      }

      // Làm lại: mọi câu mở khoá, điểm cũ vẫn giữ.
      await quiz.getByTestId('quiz-retry').click();
      await expect(questions.first().getByTestId('quiz-choice').first()).toBeEnabled();
      await expect(quiz.getByTestId('quiz-result')).toContainText(`0/${n}`);

      await page.reload();
      await expect(page.getByTestId('quiz-chip')).toHaveText(saved);
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
