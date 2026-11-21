import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import {
  balancedHeight,
  build,
  comparesOf,
  heightOf,
  shuffled,
  traceInorder,
  traceInsert,
  traceRange,
  traceSearch,
  type BstEvent,
  type BstState,
} from './algorithm';
import { QUIZ } from './quiz';
import { bstScene } from './scenes';

// ---------- Dữ liệu ----------

export const KEYS = [50, 30, 70, 20, 40, 60, 80, 45, 65]; // thứ tự chèn để dựng cây ban đầu
export const TARGET = 65;
export const ADDED = 55;
export const RANGE: [number, number] = [40, 65];
export const SORTED_KEYS = [10, 20, 30, 40, 50, 60];
export const SIZES = [15, 127, 1023];
const SEED = 2026;

const TREE = build(KEYS);
const ROOT = TREE.root!;
const HEIGHT = heightOf(TREE);

// ---------- Code hiển thị trên trang ----------

export const CODE_SEARCH = [
  'def search(node, key):',
  '    while node is not None:',
  '        if key == node.key:',
  '            return node',
  '        if key < node.key:',
  '            node = node.left',
  '        else:',
  '            node = node.right',
  '    return None              # rơi ra chỗ trống: không có',
];

export const CODE_INSERT = [
  'def insert(root, key):',
  '    if root is None:',
  '        return Node(key)',
  '    node = root',
  '    while True:',
  '        if key < node.key:',
  '            if node.left is None:',
  '                node.left = Node(key)',
  '                return root',
  '            node = node.left',
  '        else:',
  '            if node.right is None:',
  '                node.right = Node(key)',
  '                return root',
  '            node = node.right',
];

const CODE_INORDER = [
  'def inorder(node, out):',
  '    if node is None:',
  '        return',
  '    inorder(node.left, out)',
  '    out.append(node.key)',
  '    inorder(node.right, out)',
];

const CODE_RANGE = [
  'def range_query(node, lo, hi, out):',
  '    if node is None:',
  '        return',
  '    if lo < node.key:            # bên trái còn có thể có số ≥ lo',
  '        range_query(node.left, lo, hi, out)',
  '    if lo <= node.key <= hi:',
  '        out.append(node.key)',
  '    if node.key < hi:            # bên phải còn có thể có số ≤ hi',
  '        range_query(node.right, lo, hi, out)',
];

// ---------- Tiện ích ----------

type F = Frame<BstState, BstEvent>;

