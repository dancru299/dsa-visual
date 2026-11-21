import type { ReactNode } from 'react';
import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import {
  traceBinarySearch,
  traceHalving,
  traceLinearSearch,
  worstCaseBinary,
  type BSEvent,
  type BSState,
  type HalvingEvent,
  type HalvingState,
  type LinearEvent,
  type TrackState,
} from './algorithm';
import { HalvingScene } from './HalvingScene';
import { trackScene } from './TrackScene';

export const ARR = [3, 8, 12, 17, 21, 26, 34, 41, 47, 55, 62, 66, 73, 80, 88, 95];
export const TARGET = 73;
export const MISSING = 50;
const N = ARR.length;

export const PYTHON_CODE = [
  'def binary_search(arr, target):',
  '    lo, hi = 0, len(arr) - 1',
  '    while lo <= hi:',
  '        mid = (lo + hi) // 2',
  '        if arr[mid] == target:',
  '            return mid',
  '        elif arr[mid] < target:',
  '            lo = mid + 1',
  '        else:',
  '            hi = mid - 1',
  '    return -1',
];

// ---------- Lời dẫn ----------

function askMid(lo: number, hi: number, mid: number): Ask {
  const choices = [...new Set([mid, Math.ceil((lo + hi) / 2), mid - 1, mid + 1])].slice(0, 3);
  const half = (lo + hi) / 2;
  return {
    prompt: `Khoảng đang tìm là [${lo}..${hi}]. Ô mid tiếp theo là index nào?`,
    choices: choices.map(String),
    correct: 0,
    explain:
      `mid = (${lo} + ${hi}) // 2 = ${mid}.` +
      (Number.isInteger(half) ? '' : ` Phép // làm tròn xuống, nên ${half} thành ${mid}.`),
  };
}

const ASK_DROP_LEFT: Ask = {
  prompt: 'arr[mid] nhỏ hơn target. Những ô nào bị loại?',
  choices: ['Nửa trái, kể cả ô mid', 'Nửa phải, kể cả ô mid', 'Chỉ ô mid'],
  correct: 0,
  explain:
    'Mảng đã sort, nên mọi ô từ lo tới mid đều nhỏ hơn hoặc bằng arr[mid], tức là nhỏ hơn target. Ô mid cũng đã so sánh rồi, nên lo = mid + 1.',
};

const ASK_STOP: Ask = {
  prompt: 'Lúc này lo lớn hơn hi. Hàm làm gì tiếp?',
  choices: ['Dừng vòng lặp và trả về -1', 'Chạy thêm một vòng với mid = lo', 'Trả về lo'],
  correct: 0,
  explain:
    'Điều kiện while lo <= hi đã sai, nên vòng lặp dừng và hàm trả về -1. Giá trị lo lúc này là vị trí cần chèn, nhưng binary_search không trả về nó.',
};

type NarrateOptions = { askMid?: boolean; askDrop?: boolean; askStop?: boolean };

// Biến event thành lời dẫn, dòng code và câu đoán. Số dòng ứng với PYTHON_CODE ở trên.
export function narrate(
  frames: Frame<BSState, BSEvent>[],
  opts: NarrateOptions = {},
): Frame<BSState, BSEvent>[] {
  return frames.map((f, i): Frame<BSState, BSEvent> => {
    const { arr, target, lo, hi } = f.state;
    const e = f.event;
    switch (e.kind) {
      case 'start':
        return { ...f, say: 'Bắt đầu: lo = 0, hi = n - 1', codeLines: [2], holdMs: 700 };
      case 'compare':
        return {
          ...f,
          say: `mid = (${lo} + ${hi}) // 2 = ${e.mid}`,
          codeLines: [3, 4],
          holdMs: 1000,
          ask: opts.askMid && e.iteration >= 2 ? askMid(lo, hi, e.mid) : undefined,
        };
      case 'found':
        return {
          ...f,
          say: `arr[${e.mid}] = ${arr[e.mid]}: tìm thấy!`,
          sayTone: 'good',
          codeLines: [5, 6],
          holdMs: 1300,
          fx: [{ kind: 'burst', target: `cell-${e.mid}` }],
        };
      case 'go-right': {
        const prev = frames[i - 1]?.event;
        const iteration = prev?.kind === 'compare' ? prev.iteration : 0;
        return {
          ...f,
          say: `${arr[e.mid]} < ${target} → bỏ nửa trái, lo = ${lo}`,
          codeLines: [7, 8],
          holdMs: 1100,
          ask: opts.askDrop && iteration === 2 ? ASK_DROP_LEFT : undefined,
        };
      }
      case 'go-left':
        return {
          ...f,
          say: `${arr[e.mid]} > ${target} → bỏ nửa phải, hi = ${hi}`,
          codeLines: [9, 10],
          holdMs: 1100,
        };
      case 'not-found':
        return {
          ...f,
          say: `lo = ${lo} > hi = ${hi} → không có ${target}`,
          sayTone: 'bad',
          codeLines: [11],
          holdMs: 1400,
          ask: opts.askStop ? ASK_STOP : undefined,
        };
    }
  });
}

