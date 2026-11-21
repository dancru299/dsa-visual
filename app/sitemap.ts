import type { MetadataRoute } from 'next';
import { BUILT_LESSONS, lessonHref } from '@/src/lessons/catalog';
import { SITE_URL } from '@/src/site';

// Trang chủ và mọi bài đã làm. Trang thử /lab không đưa vào.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    ...BUILT_LESSONS.map((l) => ({
      url: `${SITE_URL}${lessonHref(l.slug)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
