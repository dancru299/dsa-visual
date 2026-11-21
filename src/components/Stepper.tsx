import type { CSSProperties } from 'react';
import { cx } from '@/src/lib/cx';
import styles from './Stepper.module.css';

type Props = {
  labels: string[];
  current: number;
  onSelect: (index: number) => void;
};

// Thanh các bước trong bài. Bấm vào một chấm để nhảy tới bước đó.
export function Stepper({ labels, current, onSelect }: Props) {
  const n = labels.length;
  const vars = { '--n': n, '--p': n > 1 ? current / (n - 1) : 0 } as CSSProperties;
  return (
    <section className={styles.stepper} aria-label="Các bước trong bài">
      <div className={styles.head}>
        <span>TRONG BÀI NÀY</span>
        <span>
          Bước {current + 1} / {n}
        </span>
      </div>
      <div className={styles.steps}>
        <div className={styles.track} style={vars}>
          <div className={styles.bar} />
          <div className={styles.items}>
            {labels.map((label, i) => (
              <button
                key={i}
                type="button"
                className={cx(styles.item, i < current && styles.done, i === current && styles.cur)}
                onClick={() => onSelect(i)}
                aria-current={i === current ? 'step' : undefined}
              >
                {/* Tên của nút lấy từ chính chữ hiển thị, thêm chữ "Bước" chỉ cho trình đọc
                    màn hình, nên tên nút luôn chứa đúng chữ người dùng nhìn thấy (WCAG 2.5.3). */}
                <span className={styles.srOnly}>Bước </span>
                <span className={styles.dot}>{i + 1}</span>
                <span className={styles.srOnly}>: </span>
                <span className={styles.label}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
