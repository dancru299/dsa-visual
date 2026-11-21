import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import {
  childrenOf,
  rootOf,
  sizeOf,
  traceCheck,
  traceKWayMerge,
  traceOps,
  traceTopK,
  type HeapEvent,
  type HeapState,
} from './algorithm';
import { heapScene } from './scenes';

// ---------- Code hiển thị trên trang ----------

const CODE_CHECK = [
  'def is_min_heap(a):',
  '    for i in range(len(a) // 2):        # chỉ các node có con',
  '        for c in (2 * i + 1, 2 * i + 2):',
  '            if c < len(a) and a[i] > a[c]:',
  '                return False',
  '    return True',
];

export const CODE_HEAP = [
  'def push(heap, x):',
  '    heap.append(x)',
  '    i = len(heap) - 1',
  '    while i > 0 and heap[(i - 1) // 2] > heap[i]:',
  '        p = (i - 1) // 2',
  '        heap[i], heap[p] = heap[p], heap[i]',
  '        i = p',
  '',
  'def pop(heap):',
  '    top, last = heap[0], heap.pop()',
  '    if heap:',
  '        heap[0] = last',
  '        i = 0',
  '        while 2 * i + 1 < len(heap):',
  '            c = 2 * i + 1                  # con trái',
  '            if c + 1 < len(heap) and heap[c + 1] < heap[c]:',
  '                c += 1                     # con phải nhỏ hơn',
  '            if heap[i] <= heap[c]:',
  '                break',
  '            heap[i], heap[c] = heap[c], heap[i]',
  '            i = c',
  '    return top',
];

export const CODE_TOPK = [
  'import heapq',
  '',
  'def top_k(amounts, k):',
  '    heap = []                     # min-heap giữ k số lớn nhất',
  '    for x in amounts:',
  '        if len(heap) < k:',
  '            heapq.heappush(heap, x)',
  '        elif x > heap[0]:',
  '            heapq.heapreplace(heap, x)    # bỏ gốc, thêm x',
  '    return sorted(heap, reverse=True)',
];

const CODE_KWAY = [
  'import heapq',
  '',
  'def merge_sorted(lists):',
  '    heap, out = [], []',
  '    for i, lst in enumerate(lists):       # đầu của mỗi dãy',
  '        heapq.heappush(heap, (lst[0], i, 0))',
  '    while heap:',
  '        x, i, j = heapq.heappop(heap)',
  '        out.append(x)',
  '        if j + 1 < len(lists[i]):         # dãy i còn phần tử',
  '            heapq.heappush(heap, (lists[i][j + 1], i, j + 1))',
  '    return out',
];

// ---------- Dữ liệu ----------

export const HEAP = [3, 9, 5, 12, 10, 8, 7];
export const PUSHED = 4;
export const AMOUNTS = [12, 45, 7, 30, 88, 23, 51, 16, 40, 9];
export const K = 3;
export const LISTS = [
  { tag: 'A', values: [1, 4, 9] },
  { tag: 'B', values: [2, 3, 10] },
  { tag: 'C', values: [5, 6, 7] },
];

type F = Frame<HeapState, HeapEvent>;
type Dir = 'up' | 'down';

// Bối cảnh để chọn dòng code. swap và settle không ghi hướng, nên lấy theo thao tác gần nhất.
type Ctx = { dir: Dir | null; prev: HeapEvent | undefined; k: number };

