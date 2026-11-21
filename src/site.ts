// Địa chỉ gốc của trang, dùng cho sitemap, robots và link tuyệt đối của ảnh Open Graph.
// Trên Vercel, VERCEL_PROJECT_PRODUCTION_URL là tên miền production (không có https://), có sẵn
// lúc build. Muốn dùng tên miền riêng thì đặt NEXT_PUBLIC_SITE_URL trong cài đặt của project.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '');

export const SITE_NAME = 'DSA Visual';

// Phần chung của openGraph. Trang con khai báo openGraph thì thay cả object của trang cha,
// nên mỗi nơi đều trải phần chung này vào.
export const OG_BASE = { siteName: SITE_NAME, locale: 'vi_VN', type: 'website' } as const;
export const SITE_DESCRIPTION =
  'Học cấu trúc dữ liệu và giải thuật bằng animation, dành cho người học Data Engineering.';
