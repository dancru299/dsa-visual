import { Icon } from '@/src/components/Icon';
import { cx } from '@/src/lib/cx';
import { worstCaseBinary } from './algorithm';
import styles from './ComplexityChart.module.css';

export type ChartHighlight = 'none' | 'lin' | 'log';

const W = 232;
const H = 124;
const X0 = 30;
const X1 = 222;
const Y0 = 104;
const Y1 = 10;
const NN = 64;
const MARK = 16;

const X = (n: number) => +(X0 + ((n - 1) / (NN - 1)) * (X1 - X0)).toFixed(1);
const Y = (v: number) => +(Y0 - (v / NN) * (Y0 - Y1)).toFixed(1);

// Đường bậc thang ⌊log₂ n⌋ + 1 cho n = 1..64.
function logPath(): string {
  let d = `M${X(1)},${Y(1)}`;
  let prev = 1;
  for (let n = 2; n <= NN; n++) {
    const v = worstCaseBinary(n);
    if (v !== prev) {
      d += ` L${X(n)},${Y(prev)} L${X(n)},${Y(v)}`;
      prev = v;
    }
  }
  return `${d} L${X(NN)},${Y(prev)}`;
}

const LOG_PATH = logPath();
const MARK_LOG = worstCaseBinary(MARK);

// Biểu đồ nhỏ: số lần so sánh tệ nhất theo n, linear O(n) so với binary O(log n).
export function ComplexityChart({ highlight }: { highlight: ChartHighlight }) {
  return (
    <div className={styles.card} data-hl={highlight}>
      <div className={styles.head}>
        <Icon name="trend" size={13} />
        SỐ LẦN SO SÁNH TỆ NHẤT THEO n
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Linear search cần n lần so sánh, binary search cần khoảng log2 n lần. Với n bằng ${MARK}: ${MARK} lần so với ${MARK_LOG} lần.`}
      >
        {[16, 32, 48, 64].map((v) => (
          <line key={v} x1={X0} x2={X1} y1={Y(v)} y2={Y(v)} className={styles.g} />
        ))}
        <line x1={X0} y1={Y0} x2={X1} y2={Y0} className={styles.ax} />
        <line x1={X0} y1={Y0} x2={X0} y2={Y1} className={styles.ax} />
        <text x={X0 - 5} y={Y(64) + 3} className={styles.tl} textAnchor="end">
          64
        </text>
        <text x={X0 - 5} y={Y(32) + 3} className={styles.tl} textAnchor="end">
          32
        </text>
        <text x={X0 - 5} y={Y0 + 3} className={styles.tl} textAnchor="end">
          0
        </text>
        <text x={X(1)} y={Y0 + 13} className={styles.tl} textAnchor="middle">
          1
        </text>
        <text x={X(MARK)} y={Y0 + 13} className={styles.tl} textAnchor="middle">
          {MARK}
        </text>
        <text x={X(NN)} y={Y0 + 13} className={styles.tl} textAnchor="end">
          n = {NN}
        </text>
        <line x1={X(MARK)} x2={X(MARK)} y1={Y0} y2={Y(MARK)} className={styles.mk} />
        <path d={`M${X(1)},${Y(1)} L${X(NN)},${Y(NN)}`} className={cx(styles.cLin, styles.lin)} />
        <path d={LOG_PATH} className={cx(styles.cLog, styles.log)} />
        <circle cx={X(MARK)} cy={Y(MARK)} r={3.5} className={cx(styles.dLin, styles.lin)} />
        <circle cx={X(MARK)} cy={Y(MARK_LOG)} r={3.5} className={cx(styles.dLog, styles.log)} />
        <text
          x={X(MARK) - 6}
          y={Y(MARK) - 5}
          className={cx(styles.vl, styles.lin)}
          textAnchor="end"
        >
          {MARK}
        </text>
        <text x={X(MARK) + 3} y={Y(MARK_LOG) - 7} className={cx(styles.vl, styles.log)}>
          {MARK_LOG}
        </text>
        <text x={X(44)} y={Y(52)} className={cx(styles.nm, styles.lin)} textAnchor="end">
          linear O(n)
        </text>
        <text x={X(NN)} y={Y(7) - 6} className={cx(styles.nm, styles.log)} textAnchor="end">
          binary O(log n)
        </text>
      </svg>
    </div>
  );
}