const withAsk = (frames: F[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const descending = (s: HeapState) => s.heap.map((n) => n.value).sort((a, b) => b - a);

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

// ---------- Lời dẫn ----------

function narrate(
  frames: F[],
  lines: (e: HeapEvent, c: Ctx) => number[],
  metrics: (f: F, k: number) => Metric[],
): F[] {
  let dir: Dir | null = null;
  return frames.map((f, k) => {
    const e = f.event;
    const h = f.state.heap;
    if (e.kind === 'compare') dir = e.dir;
    if (e.kind === 'append') dir = 'up';
    if (e.kind === 'move-last' || e.kind === 'replace') dir = 'down';
    const base = {
      ...f,
      metrics: metrics(f, k),
      codeLines: lines(e, { dir, prev: frames[k - 1]?.event, k }),
    };
    switch (e.kind) {
      case 'start':
        return { ...base, holdMs: 1000 };
      case 'check': {
        const kids = e.children.map((c) => `[${c}] = ${h[c].value}`).join(', ');
        return { ...base, say: `[${e.i}] = ${h[e.i].value} ≤ con ${kids}`, holdMs: 1400 };
      }
      case 'append':
        return { ...base, say: `thêm ${e.value} vào cuối mảng, index ${e.index}`, holdMs: 1100 };
      case 'compare': {
        const a = h[e.i].value;
        const b = h[e.j].value;
        if (e.dir === 'up') {
          const wrong = b > a;
          return {
            ...base,
            say: wrong ? `${a} < cha ${b}: sai thứ tự` : `${a} ≥ cha ${b}: đúng thứ tự`,
            sayTone: wrong ? 'bad' : 'good',
            holdMs: 1100,
          };
        }
        const wrong = a > b;
        const two = childrenOf(e.i).every((c) => c < h.length);
        const who = two ? 'con nhỏ hơn' : 'con';
        return {
          ...base,
          say: wrong ? `${a} > ${who} ${b}: sai thứ tự` : `${a} ≤ ${who} ${b}: đúng thứ tự`,
          sayTone: wrong ? 'bad' : 'good',
          holdMs: 1100,
        };
      }
      case 'swap':
        return { ...base, say: `đổi chỗ [${e.j}] và [${e.i}]`, holdMs: 900 };
      case 'settle':
        return { ...base, say: `dừng ở index ${e.index}`, holdMs: 900 };
      case 'take-root':
        return {
          ...base,
          say: `nhấc gốc ${e.value} ra: số nhỏ nhất`,
          sayTone: 'good',
          holdMs: 1200,
        };
      case 'move-last':
        return { ...base, say: `đưa phần tử cuối (${e.value}) lên gốc`, holdMs: 1200 };
      case 'arrive':
        return { ...base, say: `đến: ${e.value}`, holdMs: 700 };
      case 'skip':
        return { ...base, say: `${e.value} ≤ gốc ${e.root}: bỏ qua`, holdMs: 1000 };
      case 'replace':
        return {
          ...base,
          say: `${e.value} > gốc ${e.old}: thay gốc bằng ${e.value}`,
          holdMs: 1100,
        };
      case 'emit':
        return {
          ...base,
          say: `lấy ${e.value} (dãy ${e.tag}) ra kết quả`,
          sayTone: 'good',
          holdMs: 1000,
        };
      case 'done':
        return { ...base, holdMs: 1500 };
    }
  });
}

// Dòng code của push, pop trong CODE_HEAP.
function heapLines(e: HeapEvent, { dir, prev }: Ctx): number[] {
  switch (e.kind) {
    case 'append':
      return [2, 3];
    case 'compare':
      return dir === 'up' ? [4] : [14, 15, 16, 17, 18];
    case 'swap':
      return dir === 'up' ? [5, 6, 7] : [20, 21];
    case 'settle':
      // Đi xuống: dừng vì đã đúng thứ tự (break) hoặc vì hết con (vòng while kết thúc).
      return dir === 'up' ? [4] : prev?.kind === 'compare' ? [18, 19] : [14];
    case 'take-root':
      return [10];
    case 'move-last':
      return [11, 12, 13];
    default:
      return [];
  }
}

const heapMetrics =
  (frames: F[]) =>
  (f: F, k: number): Metric[] => [
    { label: 'Số phần tử', value: String(sizeOf(f.state)) },
    { label: 'Gốc (nhỏ nhất)', value: String(rootOf(f.state)?.value ?? '—') },
    {
      label: 'Số lần đổi chỗ',
      value: String(frames.slice(0, k + 1).filter((x) => x.event.kind === 'swap').length),
    },
    { label: 'Độ phức tạp', value: 'O(log n)', tone: 'good' },
  ];

// ---------- Cấu trúc ----------

export const CHECK = (() => {
  const frames = narrate(
    traceCheck(HEAP),
    (e) => (e.kind === 'check' ? [2, 3, 4] : e.kind === 'done' ? [6] : []),
    (f) => {
      const e = f.event;
      return [
        { label: 'Số phần tử', value: String(f.state.heap.length) },
        { label: 'Đang xét', value: e.kind === 'check' ? `[${e.i}]` : '—' },
        {
          label: 'Con của nó',
          value: e.kind === 'check' ? e.children.map((c) => `[${c}]`).join(', ') : '—',
        },
        { label: 'Gốc (nhỏ nhất)', value: String(f.state.heap[0].value), tone: 'good' },
      ];
    },
  );
  setSay(frames, 0, `mảng ${HEAP.length} số, đọc như một cây`);
  setSay(frames, frames.length - 1, 'mọi cha đều ≤ con: đây là một min-heap', {
    sayTone: 'good',
  });
  const k = frames.findIndex((f) => f.event.kind === 'check' && f.event.i === 1);
  return withAsk(frames, k, {
    prompt: 'Node ở index 1. Hai con của nó nằm ở index nào?',
    choices: [childrenOf(1).join(' và '), '2 và 3', '1 và 2'],
    correct: 0,
    explain:
      'Con của index i nằm ở 2i + 1 và 2i + 2. Với i = 1 là index 3 và 4. Không cần con trỏ nào, chỉ một phép tính.',
  });
})();

// ---------- push ----------

const PUSH_RAW = traceOps(HEAP, [{ kind: 'push', value: PUSHED }]);
export const AFTER_PUSH = PUSH_RAW.at(-1)!.state.heap.map((n) => n.value);

export const PUSH = (() => {
  const frames = narrate(PUSH_RAW, heapLines, heapMetrics(PUSH_RAW));
  setSay(frames, 0, `push(${PUSHED}) vào heap ${HEAP.length} số`);
  setSay(frames, frames.length - 1, `${PUSHED} đã đúng chỗ, mọi cha vẫn ≤ con`, {
    sayTone: 'good',
  });
  // Các cha mà số mới lần lượt được so khi nổi lên.
  const parents = PUSH_RAW.flatMap((f) =>
    f.event.kind === 'compare' ? [f.state.heap[f.event.j].value] : [],
  );
  const finalIndex = AFTER_PUSH.indexOf(PUSHED);
  const k = frames.findIndex((f) => f.event.kind === 'append');
  return withAsk(frames, k, {
    prompt: `${PUSHED} sẽ được thêm vào cuối mảng, index ${HEAP.length}, rồi đổi chỗ với cha cho tới khi đúng thứ tự. Nó dừng ở index nào?`,
    choices: [String(finalIndex), '0', String(HEAP.length)],
    correct: 0,
    explain: `${PUSHED} nhỏ hơn ${parents.slice(0, -1).join(' và ')} nên đổi lên, nhưng không nhỏ hơn ${parents.at(-1)} nên dừng ở index ${finalIndex}. Mỗi lần đổi đi lên một tầng.`,
  });
})();

// ---------- pop ----------

const POP_RAW = traceOps(AFTER_PUSH, [{ kind: 'pop' }]);

export const POP = (() => {
  const frames = narrate(POP_RAW, heapLines, heapMetrics(POP_RAW));
  setSay(frames, 0, `pop() trên heap ${AFTER_PUSH.length} số`);
  setSay(
    frames,
    frames.length - 1,
    `gốc mới là ${POP_RAW.at(-1)!.state.heap[0].value}, số nhỏ nhất còn lại`,
    { sayTone: 'good', codeLines: [22] },
  );
  const k = frames.findIndex((f) => f.event.kind === 'compare' && f.event.dir === 'down');
  const s = frames[k].state;
  const root = s.heap[0].value;
  const [l, r] = childrenOf(0).map((c) => s.heap[c].value);
  return withAsk(frames, k, {
    prompt: `${root} vừa lên gốc, hai con của nó là ${l} và ${r}. ${root} đổi chỗ với con nào?`,
    choices: [String(Math.min(l, r)), String(Math.max(l, r)), 'Không đổi'],
    correct: 0,
    explain: `Đổi với con nhỏ hơn, ${Math.min(l, r)}. Nó lên làm cha của ${Math.max(l, r)} và vẫn ≤ ${Math.max(l, r)}. Đổi với ${Math.max(l, r)} thì cha mới lớn hơn con ${Math.min(l, r)}: hỏng heap.`,
  });
})();

// ---------- Top-K ----------

const TOPK_RAW = traceTopK(AMOUNTS, K);

function topKLines(e: HeapEvent, { dir }: Ctx): number[] {
  switch (e.kind) {
    case 'start':
      return [4];
    case 'arrive':
      return [5];
    case 'append':
      return [6, 7];
    case 'skip':
      return [8];
    case 'replace':
      return [8, 9];
    case 'done':
      return [10];
    default:
      // so sánh, đổi chỗ bên trong heappush (đi lên) hoặc heapreplace (đi xuống)
      return dir === 'up' ? [7] : [9];
  }
}

export const TOPK = (() => {
  const frames = narrate(TOPK_RAW, topKLines, (f) => {
    const read = f.event.kind === 'done' ? AMOUNTS.length : (f.state.cursor ?? -1) + 1;
    return [
      { label: 'Đã đọc', value: `${read}/${AMOUNTS.length}` },
      {
        label: 'Ngưỡng (gốc)',
        value: sizeOf(f.state) < K ? '—' : String(rootOf(f.state)!.value),
      },
      { label: 'Bỏ qua', value: String(f.state.skipped.length) },
      { label: 'Độ phức tạp', value: 'O(n log k)', tone: 'good' },
    ];
  });
  setSay(frames, 0, `tìm ${K} số lớn nhất trong ${AMOUNTS.length} số`);
  setSay(frames, frames.length - 1, `top ${K}: ${descending(TOPK_RAW.at(-1)!.state).join(', ')}`, {
    sayTone: 'good',
  });
  const k = frames.findIndex((f) => f.event.kind === 'skip');
  const e = frames[k].event as Extract<HeapEvent, { kind: 'skip' }>;
  return withAsk(frames, k, {
    prompt: `Gốc heap là ${e.root}, số nhỏ nhất trong top ${K} hiện tại. ${e.value} vừa đến. Có đưa ${e.value} vào heap không?`,
    choices: [
      `Không, ${e.value} < ${e.root} nên bỏ qua`,
      `Có, thay gốc ${e.root} bằng ${e.value}`,
      `Có, thêm ${e.value} vào cuối heap`,
    ],
    correct: 0,
    explain: `Muốn vào top ${K} thì phải lớn hơn số nhỏ nhất đang ở trong top, tức là gốc ${e.root}. ${e.value} không đủ, nên chỉ một phép so là bỏ qua được, không đụng tới heap.`,
  });
})();

// ---------- k-way merge ----------

const KWAY_RAW = traceKWayMerge(LISTS);
const FIRST_EMIT = KWAY_RAW.findIndex((f) => f.event.kind === 'emit');

function kWayLines(e: HeapEvent, { dir, k }: Ctx): number[] {
  const setup = k < FIRST_EMIT; // đang đưa đầu của mỗi dãy vào heap
  switch (e.kind) {
    case 'start':
      return [4];
    case 'append':
      return setup ? [5, 6] : [10, 11];
    case 'emit':
      return [7, 8, 9];
    case 'move-last':
      return [8];
    case 'done':
      return [12];
    default:
      return dir === 'down' ? [8] : setup ? [6] : [11];
  }
}

export const KWAY = (() => {
  const total = LISTS.reduce((n, l) => n + l.values.length, 0);
  const frames = narrate(KWAY_RAW, kWayLines, (f) => {
    const root = rootOf(f.state);
    return [
      { label: 'Đã ra', value: `${f.state.out.length}/${total}` },
      { label: 'Trong heap', value: String(sizeOf(f.state)) },
      { label: 'Gốc', value: root ? `${root.value} (${root.tag})` : '—' },
      { label: 'Độ phức tạp', value: 'O(N log k)', tone: 'good' },
    ];
  });
  setSay(frames, 0, `${LISTS.length} dãy đã sort, trộn thành một`);
  setSay(frames, frames.length - 1, `xong: ${total} số đã sort`, { sayTone: 'good' });
  // Câu đoán ở lần đầu tiên một dãy thắng hai lần liền: heap không chia lượt giữa các dãy.
  const emits = frames.flatMap((f, k) => (f.event.kind === 'emit' ? [{ k, e: f.event }] : []));
  const at = emits.findIndex((x, i) => i > 0 && x.e.tag === emits[i - 1].e.tag);
  const { k, e } = emits[at];
  const before = emits[at - 1].e;
  const label = (n: { value: number; tag?: string }) => `${n.value} (dãy ${n.tag})`;
  const heads = frames[k - 1].state.heap;
  return withAsk(frames, k, {
    prompt: `Vừa lấy ${before.value} của dãy ${before.tag}, rồi đưa phần tử kế tiếp của dãy ${before.tag} vào heap. Số nào ra kết quả tiếp theo?`,
    choices: [
      label(heads.find((n) => n.value === e.value)!),
      ...heads.filter((n) => n.value !== e.value).map(label),
    ],
    correct: 0,
    explain: `Gốc luôn là số nhỏ nhất trong các đầu dãy, ở đây là ${e.value}. Nó lại thuộc dãy ${e.tag}: heap không chia lượt giữa các dãy, nó chỉ so giá trị.`,
  });
})();

// ---------- Tóm tắt ----------

// Bảng các quyết định của Top-K: một hàng cho mỗi số đến.
function toTopKTable(frames: F[]): Frame<CodeTraceState, HeapEvent>[] {
  const rows: string[][] = [];
  const table: Frame<CodeTraceState, HeapEvent>[] = [];
  let decision = { text: '', lines: [] as number[] };
  for (const f of frames) {
    const e = f.event;
    const s = f.state;
    if (e.kind === 'append') decision = { text: 'thêm vào', lines: [6, 7] };
    if (e.kind === 'replace') decision = { text: `thay gốc ${e.old}`, lines: [8, 9] };
    if (e.kind === 'skip') decision = { text: 'bỏ qua', lines: [8] };
    const decided = e.kind === 'skip' || e.kind === 'settle';
    if (decided) {
      rows.push([
        String(s.stream![s.cursor!]),
        decision.text,
        String(s.heap[0].value),
        s.heap.map((n) => n.value).join(' '),
      ]);
    }
    if (!decided && e.kind !== 'start' && e.kind !== 'done') continue;
    table.push({
      state: { rows: rows.map((r) => [...r]) },
      event: e,
      codeLines: e.kind === 'start' ? [4] : e.kind === 'done' ? [10] : decision.lines,
      holdMs: e.kind === 'done' ? 1500 : 900,
      metrics: [
        { label: 'Đã đọc', value: `${rows.length}/${AMOUNTS.length}` },
        { label: 'Ngưỡng (gốc)', value: s.heap.length < K ? '—' : String(s.heap[0].value) },
        { label: 'Bộ nhớ', value: `${K} phần tử` },
        { label: 'Cả dòng', value: 'O(n log k)', tone: 'good' },
      ],
    });
  }
  return table;
}

export const RECAP = toTopKTable(TOPK_RAW);

// ---------- Scene ----------

const CheckScene = heapScene({
  title: 'MIN-HEAP: CHA ≤ CON',
  code: { file: 'is_min_heap.py', lines: CODE_CHECK },
  slots: HEAP.length,
});
const PushScene = heapScene({
  title: 'MIN-HEAP',
  code: { file: 'heap.py', lines: CODE_HEAP },
  slots: HEAP.length + 1,
});
const PopScene = heapScene({
  title: 'MIN-HEAP',
  code: { file: 'heap.py', lines: CODE_HEAP },
  slots: HEAP.length + 1,
  outTitle: 'ĐÃ LẤY RA',
});
const TopKScene = heapScene({
  title: `MIN-HEAP GIỮ TOP ${K}`,
  code: { file: 'top_k.py', lines: CODE_TOPK },
  slots: K,
});
const KWayScene = heapScene({
  title: 'HEAP GIỮ ĐẦU CỦA MỖI DÃY',
  code: { file: 'merge_sorted.py', lines: CODE_KWAY },
  slots: LISTS.length,
  outTitle: 'KẾT QUẢ ĐÃ SORT',
});
const RecapScene = codeTraceScene({
  file: 'top_k.py',
  code: CODE_TOPK,
  columns: ['số đến', 'quyết định', 'gốc', 'heap'],
  title: `TOP ${K} TRÊN DÒNG ${AMOUNTS.length} SỐ`,
});

// ---------- Các bước ----------

const steps = [
  defineStep<HeapState, HeapEvent>({
    id: 'cau-truc',
    short: 'Cấu trúc',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Một cái cây nằm trong một mảng',
    Scene: CheckScene,
    build: () => CHECK,
    Body: () => (
      <>
        <p>
          Heap lưu trong một list bình thường, nhưng ta đọc nó như một cây: phần tử ở index{' '}
          <code>i</code> có hai con ở <code>2i + 1</code> và <code>2i + 2</code>, cha ở{' '}
          <code>(i - 1) // 2</code>. Không có con trỏ nào, chỉ có phép tính trên index.
        </p>
        <p>
          <b>Min-heap</b> có đúng một quy tắc: mỗi cha ≤ các con của nó. Vì vậy số nhỏ nhất luôn ở
          gốc, index 0, xem được trong O(1). Hai node anh em thì không cần theo thứ tự nào.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Heap không sort cả mảng. Nó chỉ giữ vừa đủ trật tự để biết ngay số nhỏ nhất, và sửa lại trật tự đó rất rẻ.',
    },
  }),

  defineStep<HeapState, HeapEvent>({
    id: 'push',
    short: 'push',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'push: thêm vào cuối, rồi nổi lên',
    Scene: PushScene,
    build: () => PUSH,
    Body: ({ frames }) => {
      const swaps = frames.filter((f) => f.event.kind === 'swap').length;
      const levels = Math.floor(Math.log2(AFTER_PUSH.length)) + 1;
      return (
        <>
          <p>
            Thêm {PUSHED} vào cuối list, tức là chỗ trống đầu tiên ở tầng dưới cùng. Rồi so với cha:
            nhỏ hơn cha thì đổi chỗ, cứ thế đi lên. Cách này gọi là <b>sift up</b>.
          </p>
          <p>
            {PUSHED} đổi chỗ {swaps} lần. Cây {AFTER_PUSH.length} phần tử có {levels} tầng, mỗi lần
            đổi đi lên một tầng, nên push tốn nhiều nhất khoảng log₂ n bước: <b>O(log n)</b>.
          </p>
        </>
      );
    },
  }),

  defineStep<HeapState, HeapEvent>({
    id: 'pop',
    short: 'pop',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'pop: lấy gốc, rồi cho phần tử cuối chìm xuống',
    Scene: PopScene,
    build: () => POP,
    Body: () => (
      <>
        <p>
          Gốc là số nhỏ nhất: nhấc nó ra. Để lấp chỗ trống, đưa phần tử <b>cuối list</b> lên gốc,
          rồi so với con nhỏ hơn: lớn hơn con thì đổi chỗ, cứ thế đi xuống. Cách này gọi là{' '}
          <b>sift down</b>.
        </p>
        <p>
          Cũng nhiều nhất khoảng log₂ n bước: <b>O(log n)</b>. Vì push và pop đều rẻ, heap là cách
          cài chuẩn của <b>priority queue</b>: hàng đợi mà phần tử ưu tiên nhất luôn ra trước, ví dụ
          job có deadline sớm nhất trong một scheduler.
        </p>
      </>
    ),
    callout: {
      kind: 'warn',
      title: 'CHÚ Ý',
      text: 'Khi chìm xuống phải đổi với con nhỏ hơn. Đổi với con lớn hơn thì con nhỏ hơn sẽ nằm dưới một cha lớn hơn nó, và quy tắc heap bị phá.',
    },
  }),

  defineStep<HeapState, HeapEvent>({
    id: 'top-k',
    short: 'Top-K',
    tag: 'ỨNG DỤNG',
    tone: 'sun',
    title: `Top ${K} trên một dòng dữ liệu`,
    Scene: TopKScene,
    build: () => TOPK,
    Body: ({ frames }) => {
      const last = frames.at(-1)!.state;
      return (
        <>
          <p>
            Tìm {K} đơn hàng lớn nhất trong {AMOUNTS.length} đơn mà không sort cả dòng. Giữ một{' '}
            <b>min-heap đúng {K} phần tử</b>: gốc là số nhỏ nhất trong top hiện tại, cũng là{' '}
            <b>ngưỡng</b> để vào top.
          </p>
          <p>
            Số mới lớn hơn gốc thì thay gốc; không thì bỏ qua sau đúng một phép so. Ở đây{' '}
            {last.skipped.length} số bị bỏ qua, kết quả là {descending(last).join(', ')}. Tốn O(n
            log k) thời gian và chỉ <b>O(k) bộ nhớ</b>, dù dòng dữ liệu dài bao nhiêu.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>heapq.nlargest(k, data)</code> của Python làm đúng như vậy. Với dữ liệu chảy liên
          tục (stream), đây là cách giữ &quot;top 10 sản phẩm bán chạy&quot; mà không phải lưu lại
          mọi đơn hàng.
        </>
      ),
    },
  }),

  defineStep<HeapState, HeapEvent>({
    id: 'k-way',
    short: 'Trộn k dãy',
    tag: 'ỨNG DỤNG',
    tone: 'lav',
    title: 'Trộn k dãy đã sort',
    Scene: KWayScene,
    build: () => KWAY,
    Body: ({ frames }) => {
      const out = frames.at(-1)!.state.out.map((n) => n.value);
      return (
        <>
          <p>
            Bài Merge sort trộn hai dãy bằng hai con trỏ. Với {LISTS.length} dãy trở lên, đặt{' '}
            <b>phần tử đầu của mỗi dãy</b> vào heap. Gốc là số nhỏ nhất trong các đầu dãy: lấy nó
            ra, rồi đưa phần tử kế tiếp của chính dãy đó vào.
          </p>
          <p>
            Heap không bao giờ quá k = {LISTS.length} phần tử, nên mỗi số tốn O(log k). Trong
            Python, mỗi phần tử của heap là bộ <code>(giá trị, dãy, vị trí)</code> để biết lấy tiếp
            từ đâu. Kết quả: {out.join(', ')}.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Đây là bước trộn của external sort: dữ liệu lớn hơn RAM được sort thành nhiều file nhỏ,
          rồi trộn k file cùng lúc bằng heap. Trong Python, <code>heapq.merge()</code> làm sẵn việc
          này cho các iterator đã sort, đọc từng dòng nên không cần nạp hết vào RAM.
        </>
      ),
    },
  }),

  defineStep<CodeTraceState, HeapEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'peach',
    title: 'Code và những gì cần nhớ',
    Scene: RecapScene,
    build: () => RECAP,
    Body: () => (
      <>
        <p>
          Code bên trái là Top-K bằng <code>heapq</code> của bước 4. Bảng ghi lại quyết định với
          từng số đến: thêm khi heap chưa đủ {K}, thay gốc khi lớn hơn gốc, còn lại bỏ qua.
        </p>
        <p>
          Ba điều cần nhớ: heap là một <b>list</b> với quy tắc cha ≤ con; push và pop đều{' '}
          <b>O(log n)</b>; và hai ứng dụng hay gặp là <b>Top-K</b> và <b>trộn k dãy đã sort</b>.
        </p>
      </>
    ),
  }),
];

export const heapLesson: Lesson = {
  slug: 'heap',
  steps,
  legend: [
    { swatch: 'sun', label: 'đang so sánh' },
    { swatch: 'mint', label: 'vừa đổi chỗ, đã lấy ra' },
    { swatch: 'lav', label: 'phần tử trong heap' },
    { dashed: true, label: 'ô trống, gốc vừa nhấc ra' },
  ],
  objectives: [
    { text: 'Đọc một list như một cây: 2i + 1, 2i + 2', step: 0 },
    { text: 'Hiểu push và sift up', step: 1 },
    { text: 'Hiểu pop và sift down', step: 2 },
    { text: 'Tìm Top-K bằng min-heap k phần tử', step: 3 },
    { text: 'Trộn k dãy đã sort bằng heap', step: 4 },
  ],
};