function narrateLinear(frames: Frame<TrackState, LinearEvent>[]): Frame<TrackState, LinearEvent>[] {
  return frames.map((f): Frame<TrackState, LinearEvent> => {
    const { arr, target } = f.state;
    const e = f.event;
    switch (e.kind) {
      case 'start':
        return { ...f, holdMs: 600 };
      case 'compare':
        return { ...f, say: `${arr[e.i]} ≠ ${target}`, holdMs: 430 };
      case 'found':
        return {
          ...f,
          say: `${arr[e.i]} = ${target}: tìm thấy!`,
          sayTone: 'good',
          holdMs: 1300,
          fx: [{ kind: 'burst', target: `cell-${e.i}` }],
        };
      case 'not-found':
        return { ...f, say: `không có ${target}`, sayTone: 'bad', holdMs: 1300 };
    }
  });
}

// ---------- Trace dùng chung cho nhiều bước ----------

export const T73 = narrate(traceBinarySearch(ARR, TARGET), { askMid: true, askDrop: true });
const T50 = narrate(traceBinarySearch(ARR, MISSING), { askStop: true });
const LINEAR = narrateLinear(traceLinearSearch(ARR, TARGET));

const iterationAt = (k: number) =>
  T73.findIndex((f) => f.event.kind === 'compare' && f.event.iteration === k);

const FOUND = T73.at(-1)!.state;
const BINARY_COUNT = FOUND.comparisons;
const LINEAR_COUNT = LINEAR.at(-1)!.state.comparisons;

// Số ứng viên sau mỗi vòng: 16 → 8 → 4 → 1.
const CANDIDATES = [
  N,
  ...T73.filter((f) => f.event.kind === 'go-right' || f.event.kind === 'go-left').map(
    (f) => f.state.hi - f.state.lo + 1,
  ),
];

// ---------- Metrics ----------

const withMetrics = <S, E>(frames: Frame<S, E>[], metrics: (f: Frame<S, E>) => Metric[]) =>
  frames.map((f) => ({ ...f, metrics: metrics(f) }));

const range = (s: BSState) => (s.lo <= s.hi ? `[${s.lo}..${s.hi}]` : 'rỗng');

const bsMetrics = (s: BSState): Metric[] => [
  { label: 'Target', value: String(s.target) },
  { label: 'Số lần so sánh', value: String(s.comparisons) },
  { label: 'Ứng viên còn lại', value: String(Math.max(0, s.hi - s.lo + 1)) },
  { label: 'Khoảng [lo..hi]', value: range(s), tone: s.result === -1 ? 'bad' : undefined },
];

// ---------- Scene ----------

const ProblemScene = trackScene({ pointers: false, chart: 'none', gait: 'hop' });
const LinearScene = trackScene({ pointers: false, chart: 'lin', gait: 'walk' });
const BinaryScene = trackScene({ pointers: true, chart: 'log', gait: 'hop' });
const FoundScene = trackScene({ pointers: true, chart: 'none', gait: 'hop' });
const RecapScene = codeTraceScene({
  file: 'binary_search.py',
  code: PYTHON_CODE,
  columns: ['vòng', 'lo', 'hi', 'mid', 'arr[mid]', 'quyết định'],
  title: `TRACE KHI TÌM ${TARGET}`,
});