const withAsk = (frames: F[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

const sideVi = (side: 'left' | 'right') => (side === 'left' ? 'trái' : 'phải');
const comparesSoFar = (frames: F[], k: number) => comparesOf(frames.slice(0, k + 1));

// ---------- Bước 1: tìm ----------

const SEARCH_RAW = traceSearch(KEYS, TARGET);

export const SEARCH = (() => {
  const frames = SEARCH_RAW.map((f, k): F => {
    const e = f.event;
    const s = f.state;
    const depth = s.nodes.find((n) => n.key === s.current)?.depth;
    const base = {
      ...f,
      metrics: [
        { label: 'Số node', value: String(s.nodes.length) },
        { label: 'Đã so', value: String(comparesSoFar(SEARCH_RAW, k)) },
        { label: 'Tầng đang xét', value: depth === undefined ? '—' : String(depth + 1) },
        { label: 'Chiều cao cây', value: String(HEIGHT) },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'start':
        return {
          ...base,
          say: `tìm ${TARGET}, bắt đầu ở gốc ${ROOT}`,
          codeLines: [1],
          holdMs: 1200,
        };
      case 'compare':
        return {
          ...base,
          say:
            e.go === 'found'
              ? `${e.target} = ${e.key}: tìm thấy`
              : `${e.target} ${e.go === 'left' ? '<' : '>'} ${e.key}: sang ${sideVi(e.go)}`,
          sayTone: e.go === 'found' ? 'good' : undefined,
          codeLines:
            e.go === 'found' ? [2, 3, 4] : e.go === 'left' ? [2, 3, 5, 6] : [2, 3, 5, 7, 8],
          holdMs: 1200,
        };
      case 'found':
        return {
          ...base,
          say: `tìm thấy ${e.key} sau ${comparesSoFar(SEARCH_RAW, k)} lần so`,
          sayTone: 'good',
          codeLines: [4],
          holdMs: 1400,
        };
      default:
        return { ...base, holdMs: 1200 };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'compare');
  const total = comparesOf(SEARCH_RAW);
  return withAsk(frames, k, {
    prompt: `Tìm ${TARGET} trong cây ${KEYS.length} node này. Cần so bao nhiêu lần?`,
    choices: [String(total), String(KEYS.length), '2'],
    correct: 0,
    explain: `Mỗi lần so đi xuống một tầng và bỏ hẳn nhánh còn lại: ${SEARCH_RAW.at(-1)!.state.path.join(' → ')} là ${total} lần, bằng số tầng tới ${TARGET}. Không cần so với cả ${KEYS.length} node.`,
  });
})();

// ---------- Bước 2 và 5: chèn ----------

function insertLines(e: BstEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [4];
    case 'compare':
      return e.go === 'left' ? [6, 7, 10] : [6, 11, 12, 15];
    case 'empty':
      return e.side === 'left' ? [7, 8] : [12, 13];
    case 'insert':
      return e.side === null ? [2, 3] : e.side === 'left' ? [8, 9] : [13, 14];
    default:
      return [];
  }
}

function narrateInsert(raw: F[], metrics: (f: F, k: number) => Metric[]): F[] {
  return raw.map((f, k) => {
    const e = f.event;
    const base = { ...f, metrics: metrics(f, k), codeLines: insertLines(e) };
    switch (e.kind) {
      case 'compare':
        return {
          ...base,
          say: `${e.target} ${e.go === 'left' ? '<' : '>'} ${e.key}: sang ${sideVi(e.go === 'left' ? 'left' : 'right')}`,
          holdMs: 1000,
        };
      case 'empty':
        return {
          ...base,
          say: `bên ${sideVi(e.side)} của ${e.parent} còn trống`,
          holdMs: 1200,
        };
      case 'insert':
        return {
          ...base,
          say:
            e.parent === null
              ? `cây rỗng: ${e.key} thành gốc`
              : `gắn ${e.key} làm con ${sideVi(e.side!)} của ${e.parent}`,
          sayTone: 'good',
          holdMs: 1100,
        };
      default:
        return { ...base, holdMs: 1200 };
    }
  });
}

const INSERT_RAW = traceInsert(KEYS, [ADDED]);

export const INSERT = (() => {
  const frames = narrateInsert(INSERT_RAW, (f, k) => [
    { label: 'Số node', value: String(f.state.nodes.length) },
    { label: 'Đã so', value: String(comparesSoFar(INSERT_RAW, k)) },
    { label: 'Chiều cao cây', value: String(Math.max(...f.state.nodes.map((n) => n.depth)) + 1) },
    { label: 'Phải dời', value: '0 node', tone: 'good' },
  ]);
  setSay(frames, 0, `chèn ${ADDED}: đi xuống như khi tìm`);
  const k = frames.findIndex((f) => f.event.kind === 'empty');
  const e = frames[k].event as Extract<BstEvent, { kind: 'empty' }>;
  return withAsk(frames, k, {
    prompt: `Ở ${e.parent}, ${ADDED} ${e.side === 'left' ? '<' : '>'} ${e.parent} nên sang ${sideVi(e.side)}, nhưng bên ${sideVi(e.side)} của ${e.parent} đang trống. Chuyện gì xảy ra?`,
    choices: [
      `Gắn ${ADDED} vào đúng chỗ trống đó: con ${sideVi(e.side)} của ${e.parent}`,
      'Quay lại gốc tìm chỗ khác',
      `Đẩy ${e.parent} xuống, đặt ${ADDED} vào chỗ của ${e.parent}`,
    ],
    correct: 0,
    explain: `Chèn chính là tìm: đi xuống như khi tìm ${ADDED}, rơi ra chỗ trống nào thì gắn vào đó. Không node nào phải dời chỗ, nên chèn tốn bằng số tầng đi qua.`,
  });
})();

// ---------- Bước 3: duyệt in-order ----------

const INORDER_RAW = traceInorder(KEYS);

export const INORDER = (() => {
  const frames = INORDER_RAW.map((f): F => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      metrics: [
        { label: 'Đã in', value: `${s.out.length}/${KEYS.length}` },
        { label: 'Đang ở', value: s.current === null ? '—' : String(s.current) },
        { label: 'Độ sâu đệ quy', value: String(s.path.length) },
        { label: 'Độ phức tạp', value: 'O(n)', tone: 'good' },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'visit':
        return {
          ...base,
          say: `tới ${e.key}: in hết cây con trái trước`,
          codeLines: [1, 4],
          holdMs: 900,
        };
      case 'emit':
        return { ...base, say: `in ${e.key}`, codeLines: [5], holdMs: 900 };
      case 'done':
        return {
          ...base,
          say: `in ra: ${s.out.join(', ')}`,
          sayTone: 'good',
          codeLines: [],
          holdMs: 1600,
        };
      default:
        return { ...base, say: `duyệt từ gốc ${ROOT}: trái, node, phải`, holdMs: 1200 };
    }
  });
  const first = INORDER_RAW.find((f) => f.event.kind === 'emit')!.event as Extract<
    BstEvent,
    { kind: 'emit' }
  >;
  const k = frames.findIndex((f) => f.event.kind === 'visit');
  return withAsk(frames, k, {
    prompt: `Duyệt in-order từ gốc ${ROOT}: cây con trái, rồi node, rồi cây con phải. Số nào được in ra đầu tiên?`,
    choices: [String(first.key), String(ROOT), String(TREE.nodes[ROOT].left)],
    correct: 0,
    explain: `Trước khi in ${ROOT} phải in hết cây con trái của nó; trước khi in ${TREE.nodes[ROOT].left} cũng vậy. Cứ thế xuống tận node trái nhất: ${first.key}, số nhỏ nhất của cây.`,
  });
})();

// ---------- Bước 4: truy vấn khoảng ----------

const RANGE_RAW = traceRange(KEYS, ...RANGE);

export const RANGED = (() => {
  const [lo, hi] = RANGE;
  const frames = RANGE_RAW.map((f): F => {
    const e = f.event;
    const s = f.state;
    const visited = new Set(
      RANGE_RAW.slice(0, RANGE_RAW.indexOf(f) + 1).flatMap((x) =>
        x.event.kind === 'visit' ? [x.event.key] : [],
      ),
    );
    const base = {
      ...f,
      metrics: [
        { label: 'Đã lấy', value: String(s.out.length) },
        { label: 'Đã xem', value: `${visited.size}/${KEYS.length}` },
        { label: 'Bỏ qua', value: String(s.pruned.length), tone: 'good' },
        { label: 'Khoảng', value: `[${lo}, ${hi}]` },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'visit':
        return { ...base, say: `tới ${e.key}`, codeLines: [1, 4], holdMs: 900 };
      case 'prune':
        return {
          ...base,
          say:
            e.side === 'left'
              ? `${e.key} ≤ ${lo}: bên trái toàn số nhỏ hơn ${e.key}, bỏ qua ${e.skipped.join(', ')}`
              : `${e.key} ≥ ${hi}: bên phải toàn số lớn hơn ${e.key}, bỏ qua ${e.skipped.join(', ')}`,
          sayTone: 'good',
          codeLines: e.side === 'left' ? [4] : [8],
          holdMs: 1500,
        };
      case 'emit':
        return {
          ...base,
          say: `${e.key} nằm trong [${lo}, ${hi}]: lấy`,
          codeLines: [6, 7],
          holdMs: 900,
        };
      case 'done':
        return {
          ...base,
          say: `lấy ${s.out.length} khoá, không cần xem ${s.pruned.length} node`,
          sayTone: 'good',
          holdMs: 1600,
        };
      default:
        return { ...base, say: `WHERE key BETWEEN ${lo} AND ${hi}`, holdMs: 1300 };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'prune');
  const e = frames[k].event as Extract<BstEvent, { kind: 'prune' }>;
  return withAsk(frames, k, {
    prompt: `${e.key} nhỏ hơn ${lo}. Có cần xem cây con trái của ${e.key} (${e.skipped.join(', ')}) không?`,
    choices: [
      `Không: mọi số bên đó đều nhỏ hơn ${e.key}`,
      'Có: phải xem hết mới chắc',
      `Có, vì con của ${e.skipped[0]} có thể lớn hơn ${lo}`,
    ],
    correct: 0,
    explain: `Cả nhánh nằm bên trái ${e.key}, nên mọi số trong đó nhỏ hơn ${e.key}, tức cũng nhỏ hơn ${lo}, kể cả con cháu của ${e.skipped[0]}. Bỏ cả nhánh mà không cần nhìn: đó là lý do truy vấn khoảng trên index rất nhanh.`,
  });
})();

// ---------- Bước 5: chèn khoá đã sort ----------

const SORTED_RAW = traceInsert([], SORTED_KEYS);

export const SORTED = (() => {
  const total = (k: number) => comparesSoFar(SORTED_RAW, k);
  const frames = narrateInsert(SORTED_RAW, (f, k) => [
    { label: 'Số node', value: String(f.state.nodes.length) },
    {
      label: 'Chiều cao cây',
      value: String(Math.max(0, ...f.state.nodes.map((n) => n.depth + 1))),
      tone: 'bad',
    },
    { label: 'Tổng lần so', value: String(total(k)) },
    { label: 'Cây cân bằng cần', value: `${balancedHeight(f.state.nodes.length)} tầng` },
  ]);
  setSay(frames, 0, `chèn ${SORTED_KEYS.join(', ')} theo đúng thứ tự đó`);
  setSay(
    frames,
    frames.length - 1,
    `cây ${SORTED_KEYS.length} node cao ${SORTED_KEYS.length} tầng: thành một chuỗi`,
    {
      sayTone: 'bad',
    },
  );
  // Câu đoán ở lần so đầu tiên khi chèn khoá cuối cùng.
  const last = SORTED_KEYS.at(-1)!;
  const k = frames.findIndex((f) => f.event.kind === 'compare' && f.event.target === last);
  const compares = SORTED_RAW.filter(
    (f) => f.event.kind === 'compare' && f.event.target === last,
  ).length;
  return withAsk(frames, k, {
    prompt: `Chèn ${last} vào cây ${SORTED_KEYS.slice(0, -1).join(' → ')}. Cần so bao nhiêu lần?`,
    choices: [String(compares), '1', String(balancedHeight(SORTED_KEYS.length))],
    correct: 0,
    explain: `Khoá mới lớn hơn mọi khoá cũ nên lần nào cũng sang phải, đi hết cả chuỗi: ${compares} lần. Cây ${SORTED_KEYS.length} node mà cao ${SORTED_KEYS.length} tầng thì tìm hay chèn đều O(n), không hơn gì một list.`,
  });
})();

// ---------- Bước 6: tóm tắt ----------

type RowEvent = { kind: 'row'; index: number };

export const HEIGHT_ROWS = SIZES.map((n) => ({
  n,
  balanced: balancedHeight(n),
  random: heightOf(build(shuffled(n, SEED))),
  sorted: n,
}));

export const RECAP = Array.from(
  { length: HEIGHT_ROWS.length + 1 },
  (_, i): Frame<CodeTraceState, RowEvent> => ({
    state: {
      rows: HEIGHT_ROWS.slice(0, i).map((r) => [
        String(r.n),
        String(r.balanced),
        String(r.random),
        String(r.sorted),
      ]),
    },
    event: { kind: 'row', index: i },
    codeLines: i === 0 ? [] : [5, 6, 7, 8],
    holdMs: i === 0 ? 900 : 1500,
    metrics: [
      { label: 'Tìm, chèn', value: 'O(chiều cao)' },
      { label: 'Cây cân bằng', value: 'O(log n)', tone: 'good' },
      { label: 'Cây thành chuỗi', value: 'O(n)', tone: 'bad' },
      { label: 'Duyệt in-order', value: 'O(n)' },
    ],
  }),
);

// ---------- Scene ----------

const SearchScene = bstScene({
  title: 'BINARY SEARCH TREE',
  code: { file: 'bst.py', lines: CODE_SEARCH },
  universe: KEYS,
  levels: HEIGHT,
});
const InsertScene = bstScene({
  title: 'BINARY SEARCH TREE',
  code: { file: 'bst.py', lines: CODE_INSERT },
  universe: [...KEYS, ADDED],
  levels: heightOf(build([...KEYS, ADDED])),
});
const InorderScene = bstScene({
  title: 'DUYỆT IN-ORDER',
  code: { file: 'inorder.py', lines: CODE_INORDER },
  universe: KEYS,
  levels: HEIGHT,
  outTitle: 'ĐÃ IN RA',
});
const RangeScene = bstScene({
  title: 'TRUY VẤN KHOẢNG',
  code: { file: 'range_query.py', lines: CODE_RANGE },
  universe: KEYS,
  levels: HEIGHT,
  outTitle: 'KẾT QUẢ',
});
const SortedScene = bstScene({
  title: 'CHÈN KHOÁ ĐÃ SORT',
  code: { file: 'bst.py', lines: CODE_INSERT },
  universe: SORTED_KEYS,
  levels: SORTED_KEYS.length,
});
const RecapScene = codeTraceScene({
  file: 'bst.py',
  code: CODE_SEARCH,
  columns: ['n', 'cân bằng', 'chèn ngẫu nhiên', 'chèn đã sort'],
  title: 'CHIỀU CAO CÂY = SỐ LẦN SO NHIỀU NHẤT',
});

// ---------- Các bước ----------

const steps = [
  defineStep<BstState, BstEvent>({
    id: 'tim',
    short: 'Tìm',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Trái nhỏ hơn, phải lớn hơn',
    Scene: SearchScene,
    build: () => SEARCH,
    Body: () => (
      <>
        <p>
          Binary search tree (BST) là cây mà mỗi node có tối đa hai con, theo một quy tắc: mọi khoá
          bên <b>trái</b> nhỏ hơn node, mọi khoá bên <b>phải</b> lớn hơn node. Quy tắc đúng ở mọi
          node, không chỉ ở gốc.
        </p>
        <p>
          Tìm {TARGET}: bắt đầu từ gốc, nhỏ hơn thì sang trái, lớn hơn thì sang phải. Mỗi lần so bỏ
          hẳn một nhánh, giống binary search, nên số lần so bằng số tầng đi qua. Không có khoá thì
          sẽ rơi ra một chỗ trống: trả về <code>None</code>.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Binary search cần một mảng đã sort, chèn thêm thì phải dời phần tử. BST giữ thứ tự bằng hình dạng cây, nên chèn thêm khoá không phải dời ai.',
    },
  }),

  defineStep<BstState, BstEvent>({
    id: 'chen',
    short: 'Chèn',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'Chèn: tìm, rồi gắn vào chỗ trống',
    Scene: InsertScene,
    build: () => INSERT,
    Body: ({ frames }) => {
      const compares = comparesOf(frames);
      return (
        <>
          <p>
            Chèn {ADDED}: đi xuống y như khi tìm {ADDED}. Vì {ADDED} chưa có trong cây, đường đi sẽ
            rơi ra một chỗ trống; gắn {ADDED} vào đúng chỗ đó.
          </p>
          <p>
            {compares} lần so, không node nào phải dời. Chèn tốn đúng bằng tìm: tỉ lệ với chiều cao
            cây. Thứ tự chèn quyết định hình dạng cây, và bước 5 sẽ cho thấy vì sao điều đó quan
            trọng.
          </p>
        </>
      );
    },
  }),

  defineStep<BstState, BstEvent>({
    id: 'in-order',
    short: 'Duyệt',
    tag: 'THAO TÁC',
    tone: 'lav',
    title: 'Duyệt in-order: ra đúng thứ tự tăng dần',
    Scene: InorderScene,
    build: () => INORDER,
    Body: ({ frames }) => (
      <>
        <p>
          In-order nghĩa là ở mỗi node: in hết cây con trái, rồi in node, rồi in cây con phải. Vì
          bên trái luôn nhỏ hơn và bên phải luôn lớn hơn, kết quả là mọi khoá theo thứ tự tăng dần:{' '}
          {frames.at(-1)!.state.out.join(', ')}.
        </p>
        <p>
          Mỗi node được in đúng một lần: <b>O(n)</b>, không cần sort lại.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Index B-tree của Postgres (bài sau) cũng giữ khoá theo thứ tự như vậy. Vì thế{' '}
          <code>SELECT * FROM orders ORDER BY order_id</code> có thể đọc lần lượt theo index mà
          không cần sort lại cả bảng.
        </>
      ),
    },
  }),

  defineStep<BstState, BstEvent>({
    id: 'khoang',
    short: 'Khoảng',
    tag: 'ỨNG DỤNG',
    tone: 'sun',
    title: `Truy vấn khoảng: lấy mọi khoá từ ${RANGE[0]} tới ${RANGE[1]}`,
    Scene: RangeScene,
    build: () => RANGED,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Duyệt in-order nhưng bỏ qua nhánh nào chắc chắn nằm ngoài khoảng. Node nhỏ hơn{' '}
            {RANGE[0]} thì cả cây con trái của nó cũng nhỏ hơn: bỏ. Node lớn hơn {RANGE[1]} thì cả
            cây con phải: bỏ.
          </p>
          <p>
            Kết quả: {s.out.join(', ')}, đã sort sẵn. {s.pruned.length} node không cần nhìn tới. Cây
            càng lớn thì phần bỏ qua càng nhiều.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>
            WHERE amount BETWEEN {RANGE[0]} AND {RANGE[1]}
          </code>{' '}
          trên cột có index: database đi xuống tới {RANGE[0]}, rồi đọc lần lượt theo thứ tự tới{' '}
          {RANGE[1]}. Các nhánh ngoài khoảng không bị đọc, nên nhanh hơn full scan rất nhiều khi
          khoảng hẹp.
        </>
      ),
    },
  }),

  defineStep<BstState, BstEvent>({
    id: 'khoa-da-sort',
    short: 'Khoá đã sort',
    tag: 'BẪY',
    tone: 'rose',
    title: 'Chèn khoá đã sort: cây thành một chuỗi',
    Scene: SortedScene,
    build: () => SORTED,
    Body: ({ frames }) => {
      const compares = comparesOf(frames);
      return (
        <>
          <p>
            Chèn {SORTED_KEYS.join(', ')} theo đúng thứ tự tăng dần. Khoá mới luôn lớn hơn mọi khoá
            cũ nên luôn gắn vào bên phải node cuối. Cây {SORTED_KEYS.length} node cao{' '}
            {SORTED_KEYS.length} tầng, tốn tổng cộng {compares} lần so chỉ để chèn.
          </p>
          <p>
            Cây như vậy không hơn gì một list: tìm hay chèn đều <b>O(n)</b>. Chèn theo thứ tự giảm
            dần cũng vậy, chỉ là lệch sang trái.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'TRONG DATA ENGINEERING',
      text: 'ID tự tăng và cột thời gian luôn đến theo thứ tự tăng, đúng trường hợp tệ nhất này. Vì vậy database không dùng BST thường mà dùng cây tự cân bằng, như B-tree ở bài sau: chiều cao luôn khoảng log n dù khoá đến theo thứ tự nào.',
    },
  }),

  defineStep<CodeTraceState, RowEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'peach',
    title: 'Mọi thứ phụ thuộc vào chiều cao',
    Scene: RecapScene,
    build: () => RECAP,
    Body: () => {
      const big = HEIGHT_ROWS.at(-1)!;
      return (
        <>
          <p>
            Tìm và chèn đều đi một đường từ gốc xuống, nên tốn bằng <b>chiều cao cây</b>. Bảng bên
            phải đo chiều cao thật: với {big.n} khoá, cây cân bằng cao {big.balanced} tầng, chèn
            theo thứ tự ngẫu nhiên cao {big.random} tầng, còn chèn đã sort thì cao tới {big.sorted}.
          </p>
          <p>
            Ba điều cần nhớ: trái nhỏ hơn, phải lớn hơn; duyệt in-order ra dãy đã sort nên truy vấn
            khoảng rất rẻ; và thứ tự chèn quyết định chiều cao, nên hệ thống thật dùng cây tự cân
            bằng.
          </p>
        </>
      );
    },
  }),
];

export const bstLesson: Lesson = {
  slug: 'binary-search-tree',
  steps,
  legend: [
    { swatch: 'sun', label: 'đang so sánh' },
    { swatch: 'sky', label: 'đường đi từ gốc' },
    { swatch: 'mint', label: 'tìm thấy, đã in ra' },
    { swatch: 'lav', label: 'node' },
    { dashed: true, label: 'chỗ trống, nhánh bỏ qua' },
  ],
  objectives: [
    { text: 'Tìm một khoá bằng cách đi xuống từ gốc', step: 0 },
    { text: 'Chèn khoá mới vào chỗ trống', step: 1 },
    { text: 'Duyệt in-order ra dãy đã sort', step: 2 },
    { text: 'Truy vấn khoảng, bỏ qua cả nhánh', step: 3 },
    { text: 'Hiểu vì sao khoá đã sort làm cây lệch', step: 4 },
  ],
  quiz: QUIZ,
};
