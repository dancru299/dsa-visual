'use client';

import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import { CodeView } from '@/src/components/CodeView';
import type { Frame, SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { tailOf, type Item, type QueueState, type RingState, type ShiftState } from './algorithm';
import styles from './scenes.module.css';

const PALETTE = ['lav', 'sky', 'mint', 'sun', 'peach', 'rose'] as const;
const colorOf = (it: Item) => styles[PALETTE[it.id % PALETTE.length]];

// custom = có chạy hiệu ứng hay không. Khi tua hoặc bật giảm chuyển động, khối hiện và mất ngay.
const laneVariants: Variants = {
  hidden: (animate: boolean) => (animate ? { x: 80, opacity: 0 } : { x: 0, opacity: 1 }),
  shown: { x: 0, opacity: 1 },
  gone: (animate: boolean) =>
    animate
      ? { x: -80, opacity: 0, transition: { duration: 0.45 } }
      : { opacity: 0, transition: { duration: 0 } },
};

// Khi không chạy hiệu ứng, mọi chuyển động của Motion (kể cả layout) kết thúc ngay.
const Instant = ({ animate, children }: { animate: boolean; children: ReactNode }) => (
  <MotionConfig
    transition={animate ? { type: 'spring', stiffness: 320, damping: 28 } : { duration: 0 }}
  >
    {children}
  </MotionConfig>
);

function Say({ frame }: { frame: Frame<unknown> }) {
  if (!frame.say) return null;
  return (
    <div
      key={frame.say}
      className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
      role="status"
    >
      {frame.say}
    </div>
  );
}

function Tray({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>{title}</div>
      <div className={styles.tray}>
        {items.map((it) => (
          <span key={it.id} className={cx(styles.chip, colorOf(it))}>
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type CodeOpt = { file: string; lines: readonly string[] };

// ---------- Băng chuyền queue ----------

export function queueScene({ code }: { code: CodeOpt }): SceneComponent<QueueState> {
  function QueueScene({ frame, animate }: SceneProps<QueueState>) {
    const { items, out } = frame.state;
    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="queue-scene">
          <div className={styles.main}>
            <div className={styles.card}>
              <div className={styles.head}>
                <span>← RA Ở ĐẦU (FRONT)</span>
                <span>VÀO Ở CUỐI (BACK) ←</span>
              </div>
              <div className={styles.lane} style={{ paddingTop: 26 }}>
                <AnimatePresence mode="popLayout" initial={false} custom={animate}>
                  {items.map((it, i) => (
                    <motion.div
                      key={it.id}
                      layout
                      custom={animate}
                      variants={laneVariants}
                      initial="hidden"
                      animate="shown"
                      exit="gone"
                      className={cx(
                        styles.blk,
                        colorOf(it),
                        i === 0 && styles.front,
                        i === items.length - 1 && styles.back,
                      )}
                    >
                      {it.label}
                      {i === 0 && <span className={styles.tag}>front</span>}
                      {i === items.length - 1 && i !== 0 && (
                        <span className={styles.tag}>back</span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <Say frame={frame} />
            <Tray title="ĐÃ LẤY RA (THEO THỨ TỰ)" items={out} />
          </div>
          <div className={styles.side}>
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        </div>
      </Instant>
    );
  }
  return QueueScene;
}

// ---------- list.pop(0): dời từng phần tử ----------

export function shiftScene({ code }: { code: CodeOpt }): SceneComponent<ShiftState> {
  function ShiftScene({ frame, animate }: SceneProps<ShiftState>) {
    const { slots, removed, moves } = frame.state;
    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="shift-scene">
          <div className={styles.main}>
            <div className={styles.card}>
              <div className={styles.head}>
                <span>
                  LIST TRONG BỘ NHỚ <code>events</code>
                </span>
                <span className={styles.muted}>đã dời: {moves}</span>
              </div>
              <div className={styles.cells}>
                {slots.map((it, i) => (
                  <div key={i} className={styles.cell}>
                    {it && (
                      <motion.div
                        layoutId={`shift-${it.id}`}
                        className={cx(styles.blk, colorOf(it))}
                      >
                        {it.label}
                      </motion.div>
                    )}
                    <span className={styles.idx}>[{i}]</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.head}>
                GIÁ TRỊ <code>pop(0)</code> TRẢ VỀ
              </div>
              <div className={styles.removedBox}>
                {removed ? (
                  <motion.div
                    layoutId={`shift-${removed.id}`}
                    className={cx(styles.blk, colorOf(removed))}
                  >
                    {removed.label}
                  </motion.div>
                ) : (
                  <span className={styles.slotHole} />
                )}
              </div>
            </div>
            <Say frame={frame} />
          </div>
          <div className={styles.side}>
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
          </div>
        </div>
      </Instant>
    );
  }
  return ShiftScene;
}

// ---------- Ring buffer ----------

// Bán kính tính theo phần trăm của khung vòng, để vòng co lại được trên màn hình hẹp.
const RADIUS_PCT = 40;
const SLOT_W = 56;
const SLOT_H = 52;

const slotVariants: Variants = {
  hidden: (animate: boolean) => (animate ? { scale: 0.4, opacity: 0 } : { scale: 1, opacity: 1 }),
  shown: { scale: 1, opacity: 1 },
  gone: (animate: boolean) =>
    animate
      ? { scale: 0.4, opacity: 0, transition: { duration: 0.3 } }
      : { opacity: 0, transition: { duration: 0 } },
};

export function ringScene({
  code,
  roles,
}: {
  code: CodeOpt;
  roles: boolean;
}): SceneComponent<RingState> {
  function RingScene({ frame, animate }: SceneProps<RingState>) {
    const s = frame.state;
    const tail = tailOf(s);
    const producer = s.waiting ? 'blocked' : s.actor === 'producer' ? 'active' : 'idle';
    const consumer = s.actor === 'consumer' ? 'active' : 'idle';

    return (
      <Instant animate={animate}>
        <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="ring-scene">
          <div className={styles.main}>
            <div className={styles.card}>
              <div className={styles.head}>
                <span>RING BUFFER</span>
                <span className={styles.muted}>
                  head = {s.head} · tail = {tail} · size = {s.size}/{s.capacity}
                </span>
              </div>
              <div className={styles.ringWrap}>
                <div className={styles.ringTrack} />
                <div className={styles.ringCenter}>
                  <span>
                    <b>
                      {s.size}/{s.capacity}
                    </b>
                    {s.size === s.capacity ? 'đầy' : s.size === 0 ? 'rỗng' : 'đang dùng'}
                  </span>
                </div>
                {s.slots.map((it, i) => {
                  const angle = ((-90 + (i * 360) / s.capacity) * Math.PI) / 180;
                  const left = `calc(${(50 + RADIUS_PCT * Math.cos(angle)).toFixed(3)}% - ${SLOT_W / 2}px)`;
                  const top = `calc(${(50 + RADIUS_PCT * Math.sin(angle)).toFixed(3)}% - ${SLOT_H / 2}px)`;
                  return (
                    <div key={i} className={styles.slot} style={{ left, top }} data-slot={i}>
                      <span className={styles.slotIdx}>{i}</span>
                      <AnimatePresence initial={false} custom={animate}>
                        {it && (
                          <motion.div
                            key={it.id}
                            custom={animate}
                            variants={slotVariants}
                            initial="hidden"
                            animate="shown"
                            exit="gone"
                            className={cx(styles.blk, colorOf(it))}
                          >
                            {it.label}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {i === s.head && (
                        <span className={cx(styles.marker, styles.headMark)}>head</span>
                      )}
                      {i === tail && (
                        <span className={cx(styles.marker, styles.tailMark)}>tail</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {roles && (
              <div className={styles.roles}>
                <div
                  className={cx(
                    styles.role,
                    producer === 'active' && styles.active,
                    producer === 'blocked' && styles.blocked,
                  )}
                >
                  <b>PRODUCER</b>
                  {producer === 'blocked'
                    ? `đầy: cầm ${s.waiting!.label}, phải chờ`
                    : producer === 'active'
                      ? 'vừa ghi'
                      : 'rảnh'}
                </div>
                <div className={cx(styles.role, consumer === 'active' && styles.active)}>
                  <b>CONSUMER</b>
                  {consumer === 'active' ? 'vừa đọc' : 'rảnh'}
                </div>
              </div>
            )}
            <Say frame={frame} />
          </div>
          <div className={styles.side}>
            <div className={styles.card}>
              <div className={styles.head}>
                CÙNG DỮ LIỆU, LÀ MỘT MẢNG <code>buf</code>
              </div>
              <div className={styles.strip}>
                {s.slots.map((it, i) => (
                  <div key={i} className={cx(styles.stripCell, it ? colorOf(it) : styles.empty)}>
                    {it ? it.label : '·'}
                    <span className={styles.stripLabel}>
                      [{i}]{i === s.head ? ' h' : ''}
                      {i === tail ? ' t' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
            <Tray title="CONSUMER ĐÃ ĐỌC" items={s.out} />
          </div>
        </div>
      </Instant>
    );
  }
  return RingScene;
}
