import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import {
  traceBinarySearch,
  traceLinearSearch,
  worstCaseBinary,
  type BSEvent,
  type BSState,
  type LinearEvent,
  type TrackState,
} from '../binary-search/algorithm';
import { ARR, narrate } from '../binary-search/lesson';
import { trackScene } from '../binary-search/TrackScene';
import {
  formatCount,
  formatDuration,
  traceDirectAccess,
  traceGrowth,
  traceNestedLoopJoin,
  type GrowthEvent,
  type GrowthState,
  type JoinEvent,
  type JoinState,
  type ReadEvent,
} from './algorithm';
import { GrowthScene, JoinScene } from './scenes';
import { QUIZ } from './quiz';

const N = ARR.length;
export const INDEX = 12; // vị trí đọc thẳng ở bước 1
export const MISSING = 99; // giá trị không có trong bảng, dùng cho bước 2 và 3
export const ORDERS = [2, 1, 4, 2]; // customer_id của 4 đơn hàng
export const CUSTOMERS = [1, 2, 3, 4]; // id của 4 khách hàng
export const SIZES = [16, 1_000, 1_000_000, 1_000_000_000];

// Gắn câu đoán vào một frame. Frame đầu của bước không có câu đoán, vì player chỉ hỏi
// trước khi đi tới một frame.
const withAsk = <S, E>(frames: Frame<S, E>[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

// ---------- Trace của từng bước ----------

const DIRECT: Frame<TrackState, ReadEvent>[] = traceDirectAccess(ARR, INDEX).map((f) => {
  const s = f.state;
  const metrics: Metric[] = [
    { label: 'n (số dòng)', value: String(N) },
    { label: 'Vị trí cần đọc', value: String(INDEX) },
    { label: 'Số lần đọc', value: String(s.comparisons) },
    { label: 'Độ phức tạp', value: 'O(1)', tone: 'good' },
  ];
  return f.event.kind === 'read'
    ? {
        ...f,
        metrics,
        say: `arr[${INDEX}] = ${s.arr[INDEX]}: đọc 1 lần`,
        sayTone: 'good',
        holdMs: 1400,
        fx: [{ kind: 'burst', target: `cell-${INDEX}` }],
      }
    : { ...f, metrics, holdMs: 900 };
});

const SCAN = withAsk(
  traceLinearSearch(ARR, MISSING).map((f): Frame<TrackState, LinearEvent> => {
    const s = f.state;
    const e = f.event;
    const metrics: Metric[] = [
      { label: 'n (số dòng)', value: String(N) },
      {
        label: 'Số lần đọc',
        value: String(s.comparisons),
        tone: s.result === -1 ? 'bad' : undefined,
      },
      { label: 'Ô đang đọc', value: s.focus === null ? '—' : `[${s.focus}] = ${s.arr[s.focus]}` },
      { label: 'Độ phức tạp', value: 'O(n)', tone: 'bad' },
    ];
    if (e.kind === 'compare')
      return { ...f, metrics, say: `${s.arr[e.i]} ≠ ${MISSING}`, holdMs: 320 };
    if (e.kind === 'not-found')
      return {
        ...f,
        metrics,
        say: `đọc đủ ${s.comparisons} dòng: không có ${MISSING}`,
        sayTone: 'bad',
        holdMs: 1500,
      };
    return { ...f, metrics, holdMs: 700 };
  }),
  1,
  {
    prompt: `Bảng có ${N} dòng và không có ${MISSING}. Full scan phải đọc bao nhiêu dòng mới chắc chắn là không có?`,
    choices: [String(N), String(N / 2), '1'],
    correct: 0,
    explain: `Chưa đọc tới dòng cuối thì chưa thể chắc ${MISSING} không nằm ở đó. Bảng có n dòng thì đọc n lần: O(n).`,
  },
);

const SEARCH = withAsk(
  narrate(traceBinarySearch(ARR, MISSING)).map((f): Frame<BSState, BSEvent> => ({
    ...f,
    metrics: [
      { label: 'n (số dòng)', value: String(N) },
      { label: 'Số lần so sánh', value: String(f.state.comparisons) },
      {
        label: 'Khoảng còn lại',
        value: String(Math.max(0, f.state.hi - f.state.lo + 1)),
      },
      { label: 'Độ phức tạp', value: 'O(log n)', tone: 'good' },
    ],
  })),
  1,
  {
    prompt: `Vẫn tìm ${MISSING}, nhưng lần này dữ liệu đã sort. Binary search cần nhiều nhất bao nhiêu lần so sánh?`,
    choices: [String(worstCaseBinary(N)), String(N), String(N / 2)],
    correct: 0,
    explain: `Mỗi lần so sánh loại nửa khoảng còn lại: 16 → 8 → 4 → 2 → 1, nên tối đa ${worstCaseBinary(N)} lần. Bài Binary Search sẽ đi kỹ từng vòng.`,
  },
);

const JOIN = withAsk(
  traceNestedLoopJoin(ORDERS, CUSTOMERS).map((f): Frame<JoinState, JoinEvent> => {
    const s = f.state;
    const e = f.event;
    const metrics: Metric[] = [
      { label: 'Số cặp đã so', value: String(s.comparisons) },
      { label: 'Cặp khớp', value: String(s.matches.length), tone: 'good' },
      { label: 'Tổng số cặp', value: `${s.left.length} × ${s.right.length}` },
      { label: 'Độ phức tạp', value: 'O(n²)', tone: 'bad' },
    ];
    switch (e.kind) {
      case 'start':
        return { ...f, metrics, say: 'mỗi đơn hàng phải so với mọi khách hàng', holdMs: 1100 };
      case 'compare':
        return {
          ...f,
          metrics,
          say: `đơn ${e.i + 1} (customer_id ${s.left[e.i]}) với khách id ${s.right[e.j]}: ${e.match ? 'khớp' : 'không khớp'}`,
          sayTone: e.match ? 'good' : undefined,
          codeLines: e.match ? [3, 4] : [1, 2, 3],
          holdMs: 450,
        };
      case 'done':
        return {
          ...f,
          metrics,
          say: `${s.comparisons} lần so sánh để tìm ${s.matches.length} cặp khớp`,
          sayTone: 'bad',
          holdMs: 1600,
        };
    }
  }),
  1,
  {
    prompt: `Mỗi bảng có ${ORDERS.length} dòng. Nested loop join phải so bao nhiêu cặp?`,
    choices: [
      String(ORDERS.length * CUSTOMERS.length),
      String(ORDERS.length * 2),
      String(ORDERS.length),
    ],
    correct: 0,
    explain: `Mỗi đơn hàng so với cả ${CUSTOMERS.length} khách hàng: ${ORDERS.length} × ${CUSTOMERS.length} = ${ORDERS.length * CUSTOMERS.length}. Hai bảng 1 triệu dòng thì là 10¹² cặp.`,
  },
);

const GROWTH: Frame<GrowthState, GrowthEvent>[] = traceGrowth(SIZES).map((f) => {
  const row = f.state.rows[f.state.shown - 1];
  return {
    ...f,
    holdMs: f.event.kind === 'start' ? 900 : 1300,
    metrics: [
      { label: 'n', value: row ? formatCount(row.n) : '—' },
      { label: 'O(log n)', value: row ? String(row.log) : '—', tone: 'good' },
      { label: 'O(n)', value: row ? formatCount(row.linear) : '—' },
      { label: 'O(n²)', value: row ? formatCount(row.quadratic) : '—', tone: 'bad' },
    ],
    ask:
      row && row.n === SIZES.at(-1)
        ? {
            prompt: `n = 1 tỷ. O(log n) cần khoảng bao nhiêu bước?`,
            choices: [String(row.log), formatCount(1000), '1 tỷ'],
            correct: 0,
            explain: `Chia đôi 1 tỷ khoảng ${row.log} lần thì còn 1, nên log₂ n ≈ ${row.log}. Đó là lý do tra index trên bảng tỷ dòng vẫn nhanh.`,
          }
        : undefined,
  };
});

// ---------- Scene ----------

const DirectScene = trackScene({ pointers: false, chart: 'none', gait: 'hop' });
const ScanScene = trackScene({ pointers: false, chart: 'lin', gait: 'walk' });
const SearchScene = trackScene({ pointers: true, chart: 'log', gait: 'hop' });

// ---------- Các bước ----------

const steps = [
  defineStep<TrackState, ReadEvent>({
    id: 'o-1',
    short: 'O(1)',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Đếm số lần đọc, không đếm giây',
    Scene: DirectScene,
    build: () => DIRECT,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Big-O trả lời một câu hỏi: <b>khi dữ liệu lớn lên, số bước tăng nhanh cỡ nào?</b> Nó
            không đo giây, vì giây phụ thuộc vào máy. Ta đếm số lần đọc hoặc so sánh, gọi n là số
            dòng.
          </p>
          <p>
            Nếu đã biết vị trí, bạn đọc thẳng <code>arr[{INDEX}]</code> và được {s.arr[INDEX]}:{' '}
            <b>{s.comparisons} lần đọc</b>, dù bảng có {N} dòng hay 16 triệu dòng. Số bước không đổi
            theo n, ta viết <b>O(1)</b>.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Tra một key trong <code>dict</code> của Python cũng là O(1), tính trung bình. Bài Hash
          table sẽ giải thích vì sao.
        </>
      ),
    },
  }),

  defineStep<TrackState, LinearEvent>({
    id: 'o-n',
    short: 'O(n)',
    tag: 'FULL SCAN',
    tone: 'peach',
    title: 'Full scan: số lần đọc tăng theo n',
    Scene: ScanScene,
    build: () => SCAN,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Giờ tìm <b>{MISSING}</b> mà không biết vị trí, và bảng không được sắp xếp theo cột này.
            Cách duy nhất là đọc từng dòng: <code>WHERE order_id = {MISSING}</code> trên một cột
            không có index.
          </p>
          <p>
            {MISSING} không có trong bảng, nên phải đọc đủ <b>{s.comparisons} dòng</b> mới chắc
            chắn. Bảng gấp đôi thì số lần đọc cũng gấp đôi. Ta viết <b>O(n)</b>.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'BỎ HẰNG SỐ',
      text: 'Đọc cả bảng hai lần là 2n lần đọc, vẫn viết O(n). Big-O chỉ giữ phần quyết định tốc độ tăng khi n rất lớn.',
    },
  }),

  defineStep<BSState, BSEvent>({
    id: 'o-log-n',
    short: 'O(log n)',
    tag: 'CÓ INDEX',
    tone: 'sky',
    title: 'Dữ liệu đã sort: mỗi lần loại một nửa',
    Scene: SearchScene,
    build: () => SEARCH,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Cùng câu hỏi, nhưng dữ liệu đã sort. Binary search nhìn vào giữa và bỏ cả nửa không thể
            chứa {MISSING}.
          </p>
          <p>
            Chỉ cần <b>{s.comparisons} lần so sánh</b> thay vì {N}. Bảng gấp đôi thì chỉ thêm 1 lần.
            Ta viết <b>O(log n)</b>. Bài tiếp theo, Binary Search, đi kỹ từng vòng của cách này.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Đây là lý do index làm <code>WHERE</code> nhanh: B-tree index của Postgres hay MySQL tìm
          một key với số bước tỉ lệ log n, thay vì quét cả bảng.
        </>
      ),
    },
  }),

  defineStep<JoinState, JoinEvent>({
    id: 'o-n2',
    short: 'O(n²)',
    tag: 'NESTED LOOP',
    tone: 'rose',
    title: 'JOIN kiểu ngây thơ: so mọi cặp',
    Scene: JoinScene,
    build: () => JOIN,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Ghép đơn hàng với khách hàng theo <code>customer_id</code>. Cách ngây thơ: với mỗi đơn
            hàng, đi qua mọi khách hàng để tìm người khớp.
          </p>
          <p>
            {s.left.length} đơn × {s.right.length} khách = <b>{s.comparisons} lần so sánh</b> để tìm{' '}
            {s.matches.length} cặp khớp. Hai bảng cùng n dòng thì là n × n lần, ta viết <b>O(n²)</b>
            . Bảng gấp đôi thì số bước gấp bốn.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Cơ sở dữ liệu gọi cách này là nested loop join. Với hai bảng lớn không có index, nó tránh
          cách này bằng hash join (bài Hash table) hoặc sort-merge join (bài Merge sort). Khi{' '}
          <code>EXPLAIN</code> báo nested loop trên hai bảng lớn, đó là dấu hiệu cần xem lại.
        </>
      ),
    },
  }),

  defineStep<GrowthState, GrowthEvent>({
    id: 'tang-truong',
    short: 'n = 1 tỷ',
    tag: 'SO SÁNH',
    tone: 'lav',
    title: 'Khi bảng có 1 tỷ dòng',
    Scene: GrowthScene,
    build: () => GROWTH,
    Body: ({ frames }) => {
      const last = frames.at(-1)!.state.rows.at(-1)!;
      return (
        <>
          <p>
            Với 16 dòng, mọi cách đều nhanh. Khác biệt chỉ lộ ra khi n lớn. Với n = 1 tỷ: O(log n)
            là {last.log} bước, O(n) là 1 tỷ bước, còn O(n²) là {formatCount(last.quadratic)} bước.
          </p>
          <p>
            Nếu mỗi bước mất 1 micro giây, full scan mất khoảng {formatDuration(last.linear)}, còn
            nested loop join hai bảng 1 tỷ dòng mất khoảng {formatDuration(last.quadratic)}.
          </p>
          <p>
            Thứ tự cần nhớ, từ nhanh tới chậm: <b>O(1) &lt; O(log n) &lt; O(n) &lt; O(n²)</b>.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'CẦN NHỚ',
      text: 'Big-O không nói thuật toán chạy bao nhiêu giây. Nó nói khi dữ liệu tăng gấp đôi, công việc tăng thêm bao nhiêu: không đổi, thêm một bước, gấp đôi hay gấp bốn.',
    },
  }),
];

export const bigOLesson: Lesson = {
  slug: 'big-o',
  steps,
  legend: [
    { swatch: 'peach', label: 'đang đọc' },
    { swatch: 'sun', label: 'mid / đang so' },
    { swatch: 'ash', label: 'đã đọc, đã loại' },
    { swatch: 'mint', label: 'tìm thấy, khớp' },
  ],
  objectives: [
    { text: 'Big-O đếm số bước, không đếm giây', step: 0 },
    { text: 'Nhận ra O(1), O(n) và O(log n)', step: 2 },
    { text: 'Thấy vì sao O(n²) nguy hiểm với bảng lớn', step: 3 },
    { text: 'So sánh tốc độ tăng khi n lên tới 1 tỷ', step: 4 },
  ],
  quiz: QUIZ,
};
