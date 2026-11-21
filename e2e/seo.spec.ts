import { expect, test } from '@playwright/test';
import { BUILT_LESSONS, lessonHref } from '../src/lessons/catalog';

// Sitemap, robots và ảnh xem trước khi chia sẻ link. Chạy một lần là đủ, không cần cả hai khung.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'không phụ thuộc khung hình');
});

test('sitemap.xml liệt kê trang chủ và mọi bài, robots.txt trỏ tới sitemap', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const l of BUILT_LESSONS) expect(sitemap).toContain(`${lessonHref(l.slug)}</loc>`);
  expect(sitemap).not.toContain('/lab/');

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  expect(robots).toContain('Disallow: /lab/');
});

for (const url of ['/', lessonHref(BUILT_LESSONS.at(-1)!.slug)]) {
  test(`${url}: có ảnh Open Graph 1200×630 tải được`, async ({ page, request }) => {
    await page.goto(url);
    const og = page.locator('meta[property="og:image"]').first();
    const src = await og.getAttribute('content');
    expect(src).toMatch(/opengraph-image/);
    await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute(
      'content',
      '1200',
    );
    await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute(
      'content',
      /.+/,
    );
    // Link tuyệt đối trỏ tới SITE_URL; lúc test là chính server này.
    const res = await request.get(new URL(src!).pathname + new URL(src!).search);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect((await res.body()).length).toBeGreaterThan(5_000);
  });
}
