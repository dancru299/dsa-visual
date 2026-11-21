'use client';

import { AnimatePresence, motion, type Variants } from 'motion/react';
import { CodeView } from '@/src/components/CodeView';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { BracketState, StackItem, StackState } from './algorithm';
import styles from './StackScene.module.css';

const SLOT = 46; // khoảng cách giữa hai khối trong ống
const BASE = 7; // khối đầu tiên cách đáy ống

type Swatch = 'lav' | 'sky' | 'mint' | 'sun' | 'peach';

const COLOR: Record<string, Swatch> = {
  A: 'lav',
  B: 'sky',
  C: 'mint',
  D: 'sun',
  '(': 'lav',
  '[': 'sky',
  '{': 'mint',
  'main()': 'peach',
  'run_pipeline()': 'sky',
  'load_table()': 'lav',
  'parse_row()': 'mint',
};

export const colorOf = (label: string): Swatch => COLOR[label] ?? 'lav';

// custom = có chạy hiệu ứng hay không. Khi tua hoặc bật giảm chuyển động, khối hiện ra
// và biến mất ngay, không rơi vào hay bay ra.
const blockVariants: Variants = {
  hidden: (animate: boolean) => (animate ? { y: -260, opacity: 0 } : { y: 0, opacity: 1 }),
  shown: (animate: boolean) => ({
    x: 0,
    y: 0,
    rotate: 0,
    opacity: 1,
    transition: animate ? { type: 'spring', stiffness: 260, damping: 18 } : { duration: 0 },
  }),
  gone: (animate: boolean) =>
    animate
      ? {
          x: 170,
          y: -220,
          rotate: 12,
          opacity: 0,
          transition: { duration: 0.6, ease: [0.55, -0.35, 0.7, 1] },
        }
      : { opacity: 0, transition: { duration: 0 } },
};

const isBracket = (s: StackState): s is BracketState => 'text' in s;

const PLATE = (
  <svg className={styles.plate} viewBox="0 0 300 66" aria-hidden="true">
    <polygon
      points="6,28 6,37 150,63 294,37 294,28 150,54"
      style={{ fill: '#e7dcc8', stroke: 'var(--ink)', strokeWidth: 2.5, strokeLinejoin: 'round' }}
    />
    <polygon
      points="150,2 294,28 150,54 6,28"
      style={{
        fill: 'var(--surface)',
        stroke: 'var(--ink)',
        strokeWidth: 2.5,
        strokeLinejoin: 'round',
      }}
    />
  </svg>
);

function Tube({ state, animate }: { state: StackState; animate: boolean }) {
  const { items, mark } = state;
  const n = items.length;
  return (
    <div className={styles.tubeWrap}>
      {PLATE}
      <div className={styles.tube} data-testid="stack-tube">
        <AnimatePresence custom={animate} initial={false}>
          {items.map((it: StackItem, i) => (
            <motion.div
              key={it.id}
              className={cx(
                styles.blk,
                styles[colorOf(it.label)],
                mark?.id === it.id && styles[mark.kind],
              )}
              style={{ bottom: BASE + i * SLOT }}
              custom={animate}
              variants={blockVariants}
              initial="hidden"
              animate="shown"
              exit="gone"
            >
              <span>{it.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div
        className={cx(styles.topPtr, n === 0 && styles.empty)}
        style={{ bottom: BASE + 10 + Math.max(n - 1, 0) * SLOT }}
      >
        <i />
        <span>{n ? 'top' : 'top: rỗng'}</span>
      </div>
      <div className={styles.cap}>stack · phần tử mới nằm trên cùng</div>
    </div>
  );
}

function Tokens({ state }: { state: BracketState }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        CHUỖI ĐẦU VÀO <code>s = &quot;{state.text}&quot;</code>
      </div>
      <div className={styles.tokens}>
        {[...state.text].map((ch, i) => {
          const t = state.tokens[i];
          return (
            <span
              key={i}
              className={cx(
                styles.tk,
                t.kind === 'open' && styles.open,
                t.kind === 'matched' && styles[colorOf(t.opener)],
                t.kind === 'bad' && styles.bad,
                state.cursor === i && styles.cur,
              )}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

type Options = {
  file: string;
  code: readonly string[];
  tray?: string; // tiêu đề khay chứa các phần tử đã lấy ra; bỏ trống thì không hiện khay
};

// Scene "ống stack" cho các bước của bài Stack. Gọi ở cấp module, không gọi trong lúc render.
export function stackScene({ file, code, tray }: Options): SceneComponent<StackState> {
  function StackScene({ frame, animate }: SceneProps<StackState>) {
    const { state } = frame;
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)}>
        <div className={styles.left}>
          <Tube state={state} animate={animate} />
        </div>
        <div className={styles.right}>
          {isBracket(state) && <Tokens state={state} />}
          {frame.say && (
            <div
              key={frame.say}
              className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
              role="status"
            >
              {frame.say}
            </div>
          )}
          <CodeView file={file} lines={code} highlight={frame.codeLines} />
          {tray && (
            <div className={styles.card}>
              <div className={styles.head}>{tray}</div>
              <div className={styles.tray}>
                {state.popped.map((it) => (
                  <span key={it.id} className={cx(styles.chip, styles[colorOf(it.label)])}>
                    {it.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return StackScene;
}
