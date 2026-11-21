import { describe, expect, test } from 'vitest';
import { BUILT_LESSONS, COURSE } from './catalog';
import { LESSONS } from './index';

describe('catalog', () => {
  test('bản 1.0 có 13 bài, slug không trùng', () => {
    const slugs = COURSE.flatMap((m) => m.lessons.map((l) => l.slug));
    expect(slugs).toHaveLength(13);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('mỗi bài đã làm có nội dung, và ngược lại', () => {
    expect(BUILT_LESSONS.map((l) => l.slug).sort()).toEqual(Object.keys(LESSONS).sort());
  });

  test('bài đã làm có đủ thông tin cho phần đầu trang', () => {
    for (const l of BUILT_LESSONS) {
      expect(l.summary, l.slug).toBeTruthy();
      expect(l.minutes, l.slug).toBeGreaterThan(0);
      expect(l.prerequisites?.length, l.slug).toBeGreaterThan(0);
    }
  });
});
