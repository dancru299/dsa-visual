import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Ảnh Open Graph được vẽ sẵn lúc build, nhưng cache của nó có hạn và Vercel sẽ vẽ lại trên
  // server. Khi đó server cần file font, mà Next không tự thấy vì đường dẫn được ghép lúc chạy.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./assets/fonts/**/*'],
    '/learn/\\[slug\\]/opengraph-image': ['./assets/fonts/**/*'],
  },
};

export default nextConfig;
