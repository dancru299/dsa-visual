import { expect, test } from '@playwright/test';
import { lessonHref } from '../src/lessons/catalog';

// Học trọn một đoạn bài chỉ bằng bàn phím: bỏ qua thanh trên và danh sách bài, đi từng frame,
// trả lời câu đoán, rồi sang bước sau.
test('học được chỉ bằng bàn phím', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'bàn phím vật lý: chỉ kiểm tra trên desktop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(lessonHref('binary-search'));

  // Phím Tab đầu tiên tới liên kết bỏ qua; Enter đưa focus vào nội dung bài.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Bỏ qua tới nội dung' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#noi-dung')).toBeFocused();

  // Đi từng frame bằng nút "frame sau" (Enter), hết bước thì mũi tên phải sang bước kế, cho tới
  // khi gặp câu đoán đầu tiên của bài.
  const next = page.getByTestId('frame-next');
  const ask = page.getByTestId('ask-card');
  for (let i = 0; i < 200 && !(await ask.isVisible()); i++) {
    await next.focus();
    await page.keyboard.press((await next.isDisabled()) ? 'ArrowRight' : 'Enter');
  }
  await expect(ask).toBeVisible();

  // Câu đoán hiện ra thì focus nằm sẵn ở lựa chọn đầu tiên; Enter chọn, rồi Enter để xem tiếp.
  await expect(ask.getByTestId('ask-choice').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ask-continue')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ask).toBeHidden();

  // Mũi tên phải chuyển sang bước sau khi focus không nằm trong ô nhập.
  const before = (await page.getByTestId('step-counter').textContent())!;
  const step = Number(before.match(/BƯỚC (\d+)/)![1]);
  await next.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-counter')).toHaveText(new RegExp(`^BƯỚC ${step + 1} /`));
});
