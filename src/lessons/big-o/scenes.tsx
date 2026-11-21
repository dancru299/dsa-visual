import { CodeView } from '@/src/components/CodeView';
import type { SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { formatCount, formatDuration, type GrowthState, type JoinState } from './algorithm';
import styles from './scenes.module.css';

export const JOIN_SQL = 'SELECT *\nFROM orders o\nJOIN customers c ON o.customer_id = c.id';

export const JOIN_CODE = [
  'for o in orders:',
  '    for c in customers:',
  '        if o.customer_id == c.id:',
  '            result.append((o, c))',
];

const SYMBOL = { idle: '', cmp: '=?', match: '✓', miss: '·' } as const;

// Lưới orders × customers: mỗi ô là một lần so sánh của nested loop join.
export function JoinScene({ frame, animate }: SceneProps<JoinState>) {
  const { left, right, grid } = frame.state;
  return (
    <div className={cx(styles.join, !animate && styles.noAnim)} data-testid="join-scene">
      <div className={cx(styles.card, styles.gridCard)}>
        <div className={styles.head}>
          ORDERS × CUSTOMERS: {left.length} × {right.length} = {left.length * right.length} CẶP
        </div>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th />
              {right.map((id, j) => (
                <th key={j} scope="col">
                  id {id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {left.map((cid, i) => (
              <tr key={i}>
                <th scope="row">
                  đơn {i + 1} · {cid}
                </th>
                {right.map((_, j) => {
                  const mark = grid[i][j];
                  return (
                    <td
                      key={j}
                      className={cx(styles.cell, mark !== 'idle' && styles[mark])}
                      data-mark={mark}
                    >
                      {SYMBOL[mark]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.right}>
        {frame.say && (
          <div
            key={frame.say}
            className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
            role="status"
          >
            {frame.say}
          </div>
        )}
        <div className={styles.card}>
          <div className={styles.head}>CÂU SQL</div>
          <pre className={styles.sql}>
            <code>{JOIN_SQL}</code>
          </pre>
        </div>
        <CodeView file="nested_loop_join.py" lines={JOIN_CODE} highlight={frame.codeLines} />
      </div>
    </div>
  );
}

// Bảng so sánh số bước của bốn mức độ phức tạp khi n tăng dần.
export function GrowthScene({ frame, animate }: SceneProps<GrowthState>) {
  const { rows, shown } = frame.state;
  const last = rows[shown - 1];
  return (
    <div className={cx(styles.growth, !animate && styles.noAnim)} data-testid="growth-scene">
      <div className={styles.card}>
        <div className={styles.head}>SỐ BƯỚC KHI DỮ LIỆU LỚN DẦN</div>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>n</th>
                <th>O(1)</th>
                <th>O(log n)</th>
                <th>O(n)</th>
                <th>O(n²)</th>
                <th>O(n²) nếu 1 µs/bước</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, k) => (
                <tr
                  key={r.n}
                  className={cx(k < shown && styles.shown, k === shown - 1 && styles.latest)}
                >
                  <td>{formatCount(r.n)}</td>
                  <td className={styles.good}>{r.constant}</td>
                  <td className={styles.ok}>{r.log}</td>
                  <td className={styles.warn}>{formatCount(r.linear)}</td>
                  <td className={styles.bad}>{formatCount(r.quadratic)}</td>
                  <td className={styles.bad}>{formatDuration(r.quadratic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          {last
            ? `n = ${formatCount(last.n)}: O(n) mất ${formatDuration(last.linear)}, O(n²) mất ${formatDuration(last.quadratic)}.`
            : 'Mỗi hàng là một kích thước bảng. Cột O(log n) là số lần so sánh tệ nhất của binary search.'}
        </p>
      </div>
    </div>
  );
}
