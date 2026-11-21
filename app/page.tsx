import Link from 'next/link';
import { buttonClass } from '@/src/components/Button';
import { BUILT_LESSONS, COURSE, lessonHref } from '@/src/lessons/catalog';
import styles from './page.module.css';

export default function Home() {
  const first = BUILT_LESSONS[0];
  const total = COURSE.reduce((n, m) => n + m.lessons.length, 0);
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>
        DSA <span className={styles.highlight}>Visual</span>
      </h1>
      <p className={styles.lead}>
        Học cấu trúc dữ liệu và giải thuật bằng animation, dành cho người học Data Engineering. Mỗi
        bài chạy thuật toán từng bước, dừng lại cho bạn đoán trước, rồi nối với việc thật như index,
        join hay DAG.
      </p>
      <div className={styles.cta}>
        {first && (
          <Link href={lessonHref(first.slug)} className={buttonClass('primary')}>
            Bắt đầu với {first.title}
          </Link>
        )}
        <span className={styles.muted}>
          {BUILT_LESSONS.length}/{total} bài đã có · <a href="/demo.html">xem bản demo đầu tiên</a>
        </span>
      </div>

      <div className={styles.grid}>
        {COURSE.map((m) => (
          <section key={m.id} className={styles.module}>
            <h2>
              <span className={styles.swatch} style={{ background: m.color }} />
              {m.name}
            </h2>
            <ul>
              {m.lessons.map((l) => (
                <li key={l.slug}>
                  {l.built ? (
                    <Link href={lessonHref(l.slug)}>{l.title}</Link>
                  ) : (
                    <span className={styles.soon}>{l.title} · sắp có</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
