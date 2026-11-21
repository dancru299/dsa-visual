import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import { formatCount } from '../big-o/algorithm';
import {
  traceCost,
  traceMergeJoin,
  traceMergeSort,
  traceMergeTwo,
  traceSplit,
  type CostEvent,
  type CostState,
  type JoinEvent,
  type JoinState,
  type MergeEvent,
  type MergeState,
  type SplitEvent,
} from './algorithm';
import { approx, CostScene, joinScene, treeScene } from './scenes';
import { QUIZ } from './quiz';

// ---------- Code hiển thị trên trang ----------

export const CODE_SORT = [
  'def merge(left, right):',
  '    out, i, j = [], 0, 0',
  '    while i < len(left) and j < len(right):',
  '        if left[i] <= right[j]:',
  '            out.append(left[i]); i += 1',
  '        else:',
  '            out.append(right[j]); j += 1',
  '    out += left[i:] + right[j:]',
  '    return out',
  '',
  'def merge_sort(a):',
  '    width = 1',
  '    while width < len(a):',
  '        for lo in range(0, len(a), 2 * width):',
  '            mid, hi = lo + width, lo + 2 * width',
  '            a[lo:hi] = merge(a[lo:mid], a[mid:hi])',
  '        width *= 2',
  '    return a',
];

const CODE_JOIN = [
  'def merge_join(orders, customers):   # cả hai đã sort theo khoá',
  '    i = j = 0',
  '    while i < len(orders) and j < len(customers):',
  '        a, b = orders[i].customer_id, customers[j].id',
  '        if a < b:',
  '            i += 1',
  '        elif a > b:',
  '            j += 1',
  '        else:',
  '            yield orders[i], customers[j]',
  '            i += 1',
];

// ---------- Dữ liệu ----------

export const ARR = [38, 27, 43, 3, 9, 82, 10, 15];
export const LEFT = [3, 27, 38, 43];
export const RIGHT = [9, 10, 15, 82];
export const ORDER_KEYS = [1, 2, 2, 4, 6];
export const CUSTOMER_IDS = [1, 2, 3, 4, 5];
export const SIZES = [8, 1_000, 1_000_000, 1_000_000_000];

