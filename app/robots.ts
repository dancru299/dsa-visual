import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/src/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // /lab là trang thử nội bộ, không cần xuất hiện trên công cụ tìm kiếm.
    rules: { userAgent: '*', allow: '/', disallow: '/lab/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
