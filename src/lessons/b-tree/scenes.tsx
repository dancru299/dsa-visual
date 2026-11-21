'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CodeView } from '@/src/components/CodeView';
import { Instant } from '@/src/components/Instant';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { MAX_KEYS, type BState } from './algorithm';
import { CELL, heightFor, layout, NODE_H, PAD, topOf } from './layout';
import styles from './scenes.module.css';

type Options = {
  title: string;
  code: { file: string; lines: readonly string[] };
  width: number; // bề ngang viewBox: lớn nhất trong mọi frame của bước, để hình không co giãn
  levels: number; // số tầng lớn nhất trong bước
};

// Cây vẽ bằng SVG: mỗi khoá là một ô riêng, có id là chính giá trị khoá. Khi node tách, ô khoá
// ở giữa trượt từ node con lên node cha.
export function btreeScene({ title, code, width, levels }: Options): SceneComponent<BState> {
  const height = heightFor(levels);

  function BTreeScene({ frame, animate }: SceneProps<BState>) {
    const s = frame.state;
    const { placed, width: used } = layout(s.root, s.nodes);
    const dx = (width - used) / 2; // canh giữa cây trong khung
    const list = [...placed.values()];
    const enter = animate ? { opacity: 0, scale: 0.5 } : false;

    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="btree-scene">
          <div className={styles.main}>
            <div className={cx(styles.card, styles.treeCard)}>
              <div className={styles.head}>
                <span>{title}</span>
                <span className={styles.muted}>
                  {s.target !== null ? `khoá: ${s.target} · ` : ''}tối đa {MAX_KEYS} khoá mỗi node
                </span>
              </div>
              <svg
                className={styles.svg}
                viewBox={`0 0 ${width} ${height}`}
                style={{ maxWidth: width * 1.5 }}
                role="img"
                aria-label={`B-tree ${list.length} node, gốc chứa ${placed.get(s.root)!.keys.join(', ')}`}
              >
                {list.flatMap((p) =>
                  p.children.map((c, i) => {
                    const child = placed.get(c)!;
                    const onPath = s.path.includes(p.id) && s.path.includes(c);
                    return (
                      <line
                        key={`${p.id}-${c}`}
                        className={cx(styles.edge, onPath && styles.edgeOn)}
                        x1={dx + p.left + PAD + i * CELL}
                        y1={topOf(p.depth) + NODE_H}
                        x2={dx + child.left + child.width / 2}
                        y2={topOf(child.depth)}
                      />
                    );
                  }),
                )}

                <AnimatePresence initial={false}>
                  {list.map((p) => (
                    <motion.g
                      key={`n${p.id}`}
                      initial={enter}
                      animate={{ x: dx + p.left, y: topOf(p.depth), opacity: 1, scale: 1 }}
                    >
                      <rect
                        className={cx(
                          styles.node,
                          s.path.includes(p.id) && styles.path,
                          s.current === p.id && styles.current,
                          s.overflow === p.id && styles.overflow,
                        )}
                        width={p.width}
                        height={NODE_H}
                        rx={9}
                      />
                    </motion.g>
                  ))}
                  {list.flatMap((p) =>
                    p.keys.map((k, j) => (
                      <motion.g
                        key={`k${k}`}
                        initial={enter}
                        animate={{
                          x: dx + p.left + PAD + j * CELL,
                          y: topOf(p.depth),
                          opacity: 1,
                          scale: 1,
                        }}
                        data-key={k}
                      >
                        <rect
                          className={cx(
                            styles.key,
                            (s.hit === k || s.fresh === k) && styles.good,
                            s.promoted === k && styles.up,
                          )}
                          x={2}
                          y={5}
                          width={CELL - 4}
                          height={NODE_H - 10}
                          rx={5}
                        />
                        <text
                          className={styles.label}
                          x={CELL / 2}
                          y={NODE_H / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {k}
                        </text>
                      </motion.g>
                    )),
                  )}
                </AnimatePresence>
              </svg>
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
              <div className={styles.head}>
                <span>NODE ĐÃ ĐỌC TỪ GỐC</span>
                <span className={styles.muted}>{s.path.length} node</span>
              </div>
              <div className={styles.chips}>
                {s.path.map((id) => (
                  <span key={id} className={styles.chip}>
                    [{(s.nodes.find((n) => n.id === id)?.keys ?? []).join(', ')}]
                  </span>
                ))}
              </div>
            </div>
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        </div>
      </Instant>
    );
  }
  return BTreeScene;
}
