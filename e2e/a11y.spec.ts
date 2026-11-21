import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { BUILT_LESSONS, lessonHref } from '../src/lessons/catalog';
import { readFrameCounter, seek, stepTotal } from './helpers';

// Kiểm tra tự động các lỗi truy cập mà axe phát hiện được theo WCAG 2.1 mức A và AA: độ tương
// phản màu, nhãn của nút và ô nhập, cấu trúc heading, vai trò ARIA... Không thay được việc tự
// dùng bàn phím và trình đọc màn hình, nhưng bắt được lỗi lặp lại ở mọi bài.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // Kèm thông báo của axe cho chỗ đầu tiên, ví dụ tỉ lệ tương phản và hai màu, để sửa được ngay.
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes.length} chỗ, ví dụ ${v.nodes[0].target.join(' ')}: ${
        v.nodes[0].any[0]?.message ?? v.nodes[0].failureSummary ?? ''
      }`,
  );
}

const PAGES = ['/', ...BUILT_LESSONS.map((l) => lessonHref(l.slug))];

for (const url of PAGES) {
  test(`${url}: không có lỗi WCAG 2.1 A/AA mà axe phát hiện`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await expect(page.locator('body')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

// Mỗi bước có màu và thành phần riêng, quiz có màu đúng, sai sau khi trả lời: quét từng bước,
// rồi quét quiz sau khi đã chọn đáp án cho mọi câu. Chỉ chạy trên desktop cho đỡ tốn thời gian;
// trang đầu tiên của từng bài đã được quét trên cả điện thoại ở test bên trên.
for (const lesson of BUILT_LESSONS) {
  test(`bài ${lesson.title}: mọi bước và quiz đã trả lời đều không có lỗi axe`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'chỉ quét chi tiết trên desktop');
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(lessonHref(lesson.slug));
    const total = await stepTotal(page);
    const found: string[] = [];
    for (let s = 1; s <= total; s++) {
      await page.getByRole('button', { name: new RegExp(`^Bước ${s}\\s*:`) }).click();
      await expect(page.getByTestId('step-counter')).toHaveText(`BƯỚC ${s} / ${total}`);
      // Quét ở frame cuối của bước: lúc đó bảng, màu đánh dấu, kết quả đều đã hiện đủ.
      const { count } = await readFrameCounter(page);
      await seek(page, count - 1);
      found.push(...(await violations(page)).map((v) => `bước ${s}: ${v}`));
    }
    const questions = page.getByTestId('quiz-question');
    for (let i = 0; i < (await questions.count()); i++) {
      await questions.nth(i).getByTestId('quiz-choice').first().click();
    }
    found.push(...(await violations(page)).map((v) => `quiz: ${v}`));
    expect(found).toEqual([]);
  });
}
