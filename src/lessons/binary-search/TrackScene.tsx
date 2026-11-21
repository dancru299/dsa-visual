import type { CSSProperties } from 'react';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { TrackState } from './algorithm';
import { ComplexityChart, type ChartHighlight } from './ComplexityChart';
import styles from './TrackScene.module.css';

type Options = {
  pointers: boolean; // hiện lo, hi và khoảng [lo..hi]
  chart: ChartHighlight;
  gait: 'hop' | 'walk'; // binary search nhảy tới mid, linear search đi từng ô
};

const CUBE = (
  <svg viewBox="0 0 48 52" aria-hidden="true">
    <polygon className={styles.t} points="2,10 10,2 46,2 38,10" />
    <polygon className={styles.s} points="38,10 46,2 46,42 38,50" />
    <polygon className={styles.f} points="2,10 38,10 38,50 2,50" />
  </svg>
);

const FIGURE = (
  <svg viewBox="0 0 46 50" width="40" height="44" aria-hidden="true">
    <ellipse cx="20" cy="47" rx="13" ry="2.6" style={{ fill: 'rgba(33,29,44,.18)' }} />
    <path
      d="M8 46V31a12 12 0 0 1 24 0v15z"
      style={{
        fill: 'var(--peach)',
        stroke: 'var(--ink)',
        strokeWidth: 2.2,
        strokeLinejoin: 'round',
      }}
    />
    <circle
      cx="20"
      cy="11"
      r="8"
      style={{ fill: '#fffaf2', stroke: 'var(--ink)', strokeWidth: 2.2 }}
    />
    <line
      x1="34"
      y1="31"
      x2="41"
      y2="39"
      style={{ stroke: 'var(--ink)', strokeWidth: 3.2, strokeLinecap: 'round' }}
    />
    <circle
      cx="31"
      cy="27"
      r="6.5"
      style={{ fill: 'var(--sky-t)', stroke: 'var(--ink)', strokeWidth: 2.2 }}
    />
  </svg>
);

const cssVars = (vars: Record<string, string>) => vars as CSSProperties;

// Tạo một scene "dãy khối" cho từng bước. Gọi ở cấp module để component giữ nguyên
// giữa các lần render; tạo trong lúc render sẽ khiến React mount lại scene mỗi frame.
export function trackScene({ pointers, chart, gait }: Options): SceneComponent<TrackState> {
  function TrackScene({ frame, animate }: SceneProps<TrackState>) {
    const { arr, target, cells, focus, lo, hi, result } = frame.state;
    const n = arr.length;
    const pct = (x: number) => `${(x * 100) / n}%`;
    const center = (i: number) => pct(i + 0.5);
    const fx = animate ? (frame.fx ?? []) : [];
    const burstAt = fx.flatMap((e) => (e.kind === 'burst' ? [e.target] : []));
    const stagger = fx.find((e) => e.kind === 'stagger');
    const pos = focus ?? -1;
    const showRange = pointers && lo !== null && hi !== null && lo <= hi;
    const showInsert = pointers && result === -1 && lo !== null;

    return (
      <div className={cx(!animate && styles.noAnim)} data-testid="track-scene">
        <div className={styles.top}>
          <div>
            <div className={styles.targetPill}>
              target{' '}
              <b key={target} className={styles.targetValue}>
                {target}
              </b>
            </div>
            <p className={styles.hint}>sorted array · n = {n} · index bắt đầu từ 0</p>
          </div>
          <ComplexityChart highlight={chart} />
        </div>

        <div
          className={styles.scroll}
          tabIndex={0}
          role="region"
          aria-label="Dãy số, cuộn ngang được trên màn hình hẹp"
        >
          <div className={styles.track}>
            <div className={styles.row}>
              <div className={styles.slab} />
              <div
                className={cx(styles.range, !showRange && styles.gone)}
                style={
                  showRange
                    ? { left: pct(lo!), width: pct(hi! - lo! + 1) }
                    : { left: '0%', width: '0%' }
                }
              />
              {showInsert && (
                <div className={styles.ins} style={{ left: pct(lo!) }}>
                  <span>
                    nếu chèn, {target} nằm ở index {lo}
                  </span>
                </div>
              )}

              <div
                className={styles.cells}
                style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
              >
                {arr.map((x, i) => {
                  const state = cells[i];
                  return (
                    <div
                      key={i}
                      className={cx(
                        styles.cell,
                        state !== 'idle' && styles[state],
                        stagger && styles.pop,
                      )}
                      style={stagger ? cssVars({ '--dl': `${i * stagger.stepMs}ms` }) : undefined}
                      data-state={state}
                    >
                      <div className={styles.cube}>
                        {CUBE}
                        <span className={styles.num}>{x}</span>
                        {burstAt.includes(`cell-${i}`) && (
                          <div className={styles.burst} aria-hidden="true">
                            {Array.from({ length: 8 }, (_, k) => (
                              <span key={k} style={cssVars({ '--a': `${k * 45}deg` })} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={styles.idx}>{i}</span>
                    </div>
                  );
                })}
              </div>

              <div
                className={cx(
                  styles.searcher,
                  gait === 'walk' && styles.walkSpeed,
                  pos <= 1 && styles.al,
                  pos >= n - 2 && styles.ar,
                )}
                style={{ left: center(pos) }}
              >
                {frame.say && (
                  <div
                    key={frame.say}
                    className={cx(styles.bubble, frame.sayTone && styles[frame.sayTone])}
                    role="status"
                  >
                    {frame.say}
                  </div>
                )}
                <div key={pos} className={cx(styles.fig, animate && styles[gait])}>
                  {FIGURE}
                </div>
              </div>

              {pointers && lo !== null && hi !== null && (
                <>
                  <div className={cx(styles.ptr, styles.lo)} style={{ left: center(lo) }}>
                    <i />
                    <span>lo = {lo}</span>
                  </div>
                  <div className={cx(styles.ptr, styles.hi)} style={{ left: center(hi) }}>
                    <i />
                    <span>hi = {hi}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return TrackScene;
}
