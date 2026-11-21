'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cx } from '@/src/lib/cx';
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './LearnShell.module.css';

// Khung trang học: sidebar bên trái, nội dung bên phải. Trên màn hình hẹp, sidebar ẩn đi
// và mở bằng nút "Danh sách bài".
export function LearnShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  // Sidebar tự đóng khi chuyển sang trang khác: chỉ mở nếu được mở trên đúng trang hiện tại.
  const open = openOn === pathname;

  return (
    <div className={cx(styles.shell, open && styles.open)}>
      <aside className={styles.side} id="course-sidebar">
        {sidebar}
      </aside>
      <main className={styles.content} id="noi-dung" tabIndex={-1}>
        <Button
          className={styles.menuBtn}
          onClick={() => setOpenOn(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="course-sidebar"
        >
          <Icon name="menu" size={16} />
          Danh sách bài
        </Button>
        {children}
      </main>
    </div>
  );
}
