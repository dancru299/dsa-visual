import type { CSSProperties } from 'react';
import type { SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { HalvingState } from './algorithm';
import styles from './HalvingScene.module.css';

const fmt = (n: number) => n.toLocaleString('vi-VN');

// Bậc thang chia đôi n tới khi còn 1, và bảng so sánh số lần so sánh tệ nhất với n lớn.
export function HalvingScene({ frame, animate }: SceneProps<HalvingState>) {
  const { n, sizes, shown, table, tableShown } = frame.state;
  return (
    <div className={cx(styles.root, !animate && styles.noAnim)}>
      <div className={styles.ladder}>
        <div className={styles.head}>{n} PHẦN TỬ: CHIA ĐÔI BAO NHIÊU LẦN THÌ CÒN 1?</div>
        {sizes.map((size, k) => (
          <div
            key={k}
            className={cx(styles.lrow, k < shown && styles.show, size === 1 && styles.last)}
          >
            <span className={styles.ll}>{k === 0 ? 'ban đầu' : `lần ${k}`}</span>
            <div className={styles.sqs}>
              {Array.from({ length: size }, (_, j) => (
                <i key={j} className={styles.sq} style={{ '--d': j } as CSSProperties} />
              ))}
            </div>
            <span className={styles.lc}>{size} ô</span>
          </div>
        ))}
      </div>
      <div className={styles.big}>
        <div className={styles.head}>SỐ LẦN SO SÁNH (TỆ NHẤT)</div>
        <table>
          <thead>
            <tr>
              <th>n</th>
              <th>linear</th>
              <th>binary</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, r) => (
              <tr key={row.n} className={cx(r < tableShown && styles.shown)}>
                <td>{fmt(row.n)}</td>
                <td className={styles.lin}>{fmt(row.linear)}</td>
                <td className={styles.bin}>{row.binary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>binary = ⌊log₂ n⌋ + 1</p>
      </div>
    </div>
  );
}
