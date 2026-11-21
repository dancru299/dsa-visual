'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

// Bọc các scene dùng Motion. Khi không chạy hiệu ứng (đang tua, hoặc người dùng bật giảm
// chuyển động), mọi chuyển động của Motion, kể cả layout và layoutId, kết thúc ngay.
export function Instant({ animate, children }: { animate: boolean; children: ReactNode }) {
  return (
    <MotionConfig
      transition={animate ? { type: 'spring', stiffness: 320, damping: 28 } : { duration: 0 }}
    >
      {children}
    </MotionConfig>
  );
}
