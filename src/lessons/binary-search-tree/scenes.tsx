'use client';

import { AnimatePresence, motion, type Variants } from 'motion/react';
import { CodeView } from '@/src/components/CodeView';
import { Instant } from '@/src/components/Instant';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { BstState } from './algorithm';
import styles from './scenes.module.css';

const LEVEL_H = 60; // khoảng cách giữa hai tầng, tính bằng px
const TOP = 28;

// custom = có chạy hiệu ứng hay không. Khi tua, node hiện ra ngay.
const nodeVariants: Variants = {
  hidden: (animate: boolean) => (animate ? { scale: 0.3, opacity: 0 } : { scale: 1, opacity: 1 }),
  shown: { scale: 1, opacity: 1 },
};

type Options = {
  title: string;
  code: { file: string; lines: readonly string[] };
  // Mọi khoá sẽ xuất hiện trong bước này. Vị trí ngang theo thứ tự tăng dần của chúng, nên khoá
  // chèn thêm không làm các node khác xê dịch.
  universe: readonly number[];
  levels: number; // số tầng cần chừa chỗ
  outTitle?: string;
};

export function bstScene({
  title,
  code,
  universe,
  levels,
  outTitle,
}: Options): SceneComponent<BstState> {
  const sorted = [...universe].sort((a, b) => a - b);
  const height = TOP * 2 + (levels - 1) * LEVEL_H;
  // Tâm của node: x theo % (làm tròn để HTML từ server và trình duyệt giống hệt), y theo px.
  const xOf = (key: number) => ((sorted.indexOf(key) + 0.5) / sorted.length) * 100;
  const yOf = (depth: number) => TOP + depth * LEVEL_H;
  const box = (key: number, depth: number) => ({
    left: `calc(${xOf(key).toFixed(3)}% - var(--node) / 2)`,
    top: `calc(${yOf(depth)}px - var(--node) / 2)`,
  });

  function BstScene({ frame, animate }: SceneProps<BstState>) {
    const s = frame.state;
    const depthOf = new Map(s.nodes.map((n) => [n.key, n.depth]));
    const pruned = new Set(s.pruned);
    const head =
      s.range !== null
        ? `khoảng [${s.range[0]}, ${s.range[1]}]`
        : s.target !== null
          ? `khoá: ${s.target}`
          : `${s.nodes.length} node`;

    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="bst-scene">
          <div className={styles.main}>
            <div className={styles.card}>
              <div className={styles.head}>
                <span>{title}</span>
                <span className={styles.muted}>{head}</span>
              </div>
              <div className={styles.tree} style={{ height }}>
                <svg
                  className={styles.edges}
                  viewBox={`0 0 100 ${height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {s.nodes
                    .filter((n) => n.parent !== null)
                    .map((n) => (
                      <line
                        key={n.key}
                        className={cx(pruned.has(n.key) && styles.faded)}
                        x1={xOf(n.parent!)}
                        y1={yOf(n.depth - 1)}
                        x2={xOf(n.key)}
                        y2={yOf(n.depth)}
                      />
                    ))}
                  {s.spot && (
                    <line
                      className={styles.dashed}
                      x1={xOf(s.spot.parent)}
                      y1={yOf(depthOf.get(s.spot.parent)!)}
                      x2={xOf(s.spot.key)}
                      y2={yOf(depthOf.get(s.spot.parent)! + 1)}
                    />
                  )}
                </svg>
                {s.spot && (
                  <span
                    className={styles.spot}
                    style={box(s.spot.key, depthOf.get(s.spot.parent)! + 1)}
                    data-testid="bst-spot"
                  >
                    {s.spot.key}
                  </span>
                )}
                <AnimatePresence custom={animate} initial={false}>
                  {s.nodes.map((n) => (
                    <motion.div
                      key={n.key}
                      layout
                      custom={animate}
                      variants={nodeVariants}
                      initial="hidden"
                      animate="shown"
                      className={cx(
                        styles.node,
                        s.path.includes(n.key) && styles.path,
                        s.out.includes(n.key) && styles.out,
                        s.found === n.key && styles.found,
                        s.current === n.key && styles.current,
                        pruned.has(n.key) && styles.pruned,
                      )}
                      style={box(n.key, n.depth)}
                      data-key={n.key}
                    >
                      {n.key}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {frame.say && (
              <div
                key={frame.say}
                className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
                role="status"
              >
                {frame.say}
              </div>
            )}
          </div>

          <div className={styles.side}>
            <div className={styles.card}>
              <div className={styles.head}>ĐƯỜNG ĐI TỪ GỐC</div>
              <div className={styles.chips}>
                {s.path.map((k, i) => (
                  <span key={`${k}-${i}`} className={styles.chip}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
            {outTitle && (
              <div className={styles.card}>
                <div className={styles.head}>{outTitle}</div>
                <div className={styles.chips}>
                  {s.out.map((k) => (
                    <span key={k} className={cx(styles.chip, styles.outChip)}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        </div>
      </Instant>
    );
  }
  return BstScene;
}
