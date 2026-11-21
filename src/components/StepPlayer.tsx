'use client';

import { useEffect } from 'react';
import type { Frame, LegendItem, Step } from '@/src/engine/types';
import { usePlayer, usePrefersReducedMotion } from '@/src/engine/usePlayer';
import { cx } from '@/src/lib/cx';
import { AskCard } from './AskCard';
import { Button } from './Button';
import { Icon } from './Icon';
import { Metrics } from './Metrics';
import styles from './StepPlayer.module.css';

export const SPEEDS = [0.5, 1, 1.5, 2];

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: Step<any, any>;
  frames: Frame<unknown>[];
  legend: LegendItem[];
  speed: number;
  onSpeed: (speed: number) => void;
  onAnswer: (frame: number) => void;
};

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);

// Vùng mô phỏng của một bước. Component này được mount lại mỗi khi đổi bước (key theo id),
// nên player luôn bắt đầu từ frame 0.
export function StepPlayer({ step, frames, legend, speed, onSpeed, onAnswer }: Props) {
  const [s, dispatch] = usePlayer(frames, speed);
  const reducedMotion = usePrefersReducedMotion();
  const frame = frames[s.frame];
  const animate = s.animate && !reducedMotion;
  const pending = s.pendingAsk;
  const ask = pending !== null ? frames[pending].ask : undefined;
  const { Scene } = step;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      const onControl =
        e.target instanceof HTMLElement && ['BUTTON', 'A', 'SUMMARY'].includes(e.target.tagName);
      if (e.key === ' ' && !onControl) {
        e.preventDefault();
        dispatch({ type: 'toggle' });
      } else if (e.key === 'r' || e.key === 'R') {
        dispatch({ type: 'replay' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <section className={styles.stage} aria-label="Mô phỏng" data-testid="stage">
      <div className={styles.stageTop}>
        <Metrics metrics={frame.metrics} animate={animate} />
        <div className={styles.ctrls}>
          <Button onClick={() => dispatch({ type: 'replay' })}>
            <Icon name="replay" />
            Xem lại
          </Button>
          <Button
            onClick={() => dispatch({ type: 'toggle' })}
            aria-pressed={!s.playing}
            data-testid="play-toggle"
            data-playing={s.playing}
          >
            <Icon name={s.playing ? 'pause' : 'play'} />
            {s.playing ? 'Tạm dừng' : 'Chạy'}
          </Button>
        </div>
      </div>

      <div className={styles.viz}>
        <Scene frame={frame} animate={animate} />
      </div>

      {/* Đặt dưới scene để người học vẫn thấy trạng thái hiện tại trong lúc đoán. */}
      {ask && pending !== null && (
        <AskCard
          key={pending}
          ask={ask}
          onContinue={() => {
            onAnswer(pending);
            dispatch({ type: 'answer' });
          }}
        />
      )}

      <div className={styles.timeline}>
        <Button
          size="small"
          onClick={() => dispatch({ type: 'prev' })}
          disabled={s.frame === 0}
          aria-label="Frame trước"
          data-testid="frame-prev"
        >
          <Icon name="stepBack" size={13} />
        </Button>
        <input
          type="range"
          className={styles.scrub}
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={s.frame}
          onChange={(e) => dispatch({ type: 'seek', frame: Number(e.target.value) })}
          disabled={frames.length < 2}
          aria-label="Tua tới frame"
          aria-valuetext={`Frame ${s.frame + 1} trên ${frames.length}`}
          data-testid="scrubber"
        />
        <Button
          size="small"
          onClick={() => dispatch({ type: 'next' })}
          disabled={s.frame >= frames.length - 1 || pending !== null}
          aria-label="Frame sau"
          data-testid="frame-next"
        >
          <Icon name="stepForward" size={13} />
        </Button>
        <span className={styles.counter} data-testid="frame-counter">
          {s.frame + 1} / {frames.length}
        </span>
        <label className={styles.speed}>
          Tốc độ
          <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.legend}>
        {legend.map((item) => (
          <span key={item.label}>
            <i className={'dashed' in item ? styles.dash : cx(styles[item.swatch])} />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
