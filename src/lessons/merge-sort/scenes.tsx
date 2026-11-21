import { CodeView } from '@/src/components/CodeView';
import type { Frame, SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { formatCount, formatDuration } from '../big-o/algorithm';
import type { CostState, JoinState, MergeState } from './algorithm';
import styles from './scenes.module.css';

type CodeOpt = { file: string; lines: readonly string[] };

function Say({ frame }: { frame: Frame<unknown> }) {
  if (!frame.say) return null;
  return (
    <div
      key={frame.say}
      className={cx(styles.say, frame.sayTone === 'good' && styles.good)}
      role="status"
    >
      {frame.say}
    </div>
  );
}

// ---------- Cây theo tầng ----------

export function treeScene({
  title,
  code,
}: {
  title: string;
  code?: CodeOpt;
}): SceneComponent<MergeState> {
  function TreeScene({ frame, animate }: SceneProps<MergeState>) {
    const { rows, active } = frame.state;
    const pointerOf = (r: number, g: number): number | null => {
      if (!active || r !== active.row + 1) return null;
      if (g === 2 * active.group) return active.i;
      if (g === 2 * active.group + 1) return active.j;
      return null;
    };
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="tree-scene">
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span>{title}</span>
              <span className={styles.muted}>{rows.length} tầng</span>
            </div>
            <div className={styles.rows}>
              {rows.map((row, r) => (
                <div key={r} className={styles.row} data-row={r}>
                  {row.map((g, gi) => {
                    const isTarget = active?.row === r && active.group === gi;
                    const pointer = pointerOf(r, gi);
                    const isSource = pointer !== null;
                    const complete = g.values.length === g.size && g.size > 0;
                    return (
                      <div
                        key={gi}
                        className={cx(
                          styles.group,
                          g.size === 1 && !isSource && styles.single,
                          isTarget && styles.target,
                          isSource && styles.source,
                        )}
                      >
                        {Array.from({ length: g.size }, (_, k) => {
                          const v = g.values[k];
                          const filled = v !== undefined;
                          return (
                            <span
                              key={k}
                              className={cx(
                                styles.cell,
                                !filled && styles.empty,
                                isSource && k < pointer! && styles.consumed,
                                isSource && k === pointer && styles.pointer,
                                isTarget && k === g.values.length - 1 && styles.newest,
                                !isTarget &&
                                  !isSource &&
                                  complete &&
                                  r < rows.length - 1 &&
                                  styles.sorted,
                              )}
                            >
                              {filled ? v : '·'}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <Say frame={frame} />
        </div>
        {code && (
          <div className={styles.side}>
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        )}
      </div>
    );
  }
  return TreeScene;
}

// ---------- Sort-merge join ----------

export function joinScene({ code }: { code: CodeOpt }): SceneComponent<JoinState> {
  function JoinScene({ frame, animate }: SceneProps<JoinState>) {
    const { left, right, i, j, pairs } = frame.state;
    const matchedL = new Set(pairs.map((p) => p[0]));
    const matchedR = new Set(pairs.map((p) => p[1]));
    const lane = (
      label: string,
      values: number[],
      at: number,
      matched: Set<number>,
      name: string,
    ) => (
      <div className={styles.lane}>
        <span className={styles.laneLabel}>{label}</span>
        <div className={styles.laneCells}>
          {values.map((v, k) => (
            <span
              key={k}
              className={cx(
                styles.laneCell,
                k < at && styles.done,
                matched.has(k) && styles.matched,
                k === at && styles.here,
              )}
            >
              {v}
              {k === at && <span className={styles.ptr}>↑ {name}</span>}
            </span>
          ))}
        </div>
      </div>
    );
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="join-scene">
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span>HAI BẢNG ĐÃ SORT THEO KHOÁ</span>
              <span className={styles.muted}>{pairs.length} cặp khớp</span>
            </div>
            {lane('orders.customer_id', left, i, matchedL, 'i')}
            {lane('customers.id', right, j, matchedR, 'j')}
          </div>
          <Say frame={frame} />
          <div className={styles.card}>
            <div className={styles.head}>KẾT QUẢ JOIN</div>
            <div className={styles.pairs}>
              {pairs.map(([a, b]) => (
                <span key={`${a}-${b}`} className={styles.pair}>
                  đơn #{a + 1} ↔ khách {right[b]}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.side}>
          <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
        </div>
      </div>
    );
  }
  return JoinScene;
}

// ---------- Bảng chi phí ----------

// Số không phải luỹ thừa của 10 thì in gần đúng, ví dụ 2,0 × 10⁷.
export function approx(v: number): string {
  if (v < 1_000_000) return Math.round(v).toLocaleString('vi-VN');
  const k = Math.floor(Math.log10(v));
  const m = v / 10 ** k;
  return Math.abs(m - 1) < 1e-9
    ? formatCount(v)
    : `${m.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} × ${formatCount(10 ** k)}`;
}

export function CostScene({ frame, animate }: SceneProps<CostState>) {
  const { rows, shown } = frame.state;
  const last = rows[shown - 1];
  return (
    <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="cost-scene">
      <div className={styles.main}>
        <div className={styles.card}>
          <div className={styles.head}>SỐ BƯỚC ĐỂ SORT n PHẦN TỬ</div>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>n</th>
                  <th>n log₂ n</th>
                  <th>n²</th>
                  <th>n log₂ n, 1 µs/bước</th>
                  <th>n², 1 µs/bước</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, k) => (
                  <tr
                    key={r.n}
                    className={cx(k < shown && styles.shown, k === shown - 1 && styles.latest)}
                  >
                    <td>{formatCount(r.n)}</td>
                    <td className={styles.good}>{approx(r.nlogn)}</td>
                    <td className={styles.bad}>{formatCount(r.n2)}</td>
                    <td className={styles.good}>{formatDuration(r.nlogn)}</td>
                    <td className={styles.bad}>{formatDuration(r.n2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            {last
              ? `n = ${formatCount(last.n)}: merge sort khoảng ${formatDuration(last.nlogn)}, cách so mọi cặp khoảng ${formatDuration(last.n2)}.`
              : 'Mỗi hàng là một kích thước dữ liệu.'}
          </p>
        </div>
        <Say frame={frame} />
      </div>
    </div>
  );
}