const withAsk = <S, E>(frames: Frame<S, E>[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

// ---------- Chia đôi ----------

export const SPLIT = withAsk(
  traceSplit(ARR).map((f, k, all): Frame<MergeState, SplitEvent> => {
    const rows = f.state.rows;
    const lastRow = rows.at(-1)!;
    const isLast = k === all.length - 1;
    return {
      ...f,
      say:
        f.event.kind === 'start'
          ? `${ARR.length} số chưa sort`
          : isLast
            ? 'mỗi nhóm còn 1 phần tử: tự nó đã sort'
            : `chia đôi: ${lastRow.length} nhóm, mỗi nhóm ${lastRow[0].size} phần tử`,
      sayTone: isLast ? 'good' : undefined,
      holdMs: 1300,
      metrics: [
        { label: 'Số tầng chia', value: String(rows.length - 1) },
        { label: 'Số nhóm', value: String(lastRow.length) },
        { label: 'Mỗi nhóm', value: `${lastRow[0].size} phần tử` },
        { label: 'Đã so sánh', value: '0' },
      ],
    };
  }),
  1,
  {
    prompt: `${ARR.length} phần tử phải chia đôi bao nhiêu lần thì mỗi nhóm còn đúng 1 phần tử?`,
    choices: [String(Math.log2(ARR.length)), String(ARR.length / 2), String(ARR.length - 1)],
    correct: 0,
    explain: `8 → 4 → 2 → 1: ba lần chia, vì 2³ = 8. Đó chính là log₂ n, giống phép chia đôi của binary search.`,
  },
);

// ---------- Trộn ----------

const takeLines = (e: MergeEvent): number[] => {
  if (e.kind === 'start') return [2];
  if (e.kind === 'done') return [9];
  if (e.kind === 'level') return [13, 14, 15, 16];
  if (!e.compared) return [8];
  return e.side === 'left' ? [3, 4, 5] : [3, 6, 7];
};

const sourcesOf = (s: MergeState) => {
  const a = s.active!;
  return [s.rows[a.row + 1][2 * a.group], s.rows[a.row + 1][2 * a.group + 1]];
};

function narrateMerge(
  frames: Frame<MergeState, MergeEvent>[],
  metrics: (f: Frame<MergeState, MergeEvent>) => Metric[],
  lines: (e: MergeEvent) => number[] = takeLines,
): Frame<MergeState, MergeEvent>[] {
  return frames.map((f) => {
    const e = f.event;
    const base = { ...f, metrics: metrics(f), codeLines: lines(e) };
    switch (e.kind) {
      case 'start':
        return { ...base, holdMs: 900 };
      case 'level':
        return {
          ...base,
          say: `tầng mới: trộn từng cặp nhóm thành nhóm ${e.width} phần tử`,
          holdMs: 1200,
        };
      case 'take': {
        // Sau khi lấy, con trỏ bên kia chưa đổi, nên nó vẫn chỉ đúng số vừa được so.
        const [l, r] = sourcesOf(f.state);
        const a = f.state.active!;
        const say = !e.compared
          ? `một bên đã hết: chép ${e.value}`
          : e.side === 'left'
            ? `${e.value} ≤ ${r.values[a.j]}: lấy ${e.value} bên trái`
            : `${e.value} < ${l.values[a.i]}: lấy ${e.value} bên phải`;
        return { ...base, say, holdMs: 650 };
      }
      case 'done':
        return { ...base, say: 'xong: cả mảng đã sort', sayTone: 'good', holdMs: 1400 };
    }
  });
}

const twoMetrics = (f: Frame<MergeState, MergeEvent>): Metric[] => {
  const out = f.state.rows[0][0];
  return [
    { label: 'Đã lấy', value: `${out.values.length}/${out.size}` },
    { label: 'Số lần so sánh', value: String(f.state.comparisons) },
    { label: 'i (trái)', value: f.state.active ? String(f.state.active.i) : '—' },
    { label: 'j (phải)', value: f.state.active ? String(f.state.active.j) : '—' },
  ];
};

export const MERGE_TWO = (() => {
  const frames = narrateMerge(traceMergeTwo(LEFT, RIGHT), twoMetrics);
  // Câu đoán ở lần lấy đầu tiên từ dãy phải, khi đầu dãy trái lớn hơn.
  const k = frames.findIndex(
    (f) => f.event.kind === 'take' && f.event.side === 'right' && f.event.compared,
  );
  const prev = frames[k - 1].state.active!;
  const leftHead = LEFT[prev.i];
  const rightHead = RIGHT[prev.j];
  return withAsk(frames, k, {
    prompt: `Con trỏ i đang ở ${leftHead} (dãy trái), j đang ở ${rightHead} (dãy phải). Số nào vào kết quả tiếp theo?`,
    choices: [String(rightHead), String(leftHead), String(LEFT.at(-1))],
    correct: 0,
    explain: `So hai đầu dãy: ${rightHead} < ${leftHead}, nên lấy ${rightHead} và tiến j. Hai dãy đã sort nên số nhỏ nhất còn lại luôn nằm ở một trong hai đầu.`,
  });
})();

const sortMetrics = (f: Frame<MergeState, MergeEvent>): Metric[] => {
  const s = f.state;
  const a = s.active;
  const level = a ? s.rows[a.row][0].size : null;
  const doneGroups = s.rows
    .slice(0, -1)
    .flat()
    .filter((g) => g.size > 0 && g.values.length === g.size).length;
  return [
    { label: 'Đang trộn thành nhóm', value: level === null ? '—' : `${level} phần tử` },
    { label: 'Số lần so sánh', value: String(s.comparisons) },
    { label: 'Nhóm đã trộn xong', value: String(doneGroups) },
    { label: 'Độ phức tạp', value: 'O(n log n)', tone: 'good' },
  ];
};

const SORT_RAW = traceMergeSort(ARR);

export const FULL_SORT = (() => {
  const frames = narrateMerge(SORT_RAW, sortMetrics);
  // Câu đoán ở tầng trên cùng: lần trộn cuối cần nhiều nhất bao nhiêu lần so sánh?
  const k = frames.findIndex((f) => f.event.kind === 'level' && f.event.row === 0);
  return withAsk(frames, k, {
    prompt: `Tầng trên cùng trộn hai nhóm 4 phần tử thành 8. Cần nhiều nhất bao nhiêu lần so sánh?`,
    choices: [String(ARR.length - 1), String(ARR.length), String(ARR.length / 2)],
    correct: 0,
    explain: `Mỗi lần so sánh đưa một phần tử vào kết quả. Khi một bên hết thì chép phần còn lại mà không cần so, nên nhiều nhất là ${ARR.length} - 1 = ${ARR.length - 1} lần.`,
  });
})();

// ---------- Chi phí ----------

export const COST = traceCost(SIZES).map((f): Frame<CostState, CostEvent> => {
  const row = f.state.rows[f.state.shown - 1];
  return {
    ...f,
    holdMs: f.event.kind === 'start' ? 900 : 1400,
    metrics: [
      { label: 'n', value: row ? formatCount(row.n) : '—' },
      { label: 'n log₂ n', value: row ? approx(row.nlogn) : '—', tone: 'good' },
      { label: 'n²', value: row ? formatCount(row.n2) : '—', tone: 'bad' },
      { label: 'Nhanh hơn', value: row ? `${approx(row.n2 / row.nlogn)} lần` : '—' },
    ],
    ask:
      row?.n === 1_000_000
        ? {
            prompt: 'n = 1 triệu. n log₂ n khoảng bao nhiêu?',
            choices: [approx(row.nlogn), formatCount(row.n2), formatCount(row.n)],
            correct: 0,
            explain: `log₂ của 1 triệu xấp xỉ 20, nên n log₂ n ≈ 20 triệu = ${approx(row.nlogn)}. So với n² = ${formatCount(row.n2)}, nhanh hơn khoảng ${approx(row.n2 / row.nlogn)} lần.`,
          }
        : undefined,
  };
});

// ---------- Sort-merge join ----------

export const JOIN = (() => {
  const frames = traceMergeJoin(ORDER_KEYS, CUSTOMER_IDS).map((f): Frame<JoinState, JoinEvent> => {
    const s = f.state;
    const e = f.event;
    const metrics: Metric[] = [
      { label: 'Số lần so', value: String(s.comparisons) },
      { label: 'Cặp khớp', value: String(s.pairs.length), tone: 'good' },
      { label: 'i (orders)', value: String(s.i) },
      { label: 'j (customers)', value: String(s.j) },
    ];
    switch (e.kind) {
      case 'start':
        return { ...f, metrics, codeLines: [2], holdMs: 900 };
      case 'compare':
        return {
          ...f,
          metrics,
          say:
            e.rel === 'lt'
              ? `${e.a} < ${e.b}: tiến i`
              : e.rel === 'gt'
                ? `${e.a} > ${e.b}: tiến j`
                : `${e.a} = ${e.b}: khớp, ghi cặp, tiến i`,
          sayTone: e.rel === 'eq' ? 'good' : undefined,
          codeLines: e.rel === 'lt' ? [4, 5, 6] : e.rel === 'gt' ? [4, 7, 8] : [4, 9, 10, 11],
          holdMs: 1000,
        };
      case 'done':
        return {
          ...f,
          metrics,
          say: `${s.comparisons} lần so cho ${s.left.length + s.right.length} dòng: O(n + m)`,
          sayTone: 'good',
          codeLines: [3],
          holdMs: 1500,
        };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'compare' && f.event.rel === 'gt');
  const e = frames[k].event as Extract<JoinEvent, { kind: 'compare' }>;
  return withAsk(frames, k, {
    prompt: `orders đang ở customer_id ${e.a}, customers đang ở id ${e.b}. Con trỏ nào tiến?`,
    choices: [
      `j (customers), vì ${e.b} < ${e.a}`,
      `i (orders), vì ${e.a} > ${e.b}`,
      'Cả hai cùng tiến',
    ],
    correct: 0,
    explain: `Khách hàng id ${e.b} nhỏ hơn mọi customer_id còn lại bên orders (vì đã sort), nên không đơn nào khớp với nó nữa. Bỏ qua bằng cách tiến j.`,
  });
})();

// ---------- Tóm tắt ----------

function toMergeTable(
  frames: Frame<MergeState, MergeEvent>[],
): Frame<CodeTraceState, MergeEvent>[] {
  const rows: string[][] = [];
  return frames.map((f) => {
    const e = f.event;
    const s = f.state;
    if (e.kind === 'take') {
      const out = s.rows[e.row][e.group];
      if (out.values.length === out.size) {
        const [l, r] = sourcesOf(s);
        rows.push([
          String(out.size),
          l.values.join(' '),
          r?.values.join(' ') ?? '',
          out.values.join(' '),
        ]);
      }
    }
    return {
      state: { rows: rows.map((x) => [...x]) },
      event: e,
      codeLines: takeLines(e),
      holdMs: e.kind === 'take' ? 300 : 900,
      metrics: [
        { label: 'Lần trộn', value: String(rows.length) },
        { label: 'Số lần so sánh', value: String(s.comparisons) },
        { label: 'Bộ nhớ thêm', value: 'O(n)' },
        { label: 'Độ phức tạp', value: 'O(n log n)', tone: 'good' },
      ],
    };
  });
}

const RECAP = toMergeTable(SORT_RAW);

// ---------- Scene ----------

const SplitScene = treeScene({ title: 'CHIA ĐÔI TỪNG TẦNG' });
const MergeTwoScene = treeScene({
  title: 'TRỘN HAI DÃY ĐÃ SORT',
  code: { file: 'merge_sort.py', lines: CODE_SORT },
});
const SortScene = treeScene({
  title: 'TRỘN TỪNG TẦNG, TỪ DƯỚI LÊN',
  code: { file: 'merge_sort.py', lines: CODE_SORT },
});
const JoinScene = joinScene({ code: { file: 'merge_join.py', lines: CODE_JOIN } });
const RecapScene = codeTraceScene({
  file: 'merge_sort.py',
  code: CODE_SORT,
  columns: ['nhóm', 'trái', 'phải', 'kết quả'],
  title: `CÁC LẦN TRỘN KHI SORT ${ARR.length} SỐ`,
});

// ---------- Các bước ----------

const steps = [
  defineStep<MergeState, SplitEvent>({
    id: 'chia',
    short: 'Chia đôi',
    tag: 'Ý TƯỞNG',
    tone: 'mint',
    title: 'Chia để trị: chia tới khi còn 1 phần tử',
    Scene: SplitScene,
    build: () => SPLIT,
    Body: ({ frames }) => {
      const levels = frames.at(-1)!.state.rows.length - 1;
      return (
        <>
          <p>
            Merge sort không cố sort cả mảng một lúc. Nó <b>chia đôi</b> mảng, rồi chia đôi tiếp,
            cho tới khi mỗi nhóm chỉ còn <b>1 phần tử</b>. Nhóm 1 phần tử thì đương nhiên đã sort.
          </p>
          <p>
            {ARR.length} phần tử cần {levels} tầng chia, vì 2<sup>{levels}</sup> = {ARR.length}.
            Phần việc thật nằm ở bước tiếp theo: <b>trộn</b> các nhóm nhỏ đã sort thành nhóm lớn đã
            sort.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Chia để trị: chia bài toán lớn thành các bài toán nhỏ giống hệt, giải từng cái, rồi ghép kết quả lại.',
    },
  }),

  defineStep<MergeState, MergeEvent>({
    id: 'tron',
    short: 'Trộn',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'Trộn hai dãy đã sort',
    Scene: MergeTwoScene,
    build: () => MERGE_TWO,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Hai dãy đã sort: [{LEFT.join(', ')}] và [{RIGHT.join(', ')}]. Con trỏ <b>i</b> ở đầu dãy
            trái, <b>j</b> ở đầu dãy phải. Mỗi lần so hai đầu dãy, lấy số nhỏ hơn và tiến con trỏ
            của dãy đó.
          </p>
          <p>
            {s.rows[0][0].size} phần tử, {s.comparisons} lần so sánh. Khi một dãy hết, phần còn lại
            của dãy kia được chép thẳng vào cuối. Mỗi phần tử đi qua đúng một lần: <b>O(n)</b>.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Số nhỏ nhất còn lại luôn nằm ở đầu một trong hai dãy, nên không bao giờ phải nhìn lùi lại.',
    },
  }),

  defineStep<MergeState, MergeEvent>({
    id: 'ca-qua-trinh',
    short: 'Cả quá trình',
    tag: 'VÒNG LẶP',
    tone: 'lav',
    title: 'Trộn từng tầng, từ dưới lên',
    Scene: SortScene,
    build: () => FULL_SORT,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Bắt đầu từ {ARR.length} nhóm 1 phần tử: trộn từng cặp thành nhóm 2, rồi nhóm 4, rồi nhóm{' '}
            {ARR.length}. Cách cài này gọi là bottom-up: dùng vòng lặp với <code>width</code> nhân
            đôi sau mỗi tầng, không cần đệ quy.
          </p>
          <p>
            Kết quả: [{s.rows[0][0].values.join(', ')}], sau {s.comparisons} lần so sánh. Cách cài
            đệ quy (chia đôi rồi gọi lại chính nó) cho cùng kết quả và cùng số bước.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'ĐÁNH ĐỔI',
      text: 'Merge sort cần thêm bộ nhớ O(n) cho các dãy tạm khi trộn. Đổi lại, nó luôn O(n log n), kể cả trường hợp tệ nhất.',
    },
  }),

  defineStep<CostState, CostEvent>({
    id: 'chi-phi',
    short: 'Vì sao n log n',
    tag: 'BIG-O',
    tone: 'peach',
    title: 'Vì sao là O(n log n)',
    Scene: CostScene,
    build: () => COST,
    Body: () => (
      <>
        <p>
          Mỗi tầng trộn chạm vào mọi phần tử đúng một lần: <b>n bước mỗi tầng</b>. Số tầng là số lần
          chia đôi n cho tới 1: <b>log₂ n tầng</b>. Nhân lại: n log₂ n.
        </p>
        <p>
          So với cách so mọi cặp (n²), khoảng cách giãn ra rất nhanh. Với 1 tỷ dòng, merge sort mất
          vài giờ nếu mỗi bước 1 micro giây; cách n² mất hàng chục nghìn năm.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>sorted()</code> của Python dùng Timsort, một thuật toán lai giữa merge sort và
          insertion sort, trường hợp tệ nhất cũng là O(n log n). Gần như mọi hệ thống sort lớn đều
          dựa trên ý tưởng trộn các dãy đã sort.
        </>
      ),
    },
  }),

  defineStep<JoinState, JoinEvent>({
    id: 'sort-merge-join',
    short: 'Merge join',
    tag: 'ỨNG DỤNG',
    tone: 'sun',
    title: 'Sort-merge join: trộn hai bảng đã sort',
    Scene: JoinScene,
    build: () => JOIN,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Khi cả <code>orders</code> và <code>customers</code> đã sort theo khoá, ghép chúng giống
            hệt bước trộn: hai con trỏ, mỗi lần so thì tiến bên nhỏ hơn, bằng nhau thì ghi một cặp.
          </p>
          <p>
            {s.left.length} đơn và {s.right.length} khách hàng chỉ cần {s.comparisons} lần so, ra{' '}
            {s.pairs.length} cặp. Mỗi con trỏ chỉ tiến, không lùi, nên tốn <b>O(n + m)</b> sau khi
            đã sort, thay vì n × m như nested loop join.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Khi join hai bảng lớn, Spark thường chọn sort-merge join: shuffle cả hai bảng theo khoá, sort từng partition, rồi trộn như trên. Khi dữ liệu không vừa RAM, external sort dùng cùng ý tưởng: sort từng phần vừa RAM, ghi ra đĩa, rồi trộn các phần đó lại.',
    },
  }),

  defineStep<CodeTraceState, MergeEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'mint',
    title: 'Code và những gì cần nhớ',
    Scene: RecapScene,
    build: () => RECAP,
    Body: () => (
      <>
        <p>
          Code bên trái là merge sort bottom-up của bước 3. Bảng ghi lại từng lần trộn: hai nhóm đầu
          vào và nhóm kết quả.
        </p>
        <p>
          Ba điều cần nhớ: trộn hai dãy đã sort chỉ tốn <b>O(n)</b>; có <b>log₂ n</b> tầng nên cả
          quá trình là <b>O(n log n)</b>; và ý tưởng trộn đó chính là sort-merge join.
        </p>
      </>
    ),
  }),
];

export const mergeSortLesson: Lesson = {
  slug: 'merge-sort',
  steps,
  legend: [
    { swatch: 'sun', label: 'con trỏ i, j; nhóm đang trộn' },
    { swatch: 'mint', label: 'vừa lấy, đã sort, khớp' },
    { swatch: 'lav', label: 'phần tử' },
    { dashed: true, label: 'nhóm nguồn, ô trống' },
  ],
  objectives: [
    { text: 'Hiểu chia để trị', step: 0 },
    { text: 'Trộn hai dãy đã sort bằng hai con trỏ', step: 1 },
    { text: 'Theo dõi cả quá trình trộn từng tầng', step: 2 },
    { text: 'Giải thích O(n log n)', step: 3 },
    { text: 'Nối merge sort với sort-merge join', step: 4 },
  ],
  quiz: QUIZ,
};
