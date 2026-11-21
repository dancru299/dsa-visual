'use client';

import { motion } from 'motion/react';
import { Fragment } from 'react';
import { CodeView } from '@/src/components/CodeView';
import { Instant } from '@/src/components/Instant';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { Entry, HashState, Pos } from './algorithm';
import styles from './scenes.module.css';

type Options = {
  code: { file: string; lines: readonly string[] };
  sql?: string;
  valueLabel?: string; // ví dụ "count": hiện giá trị cạnh key
};

const same = (p: Pos | null, bucket: number, index: number) =>
  p !== null && p.bucket === bucket && p.index === index;

// Phép tính hash hiện thành chữ: "97 + 110 = 207", rồi "207 % 8 = 7".
function Probe({ state }: { state: HashState }) {
  const p = state.probe;
  return (
    <div className={styles.card}>
      <div className={styles.head}>HÀM HASH: TỔNG MÃ KÝ TỰ, RỒI LẤY DƯ CHO SỐ NGĂN</div>
      {p ? (
        <div className={styles.probe}>
          <span className={styles.probeKey}>&quot;{p.key}&quot;</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.calc}>
            {[...p.key].map((c) => c.charCodeAt(0)).join(' + ')} = {p.hash}
          </span>
          <span className={styles.arrow}>→</span>
          <span className={styles.calc}>
            {p.hash} % {state.m} =
          </span>
          <span className={styles.bucketNo}>ngăn {p.bucket}</span>
        </div>
      ) : (
        <div className={styles.probeEmpty}>(chưa hash key nào)</div>
      )}
    </div>
  );
}

function Table({
  title,
  buckets,
  state,
  valueLabel,
  live,
}: {
  title: string;
  buckets: Entry[][];
  state: HashState;
  valueLabel?: string;
  live: boolean; // bảng đang dùng (không phải bảng cũ lúc resize)
}) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span>{title}</span>
        <span className={styles.muted}>{buckets.length} ngăn</span>
      </div>
      <div className={styles.rows}>
        {buckets.map((chain, b) => (
          <div
            key={b}
            className={cx(
              styles.row,
              live && state.probe?.bucket === b && styles.probed,
              live && state.missBucket === b && styles.missed,
            )}
            data-bucket={b}
          >
            <span className={styles.idx}>{b}</span>
            <div className={styles.chain}>
              {chain.map((e, i) => (
                <Fragment key={e.id}>
                  {i > 0 && <span className={styles.link}>→</span>}
                  <motion.span
                    layoutId={`hash-${e.id}`}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cx(
                      styles.entry,
                      live && same(state.cursor, b, i) && styles.cursor,
                      live && same(state.hit, b, i) && styles.hit,
                    )}
                  >
                    {e.key}
                    {valueLabel && (
                      <small>
                        {valueLabel} {e.value}
                      </small>
                    )}
                  </motion.span>
                </Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function hashScene({ code, sql, valueLabel }: Options): SceneComponent<HashState> {
  function HashScene({ frame, animate }: SceneProps<HashState>) {
    const s = frame.state;
    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="hash-scene">
          <div className={styles.main}>
            <Probe state={s} />
            <div className={styles.tables}>
              {s.old && (
                <Table
                  title="BẢNG CŨ"
                  buckets={s.old}
                  state={s}
                  valueLabel={valueLabel}
                  live={false}
                />
              )}
              <Table
                title={s.old ? 'BẢNG MỚI' : 'HASH TABLE'}
                buckets={s.buckets}
                state={s}
                valueLabel={valueLabel}
                live
              />
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
            {sql && (
              <div className={styles.card}>
                <div className={styles.head}>CÂU SQL</div>
                <pre className={styles.sql}>
                  <code>{sql}</code>
                </pre>
              </div>
            )}
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        </div>
      </Instant>
    );
  }
  return HashScene;
}