// Bảng trace của bước tóm tắt: mỗi vòng lặp thêm một hàng khi đã có quyết định.
function toCodeTrace(frames: Frame<BSState, BSEvent>[]): Frame<CodeTraceState, BSEvent>[] {
  const rows: string[][] = [];
  let atCompare: BSState | null = null;
  return frames.map((f) => {
    const e = f.event;
    if (e.kind === 'compare') atCompare = f.state;
    else if (atCompare && (e.kind === 'found' || e.kind === 'go-right' || e.kind === 'go-left')) {
      const { lo, hi, comparisons, arr, target } = atCompare;
      const val = arr[e.mid];
      const decision =
        e.kind === 'found'
          ? `${val} == ${target} → return ${e.mid}`
          : e.kind === 'go-right'
            ? `${val} < ${target} → lo = ${f.state.lo}`
            : `${val} > ${target} → hi = ${f.state.hi}`;
      rows.push([comparisons, lo, hi, e.mid, val, decision].map(String));
    }
    return {
      state: { rows: rows.map((r) => [...r]) }, // bản sao riêng cho từng frame
      event: e,
      codeLines: f.codeLines,
      holdMs: f.holdMs,
      metrics: [
        { label: 'Target', value: String(f.state.target) },
        { label: 'Số lần so sánh', value: String(f.state.comparisons) },
        {
          label: 'Kết quả',
          value: f.state.result === null ? '?' : `index ${f.state.result}`,
          tone: f.state.result === null ? undefined : 'good',
        },
        { label: 'Độ phức tạp', value: 'O(log n)', tone: 'good' },
      ],
    };
  });
}

// Mô tả một vòng lặp bằng lời, lấy số từ frame so sánh và frame quyết định ngay sau nó.
function describeIterations(frames: Frame<BSState, BSEvent>[]): ReactNode[] {
  const out: ReactNode[] = [];
  frames.forEach((f, i) => {
    const e = f.event;
    const next = frames[i + 1];
    if (e.kind !== 'compare' || !next) return;
    const { arr, target, lo, hi } = f.state;
    const v = arr[e.mid];
    if (next.event.kind === 'go-right') {
      out.push(
        <>
          [{lo}..{hi}]: mid = {e.mid}, arr[{e.mid}] = {v} &lt; {target}, nên{' '}
          <code>lo = {next.state.lo}</code>.
        </>,
      );
    } else if (next.event.kind === 'go-left') {
      out.push(
        <>
          [{lo}..{hi}]: mid = {e.mid}, arr[{e.mid}] = {v} &gt; {target}, nên bỏ <b>nửa phải</b>:{' '}
          <code>hi = {next.state.hi}</code>.
        </>,
      );
    }
  });
  return out;
}

// ---------- Các bước ----------

const firstCompare = T73[iterationAt(1)];
const firstMid = firstCompare.event.kind === 'compare' ? firstCompare.event.mid : 0;
const HALVING_NS = [16, 1000, 1_000_000, 1_000_000_000];
const fmt = (n: number) => n.toLocaleString('vi-VN');

