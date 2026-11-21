import { expect, type Page } from '@playwright/test';

// Gom lỗi console và lỗi JavaScript chưa được bắt trong lúc trang chạy.
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// Đọc "3 / 12" trên bộ đếm frame.
export async function readFrameCounter(page: Page): Promise<{ current: number; count: number }> {
  const text = (await page.getByTestId('frame-counter').textContent()) ?? '';
  const [current, count] = text.split('/').map((x) => Number(x.trim()));
  return { current, count };
}

// Tua tới một frame (đánh số từ 0). Tua luôn dừng Play, nên các bước sau không bị
// frame tự chạy chen vào.
export async function seek(page: Page, frame: number) {
  const slider = page.getByTestId('scrubber');
  if (await slider.isDisabled()) return; // bước chỉ có một frame thì không tự chạy
  // Gán lại đúng giá trị đang có thì trình duyệt không phát sự kiện change, nên đi vòng qua
  // một frame khác trước.
  if (Number(await slider.inputValue()) === frame) {
    const max = Number(await slider.getAttribute('max'));
    await slider.fill(String(frame === max ? frame - 1 : frame + 1));
  }
  await slider.fill(String(frame));
  await expect(page.getByTestId('play-toggle')).toHaveAttribute('data-playing', 'false');
}

export async function stepTotal(page: Page): Promise<number> {
  const text = (await page.getByTestId('step-counter').textContent()) ?? '';
  return Number(/\/\s*(\d+)/.exec(text)?.[1]);
}
