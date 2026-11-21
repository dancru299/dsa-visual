import type { Metric } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import styles from './Metrics.module.css';

// Ô số liệu phía trên scene. Giá trị đổi thì nháy nhẹ một lần (chỉ khi đang có chuyển động).
export function Metrics({ metrics = [], animate }: { metrics?: Metric[]; animate: boolean }) {
  return (
    <div className={styles.metrics} data-testid="metrics">
      {metrics.map((m) => (
        <div key={m.label} className={cx(styles.metric, m.tone && styles[m.tone])}>
          <div className={styles.ml}>{m.label}</div>
          <div key={m.value} className={cx(styles.mv, animate && styles.flash)}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}
