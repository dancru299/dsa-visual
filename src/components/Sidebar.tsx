'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COURSE, lessonHref } from '@/src/lessons/catalog';
import { cx } from '@/src/lib/cx';
import { Icon } from './Icon';
import styles from './Sidebar.module.css';

const Folder = ({ color }: { color: string }) => (
  <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
    <path
      d="M1.5 3.5a2 2 0 0 1 2-2h4.2l2 2.2h8.8a2 2 0 0 1 2 2v9.3a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"
      style={{ fill: color, stroke: 'var(--ink)', strokeWidth: 1.6, strokeLinejoin: 'round' }}
    />
  </svg>
);

// Danh sách module và bài, sinh từ catalog.ts. Bài chưa làm hiện mờ kèm nhãn "sắp có".
export function Sidebar() {
  const pathname = usePathname();
  const total = COURSE.reduce((n, m) => n + m.lessons.length, 0);
  return (
    <nav aria-label="Khoá học">
      <div className={styles.head}>
        <Folder color="var(--ink)" />
        Khoá học
        <small>{total} bài</small>
      </div>
      {COURSE.map((m) => {
        const built = m.lessons.filter((l) => l.built).length;
        return (
          <details key={m.id} className={styles.mod} open>
            <summary>
              <span className={styles.chev}>
                <Icon name="chev" size={13} />
              </span>
              <Folder color={m.color} />
              <span>{m.name}</span>
              <span className={styles.cnt}>
                {built}/{m.lessons.length}
              </span>
            </summary>
            <ul className={styles.les}>
              {m.lessons.map((l) => {
                const href = lessonHref(l.slug);
                const current = pathname === href;
                return (
                  <li key={l.slug}>
                    {l.built ? (
                      <Link
                        href={href}
                        className={cx(styles.item, current && styles.on)}
                        aria-current={current ? 'page' : undefined}
                      >
                        <Icon name="file" size={14} />
                        <span>{l.title}</span>
                      </Link>
                    ) : (
                      <span className={cx(styles.item, styles.soon)}>
                        <Icon name="file" size={14} />
                        <span>{l.title}</span>
                        <span className={styles.tagsoon}>sắp có</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}