const steps = [
  defineStep<TrackState, BSEvent>({
    id: 'bai-toan',
    short: 'Bài toán',
    tag: 'BÀI TOÁN',
    tone: 'rose',
    title: `Tìm số ${TARGET} trong ${N} số`,
    Scene: ProblemScene,
    build: () => {
      const start = T73[0];
      const metrics: Metric[] = [
        { label: 'Target', value: String(TARGET) },
        { label: 'n (số phần tử)', value: String(N) },
        { label: 'Số lần so sánh', value: '0' },
        { label: 'Kết quả', value: '?' },
      ];
      return [
        {
          ...start,
          say: undefined,
          codeLines: undefined,
          metrics,
          holdMs: 1300,
          fx: [{ kind: 'stagger', targets: ARR.map((_, i) => `cell-${i}`), stepMs: 45 }],
        },
        { ...start, say: `${TARGET} nằm ở index nào?`, codeLines: undefined, metrics },
      ];
    },
    Body: () => (
      <>
        <p>
          Hình dung đây là cột <code>order_id</code> đã sort trong một file dữ liệu. Bạn có {N} số,
          sắp xếp tăng dần (<b>sorted array</b>), và cần biết số <b>{TARGET}</b> nằm ở index nào.
        </p>
        <p>Mỗi khối là một phần tử. Số nhỏ in trên kệ là index, bắt đầu từ 0.</p>
        <p>
          Câu hỏi của cả bài: <b>cần bao nhiêu lần so sánh</b> để tìm ra?
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'ĐIỀU KIỆN',
      text: 'Binary search chỉ đúng khi dữ liệu đã được sắp xếp. Thiếu điều kiện này, mọi bước phía sau đều sai.',
    },
  }),

  defineStep<TrackState, LinearEvent>({
    id: 'tung-o',
    short: 'Đi từng ô',
    tag: 'CÁCH ĐƠN GIẢN',
    tone: 'peach',
    title: 'Linear search: xét lần lượt từng ô',
    Scene: LinearScene,
    build: () =>
      withMetrics(LINEAR, (f) => [
        { label: 'Target', value: String(f.state.target) },
        {
          label: 'Số lần so sánh',
          value: String(f.state.comparisons),
          tone: f.state.result !== null ? 'bad' : undefined,
        },
        {
          label: 'Ô đang xét',
          value:
            f.state.focus === null ? '—' : `[${f.state.focus}] = ${f.state.arr[f.state.focus]}`,
        },
        { label: 'Độ phức tạp', value: 'O(n)', tone: 'bad' },
      ]),
    Body: ({ frames }) => {
      const last = frames.at(-1)!.state;
      return (
        <>
          <p>Cách dễ nghĩ ra nhất: đi từ trái sang phải, so sánh từng ô với {last.target}.</p>
          <p>
            Tìm thấy ở index {last.result}, sau <b>{last.comparisons} lần so sánh</b>. Nếu{' '}
            {last.target} nằm ở cuối mảng hoặc không có trong mảng, bạn phải xét đủ {N} ô.
          </p>
          <p>
            Chi phí tăng tỉ lệ thuận với số phần tử n. Ta viết là <b>O(n)</b>. Cơ sở dữ liệu cũng
            làm đúng như vậy với <code>WHERE order_id = {last.target}</code> khi cột đó không có
            index: đọc từng dòng, gọi là full scan.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'LƯU Ý',
      text: 'Linear search có một ưu điểm: không cần dữ liệu sorted. Với mảng chỉ vài chục phần tử, chênh lệch thường không đáng kể.',
    },
  }),

  defineStep<BSState, BSEvent>({
    id: 'nhin-giua',
    short: 'Nhìn giữa',
    tag: 'Ý TƯỞNG',
    tone: 'mint',
    title: 'Nhìn vào giữa, bỏ cả một nửa',
    Scene: BinaryScene,
    build: () => withMetrics(T73.slice(0, iterationAt(2)), (f) => bsMetrics(f.state)),
    Body: () => (
      <>
        <p>
          Binary search giữ hai con trỏ: <b>lo</b> (đầu khoảng đang tìm) và <b>hi</b> (cuối khoảng).
          Mỗi vòng nó xét ô ở giữa: <code>mid = (lo + hi) // 2</code>, ở đây là {firstMid}.
        </p>
        <p>
          arr[{firstMid}] = {ARR[firstMid]}, nhỏ hơn {TARGET}. Mảng đã sorted, nên{' '}
          <b>
            mọi ô bên trái index {firstMid} cũng nhỏ hơn {TARGET}
          </b>
          .
        </p>
        <p>Chỉ một lần so sánh mà loại được {firstMid + 1} ứng viên.</p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Linear search: một lần so sánh loại một ô. Binary search: một lần so sánh loại nửa khoảng còn lại.',
    },
  }),

  defineStep<BSState, BSEvent>({
    id: 'lap-lai',
    short: 'Lặp lại',
    tag: 'VÒNG LẶP',
    tone: 'sky',
    title: 'Lặp lại đến khi còn một ô',
    Scene: BinaryScene,
    // Bắt đầu từ frame cuối của bước trước để người học thấy lại trạng thái đang dừng.
    build: () =>
      withMetrics(T73.slice(iterationAt(2) - 1, iterationAt(4)), (f) => bsMetrics(f.state)),
    Body: ({ frames }) => (
      <>
        {describeIterations(frames).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <p>Số ứng viên sau mỗi vòng: {CANDIDATES.join(' → ')}.</p>
      </>
    ),
    callout: {
      kind: 'warn',
      title: 'CHÚ Ý',
      text: (
        <>
          Ô mid cũng bị loại (<code>lo = mid + 1</code>, <code>hi = mid - 1</code>) vì đã so sánh nó
          rồi. Viết thiếu <code>+ 1</code> là cách nhanh nhất để tạo vòng lặp vô hạn.
        </>
      ),
    },
  }),

  defineStep<BSState, BSEvent>({
    id: 'tim-thay',
    short: 'Tìm thấy',
    tag: 'KẾT QUẢ',
    tone: 'mint',
    title: `${BINARY_COUNT} lần so sánh thay vì ${LINEAR_COUNT}`,
    Scene: FoundScene,
    build: () =>
      withMetrics(T73.slice(iterationAt(4) - 1), (f) => {
        const done = f.state.result !== null;
        return [
          { label: 'Target', value: String(f.state.target) },
          {
            label: 'So sánh (binary)',
            value: String(f.state.comparisons),
            tone: done ? 'good' : undefined,
          },
          { label: 'So sánh (linear)', value: String(LINEAR_COUNT), tone: 'bad' },
          {
            label: 'Kết quả',
            value: done ? `index ${f.state.result}` : '?',
            tone: done ? 'good' : undefined,
          },
        ];
      }),
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            lo = hi = {s.lo}, nên mid = {s.lo} và arr[{s.lo}] = {s.arr[s.lo]}. Tìm thấy.
          </p>
          <p>
            Cùng một câu hỏi: linear search cần {LINEAR_COUNT} lần so sánh, binary search cần{' '}
            {s.comparisons} lần.
          </p>
          <p>
            Với {N} phần tử, chênh lệch còn nhỏ. Bước 7 sẽ cho thấy khoảng cách này{' '}
            <b>giãn ra rất nhanh</b> khi n tăng.
          </p>
        </>
      );
    },
  }),

  defineStep<BSState, BSEvent>({
    id: 'khong-co',
    short: 'Không có',
    tag: 'EDGE CASE',
    tone: 'rose',
    title: 'Khi số cần tìm không có',
    Scene: BinaryScene,
    build: () => withMetrics(T50, (f) => bsMetrics(f.state)),
    Body: ({ frames }) => {
      const last = frames.at(-1)!.state;
      return (
        <>
          <p>
            Giờ tìm <b>{last.target}</b>:
          </p>
          <ul>
            {describeIterations(frames).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p>
            Lúc này{' '}
            <b>
              lo = {last.lo} &gt; hi = {last.hi}
            </b>
            : khoảng tìm kiếm rỗng. Vòng lặp dừng và trả về -1.
          </p>
          <p>
            lo dừng ở {last.lo}, cũng chính là vị trí cần chèn {last.target} để mảng vẫn sorted. Hàm{' '}
            <code>bisect_left</code> của Python trả về đúng vị trí này.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'BUG KINH ĐIỂN',
      text: (
        <>
          Với cách viết lo, hi bao cả hai đầu như bài này, điều kiện lặp phải là{' '}
          <code>lo &lt;= hi</code>. Viết <code>lo &lt; hi</code> thì vòng lặp thoát khi lo == hi, bỏ
          sót ô cuối: ở bước 5, index {FOUND.result} sẽ không bao giờ được xét.
        </>
      ),
    },
  }),

  defineStep<HalvingState, HalvingEvent>({
    id: 'vi-sao-log-n',
    short: 'Vì sao log n',
    tag: 'BIG-O',
    tone: 'lav',
    title: 'Vì sao là O(log n)',
    Scene: HalvingScene,
    build: () =>
      withMetrics(
        traceHalving(N, HALVING_NS).map((f) => ({
          ...f,
          holdMs: f.event.kind === 'row' ? 900 : 800,
        })),
        (f) => {
          const row = f.state.table[f.state.tableShown - 1];
          const n = row ? row.n : f.state.n;
          return [
            { label: 'n', value: fmt(n) },
            { label: 'Số lần chia đôi', value: String(Math.max(0, f.state.shown - 1)) },
            { label: 'Tệ nhất (binary)', value: `${worstCaseBinary(n)} lần`, tone: 'good' },
            { label: 'Tệ nhất (linear)', value: `${fmt(n)} lần`, tone: 'bad' },
          ];
        },
      ),
    Body: ({ frames }) => {
      const { sizes } = frames.at(-1)!.state;
      const halvings = sizes.length - 1;
      return (
        <>
          <p>
            Câu hỏi thật sự là: <b>chia đôi n bao nhiêu lần thì còn 1?</b> {sizes.join(' → ')} là{' '}
            {halvings} lần, vì 2<sup>{halvings}</sup> = {N}. Con số đó là log₂ n.
          </p>
          <p>
            Mỗi lần dữ liệu <b>gấp đôi</b>, binary search chỉ cần <b>thêm 1</b> lần so sánh. Trường
            hợp tệ nhất là ⌊log₂ n⌋ + 1 lần.
          </p>
          <p>
            Ở bước 4, khoảng co nhanh hơn một chút ({CANDIDATES.join(' → ')}) vì ô mid bị loại luôn
            sau mỗi vòng.
          </p>
        </>
      );
    },
    callout: {
      kind: 'think',
      title: 'THỬ NGHĨ',
      text: 'Nếu n = 2 tỷ, binary search cần tối đa bao nhiêu lần so sánh?',
      answer: (
        <>
          {worstCaseBinary(2_000_000_000)} lần. 2³⁰ ≈ 1,07 tỷ &lt; 2 tỷ &lt; 2³¹ ≈ 2,15 tỷ, nên
          ⌊log₂ n⌋ = 30, cộng thêm 1. Gấp đôi dữ liệu so với 1 tỷ chỉ thêm đúng 1 lần.
        </>
      ),
    },
  }),

  defineStep<CodeTraceState, BSEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'sun',
    title: 'Code và những gì cần nhớ',
    Scene: RecapScene,
    build: () => toCodeTrace(T73.map((f) => ({ ...f, ask: undefined }))),
    Body: () => (
      <>
        <p>
          Code bên trái là đúng thuật toán bạn vừa xem. Bảng trace ghi lại từng vòng lặp khi tìm{' '}
          {TARGET}.
        </p>
        <p>
          Ba điều cần nhớ: dữ liệu phải <b>sorted</b>; mỗi vòng loại nửa khoảng nên chi phí là{' '}
          <b>O(log n)</b>; điều kiện lặp là <code>lo &lt;= hi</code>.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Ý tưởng loại cả khối dữ liệu mà không cần đọc xuất hiện khắp nơi. Với{' '}
          <code>SELECT * FROM orders WHERE order_id = {TARGET}</code>, nếu cột <code>order_id</code>{' '}
          có B-tree index thì cơ sở dữ liệu chỉ đi qua vài node của cây, số bước tỉ lệ log n, thay
          vì quét cả bảng. BigQuery dùng partition và clustering để bỏ qua các block không thể chứa
          giá trị bạn lọc.
        </>
      ),
    },
  }),
];

export const binarySearchLesson: Lesson = {
  slug: 'binary-search',
  steps,
  legend: [
    { swatch: 'peach', label: 'đang xét (linear)' },
    { swatch: 'sun', label: 'mid' },
    { swatch: 'ash', label: 'đã loại' },
    { swatch: 'mint', label: 'tìm thấy' },
    { dashed: true, label: 'khoảng [lo..hi]' },
  ],
  objectives: [
    { text: 'Phân biệt linear search và binary search', step: 1 },
    { text: 'Hiểu vì sao cần dữ liệu sorted', step: 2 },
    { text: 'Theo dõi lo, mid, hi qua từng vòng', step: 3 },
    { text: 'Xử lý trường hợp không tìm thấy', step: 5 },
    { text: 'Giải thích O(log n) bằng phép chia đôi', step: 6 },
  ],
};
