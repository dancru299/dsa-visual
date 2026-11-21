import Link from 'next/link';
import { REPO_URL } from '@/src/config';
import { BUILT_LESSONS, lessonHref } from '@/src/lessons/catalog';
import { cx } from '@/src/lib/cx';
import { Icon } from './Icon';
import styles from './TopBar.module.css';

export function TopBar() {
  const first = BUILT_LESSONS[0];
  return (
    <header className={styles.top}>
      <Link href="/" className={styles.logo}>
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <rect
            x="2"
            y="15"
            width="11"
            height="11"
            rx="2"
            style={{ fill: 'var(--lav)', stroke: 'var(--ink)', strokeWidth: 2 }}
          />
          <rect
            x="15"
            y="15"
            width="11"
            height="11"
            rx="2"
            style={{ fill: 'var(--sky)', stroke: 'var(--ink)', strokeWidth: 2 }}
          />
          <rect
            x="8.5"
            y="2.5"
            width="11"
            height="11"
            rx="2"
            style={{ fill: 'var(--mint)', stroke: 'var(--ink)', strokeWidth: 2 }}
          />
        </svg>
        <span>
          DSA <span className={styles.hl}>Visual</span>
        </span>
      </Link>
      <nav className={styles.nav} aria-label="Điều hướng chính">
        {first && (
          <Link href={lessonHref(first.slug)} className={styles.link}>
            <Icon name="book" size={15} />
            Học
          </Link>
        )}
        <a
          href={REPO_URL}
          className={cx(styles.link, styles.hideSm)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="file" size={15} />
          Mã nguồn
        </a>
      </nav>
    </header>
  );
}
