'use client';

import { AnimatePresence, motion, type Variants } from 'motion/react';
import { CodeView } from '@/src/components/CodeView';
import { Instant } from '@/src/components/Instant';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { parentOf, rootOf, sizeOf, type HeapState } from './algorithm';
import styles from './scenes.module.css';

const LEVEL_H = 70; // khoảng cách giữa hai tầng của cây, tính bằng px
const TOP = 30;

// Vị trí của index i trong cây nhị phân đầy đủ: x theo %, y theo px.
function slotOf(i: number) {
  const level = Math.floor(Math.log2(i + 1));
  const first = 2 ** level - 1;
  const count = 2 ** level;
  return { x: ((i - first + 0.5) / count) * 100, y: TOP + level * LEVEL_H };
}

// custom = có chạy hiệu ứng hay không. Khi tua, node hiện ra và biến mất ngay.
const nodeVariants: Variants = {
  hidden: (animate: boolean) => (animate ? { scale: 0.4, opacity: 0 } : { scale: 1, opacity: 1 }),
  shown: { scale: 1, opacity: 1 },
  gone: (animate: boolean) =>
    animate
      ? { y: -36, scale: 0.6, opacity: 0, transition: { duration: 0.35 } }
      : { opacity: 0, transition: { duration: 0 } },
};

type Options = {
  title: string;
  code: { file: string; lines: readonly string[] };
  slots: number; // số ô của cây cần chừa chỗ, kể cả ô chưa có phần tử
  outTitle?: string;
};

export function heapScene({ title, code, slots, outTitle }: Options): SceneComponent<HeapState> {
  const levels = Math.floor(Math.log2(Math.max(1, slots))) + 1;
  const height = TOP * 2 + (levels - 1) * LEVEL_H;

  function HeapScene({ frame, animate }: SceneProps<HeapState>) {
    const s = frame.state;
    const n = Math.max(slots, s.heap.length);
    const pos = (i: number) => {
      const { x, y } = slotOf(i);
      return {
        left: `calc(${x.toFixed(3)}% - var(--node) / 2)`,
        top: `calc(${y}px - var(--node) / 2)`,
      };
    };

    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="heap-scene">
          <div className={styles.main}>
            <div className={styles.card}>
              <div className={styles.head}>
                <span>{title}</span>
                <span className={styles.muted}>
                  {sizeOf(s)} phần tử · gốc = {rootOf(s)?.value ?? '—'}
                </span>
              </div>
              <div className={styles.tree} style={{ height }}>
                <svg
                  className={styles.edges}
                  viewBox={`0 0 100 ${height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {Array.from({ length: n }, (_, i) => i)
                    .filter((i) => i > 0)
                    .map((i) => {
                      const a = slotOf(parentOf(i));
                      const b = slotOf(i);
                      return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                    })}
                </svg>
                {Array.from({ length: n }, (_, i) => (
                  <span key={`slot-${i}`} className={styles.slot} style={pos(i)} />
                ))}
                <AnimatePresence custom={animate} initial={false}>
                  {s.heap.map((node, i) => (
                    <motion.div
                      key={node.id}
                      layout
                      custom={animate}
                      variants={nodeVariants}
                      initial="hidden"
                      animate="shown"
                      exit="gone"
                      className={cx(
                        styles.node,
                        i === 0 && styles.isRoot,
                        i === 0 && s.lifted && styles.lifted,
                        s.focus.includes(i) && styles.focus,
                        s.swapped.includes(i) && styles.swapped,
                      )}
                      style={pos(i)}
                      data-index={i}
                    >
                      {node.value}
                      {node.tag && <span className={styles.tag}>{node.tag}</span>}
                      <span className={styles.idx}>[{i}]</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.head}>
                <span>CÙNG HEAP ĐÓ, LÀ MỘT MẢNG</span>
                <span className={styles.muted}>con của i: 2i + 1, 2i + 2</span>
              </div>
              <div className={styles.strip}>
                {Array.from({ length: n }, (_, i) => {
                  const node = s.heap[i];
                  return (
                    <div key={i} className={styles.cellBox}>
                      {node && (
                        <motion.span
                          layoutId={`heap-arr-${node.id}`}
                          className={cx(
                            styles.chip,
                            i === 0 && s.lifted && styles.lifted,
                            s.focus.includes(i) && styles.focus,
                            s.swapped.includes(i) && styles.swapped,
                          )}
                        >
                          {node.value}
                        </motion.span>
                      )}
                      <span className={styles.idx}>[{i}]</span>
                    </div>
                  );
                })}
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
            {s.stream && (
              <div className={styles.card}>
                <div className={styles.head}>
                  <span>DÒNG DỮ LIỆU</span>
                  <span className={styles.muted}>giữ top {s.k}</span>
                </div>
                <div className={styles.stream}>
                  {s.stream.map((v, i) => (
                    <span
                      key={i}
                      className={cx(
                        styles.item,
                        s.cursor === i && styles.cur,
                        s.cursor !== null && i < s.cursor && styles.past,
                        s.skipped.includes(i) && styles.skipped,
                      )}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {s.lists && s.heads && (
              <div className={styles.card}>
                <div className={styles.head}>
                  <span>CÁC DÃY ĐÃ SORT</span>
                  <span className={styles.muted}>{s.lists.length} dãy</span>
                </div>
                {s.lists.map((l, li) => {
                  // Đã ra: các phần tử đầu đã bị lấy khỏi heap. Trong heap: đã đưa vào nhưng chưa ra.
                  const emitted = s.out.filter((o) => o.tag === l.tag).length;
                  const pushed = s.heads![li];
                  return (
                    <div key={l.tag} className={styles.listRow}>
                      <span className={styles.listTag}>{l.tag}</span>
                      <div className={styles.stream}>
                        {l.values.map((v, vi) => (
                          <span
                            key={vi}
                            className={cx(
                              styles.item,
                              vi < emitted && styles.past,
                              vi >= emitted && vi < pushed && styles.inHeap,
                            )}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {outTitle && (
              <div className={styles.card}>
                <div className={styles.head}>{outTitle}</div>
                <div className={styles.tray}>
                  {s.out.map((node) => (
                    <span key={node.id} className={styles.out}>
                      {node.value}
                      {node.tag && <span className={styles.outTag}>{node.tag}</span>}
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
  return HeapScene;
}
