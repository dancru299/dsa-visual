'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { CodeView } from '@/src/components/CodeView';
import { Instant } from '@/src/components/Instant';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { Record_, UFState } from './algorithm';
import { forestLayout, heightFor, R, yOf } from './layout';
import styles from './scenes.module.css';

type Options = {
  title: string;
  code: { file: string; lines: readonly string[] };
  width: number; // bề ngang viewBox lớn nhất trong bước
  levels: number; // số tầng lớn nhất trong bước
  records?: readonly Record_[]; // bước gộp bản ghi: bảng bản ghi bên cạnh
};

// Rừng cây: mỗi nhóm là một cây, mũi tên chỉ từ phần tử lên parent của nó. Bên dưới là chính
// mảng parent, thứ thật sự được lưu.
export function forestScene({
  title,
  code,
  width,
  levels,
  records,
}: Options): SceneComponent<UFState> {
  const height = heightFor(levels);

  function ForestScene({ frame, animate }: SceneProps<UFState>) {
    const s = frame.state;
    const { pos, width: used } = forestLayout(s.parent);
    const dx = (width - used) / 2;
    const arrow = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-up`;
    const groups = s.parent.filter((p, i) => p === i).length;
    const inPair = (i: number) => s.pair !== null && s.pair.includes(i);

    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="forest-scene">
          <div className={styles.main}>
            <div className={cx(styles.card, styles.treeCard)}>
              <div className={styles.head}>
                <span>{title}</span>
                <span className={styles.muted}>
                  {s.parent.length} phần tử · {groups} nhóm
                </span>
              </div>
              <svg
                className={styles.svg}
                viewBox={`0 0 ${width} ${height}`}
                style={{ maxWidth: width * 1.2 }}
                role="img"
                aria-label={`${groups} nhóm, mảng parent: ${s.parent.join(', ')}`}
              >
                <defs>
                  <marker
                    id={arrow}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerUnits="userSpaceOnUse"
                    markerWidth="9"
                    markerHeight="9"
                    orient="auto"
                  >
                    <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHead} />
                  </marker>
                </defs>
                {s.parent.map((p, i) => {
                  if (p === i) return null;
                  const a = pos.get(i)!;
                  const b = pos.get(p)!;
                  const ax = dx + a.x;
                  const ay = yOf(a.depth);
                  const bx = dx + b.x;
                  const by = yOf(b.depth);
                  const len = Math.hypot(bx - ax, by - ay);
                  // Mũi tên từ mép node con tới mép node cha.
                  const ux = (bx - ax) / len;
                  const uy = (by - ay) / len;
                  return (
                    <line
                      key={`e${i}`}
                      className={cx(styles.edge, s.changed === i && styles.edgeNew)}
                      x1={ax + ux * R}
                      y1={ay + uy * R}
                      x2={bx - ux * (R + 2)}
                      y2={by - uy * (R + 2)}
                      markerEnd={`url(#${arrow})`}
                    />
                  );
                })}
                {s.parent.map((p, i) => {
                  const q = pos.get(i)!;
                  return (
                    <motion.g
                      key={`n${i}`}
                      initial={false}
                      animate={{ x: dx + q.x, y: yOf(q.depth) }}
                      data-node={i}
                    >
                      {inPair(i) && <circle r={R + 5} className={styles.pairRing} />}
                      <circle
                        r={R}
                        className={cx(
                          styles.node,
                          p === i && styles.isRoot,
                          s.path.includes(i) && styles.path,
                          s.current === i && styles.current,
                          s.changed === i && styles.changed,
                        )}
                      />
                      <text className={styles.label} textAnchor="middle" dominantBaseline="central">
                        {s.labels[i]}
                      </text>
                    </motion.g>
                  );
                })}
              </svg>
              <div className={styles.arrayHead}>mảng parent</div>
              <div
                className={styles.array}
                style={{ gridTemplateColumns: `repeat(${s.parent.length}, minmax(0, 1fr))` }}
              >
                {s.parent.map((p, i) => (
                  <div
                    key={i}
                    className={cx(
                      styles.cell,
                      p === i && styles.cellRoot,
                      s.changed === i && styles.cellChanged,
                      s.current === i && styles.cellCurrent,
                    )}
                  >
                    <span className={styles.cellIdx}>{s.labels[i]}</span>
                    <span className={styles.cellVal}>{s.labels[p]}</span>
                  </div>
                ))}
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
            {records && (
              <div className={styles.card}>
                <div className={styles.head}>
                  <span>BẢN GHI TỪ CÁC HỆ THỐNG</span>
                </div>
                <table className={styles.table}>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.id} className={cx(inPair(i) && styles.rowOn)}>
                        <td>
                          <b>{r.id}</b>
                        </td>
                        <td>{r.email}</td>
                        <td>{r.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        </div>
      </Instant>
    );
  }
  return ForestScene;
}
