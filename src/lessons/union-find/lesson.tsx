import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import {
  groupsOf,
  heightOf,
  matchPairs,
  singletons,
  traceFind,
  traceUnions,
  type Record_,
  type UFEvent,
  type UFState,
} from './algorithm';
import { forestLayout } from './layout';
import { QUIZ } from './quiz';
import { forestScene } from './scenes';

// ---------- Dữ liệu ----------

export const FOREST = [0, 0, 1, 1, 3, 5, 5, 6]; // parent của 8 phần tử, hai cây
export const FIND_X = 4;
export const UNION_N = 6;
export const UNION_PAIRS: [number, number][] = [
  [0, 1],
  [2, 3],
  [1, 3],
  [4, 5],
  [0, 2],
];
export const CHAIN_N = 7;
export const CHAIN_PAIRS = singletons(CHAIN_N - 1).map((i): [number, number] => [i, i + 1]);
export const RECORDS: Record_[] = [
  { id: 'r0', email: 'an@shop.vn', phone: '0901' },
  { id: 'r1', email: 'an.ng@shop.vn', phone: '0901' },
  { id: 'r2', email: 'binh@shop.vn', phone: '0912' },
  { id: 'r3', email: 'an.ng@shop.vn', phone: '0987' },
  { id: 'r4', email: 'binh@shop.vn', phone: '0933' },
  { id: 'r5', email: 'chi@shop.vn', phone: '0944' },
  { id: 'r6', email: 'dung@shop.vn', phone: '0933' },
  { id: 'r7', email: 'chi.le@shop.vn', phone: '0944' },
];
export const MATCHES = matchPairs(RECORDS);

// ---------- Code hiển thị trên trang ----------

export const CODE_NAIVE = [
  'parent = list(range(n))        # mỗi phần tử là gốc của chính nó',
  '',
  'def find(x):',
  '    while parent[x] != x:',
  '        x = parent[x]          # đi lên một bước',
  '    return x',
  '',
  'def union(a, b):',
  '    ra, rb = find(a), find(b)',
  '    if ra != rb:',
  '        parent[ra] = rb        # gắn gốc của a vào gốc của b',
];

export const CODE_FULL = [
  'parent = list(range(n))',
  'size = [1] * n',
  '',
  'def find(x):',
  '    root = x',
  '    while parent[root] != root:',
  '        root = parent[root]',
  '    while parent[x] != root:       # nén đường',
  '        parent[x], x = root, parent[x]',
  '    return root',
  '',
  'def union(a, b):',
  '    ra, rb = find(a), find(b)',
  '    if ra == rb:',
  '        return                     # đã cùng nhóm',
  '    if size[ra] > size[rb]:',
  '        ra, rb = rb, ra            # cây nhỏ gắn vào cây lớn',
  '    parent[ra] = rb',
  '    size[rb] += size[ra]',
];

// ---------- Tiện ích ----------

type F = Frame<UFState, UFEvent>;

const withAsk = (frames: F[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

const countGroups = (s: UFState) => s.parent.filter((p, i) => p === i).length;
const unionsSoFar = (frames: F[], k: number) =>
  frames.slice(0, k + 1).filter((f) => f.event.kind === 'link' || f.event.kind === 'same').length;

function naiveLines(e: UFEvent): number[] {
  switch (e.kind) {
    case 'step':
      return [4, 5];
    case 'root':
      return [6];
    case 'same':
      return [9, 10];
    case 'link':
      return [9, 10, 11];
    default:
      return [];
  }
}

function fullLines(e: UFEvent, swapped: boolean): number[] {
  switch (e.kind) {
    case 'step':
      return [6, 7];
    case 'root':
      return [6];
    case 'compress':
      return [8, 9];
    case 'same':
      return [13, 14, 15];
    case 'link':
      return swapped ? [16, 17, 18, 19] : [16, 18, 19];
    default:
      return [];
  }
}

// Lời dẫn chung. why: lý do của lần union thứ i (bước gộp bản ghi).
function narrate(raw: F[], full: boolean, why?: (i: number) => string): F[] {
  return raw.map((f, k) => {
    const e = f.event;
    const s = f.state;
    const lab = (i: number) => s.labels[i];
    const before = raw[k - 1]?.state;
    const swapped = e.kind === 'link' && before !== undefined && before.roots[1] === e.child;
    const base = {
      ...f,
      codeLines: full ? fullLines(e, swapped) : naiveLines(e),
      metrics: [
        { label: 'Số nhóm', value: String(countGroups(s)) },
        { label: 'Chiều cao', value: `${heightOf(s.parent)} tầng` },
        { label: 'Bước của find', value: String(Math.max(0, s.path.length - 1)) },
        { label: 'Lần union', value: String(unionsSoFar(raw, k)) },
      ] as Metric[],
    };
    // Chỉ gọi ở frame union: lúc đó đã có ít nhất một lần union để lấy lý do.
    const reason = () => (why ? `${why(unionsSoFar(raw, k) - 1)}: ` : '');
    switch (e.kind) {
      case 'step':
        return { ...base, say: `${lab(e.x)} → ${lab(e.to)}`, holdMs: 800 };
      case 'root':
        return {
          ...base,
          say: `gốc của ${lab(e.x)} là ${lab(e.root)} (${e.steps} bước)`,
          holdMs: 1000,
        };
      case 'compress':
        return {
          ...base,
          say: `nén: parent[${lab(e.x)}] = ${lab(e.root)}`,
          sayTone: 'good',
          holdMs: 900,
        };
      case 'same':
        return {
          ...base,
          say: `${reason()}${lab(e.a)} và ${lab(e.b)} đã cùng gốc ${lab(e.root)}, không làm gì`,
          holdMs: 1400,
        };
      case 'link': {
        const sizes = before
          ? ` (${before.size[e.child]} phần tử vào ${before.size[e.parent]})`
          : '';
        return {
          ...base,
          say: `${reason()}gắn gốc ${lab(e.child)} vào dưới gốc ${lab(e.parent)}${full ? sizes : ''}`,
          sayTone: 'good',
          holdMs: 1400,
        };
      }
      default:
        return { ...base, holdMs: 1300 };
    }
  });
}

const widthOf = (frames: F[]) =>
  Math.max(...frames.map((f) => forestLayout(f.state.parent).width)) + 8;
const levelsOf = (frames: F[]) =>
  Math.max(...frames.map((f) => forestLayout(f.state.parent).levels));

// ---------- Bước 1: find ----------

const FIND_RAW = traceFind(FOREST, FIND_X, false);

export const FIND = (() => {
  const frames = narrate(FIND_RAW, false);
  setSay(
    frames,
    0,
    `${FOREST.length} phần tử, ${countGroups(FIND_RAW[0].state)} nhóm. find(${FIND_X})?`,
  );
  const k = frames.findIndex((f) => f.event.kind === 'step');
  const root = FIND_RAW.find((f) => f.event.kind === 'root')!.event as Extract<
    UFEvent,
    { kind: 'root' }
  >;
  return withAsk(frames, k, {
    prompt: `find(${FIND_X}): đi theo parent tới khi gặp phần tử trỏ vào chính nó. Gốc là ai, và đi mấy bước?`,
    choices: [
      `Gốc ${root.root}, ${root.steps} bước`,
      `Gốc ${FOREST[FIND_X]}, 1 bước`,
      `Gốc ${FIND_X}, 0 bước`,
    ],
    correct: 0,
    explain: `parent[${FIND_X}] = ${FOREST[FIND_X]} nên ${FIND_X} chưa phải gốc. Đi tiếp tới khi parent[x] = x: ${root.root} là gốc, sau ${root.steps} bước. Gốc đại diện cho cả nhóm: hai phần tử cùng nhóm khi và chỉ khi cùng gốc.`,
  });
})();

// ---------- Bước 2: union ----------

const UNION_RAW = traceUnions(singletons(UNION_N), UNION_PAIRS, { bySize: false, compress: false });

export const UNION = (() => {
  const frames = narrate(UNION_RAW, false);
  setSay(frames, 0, `${UNION_N} phần tử, mỗi phần tử một nhóm`);
  setSay(frames, frames.length - 1, `còn ${countGroups(UNION_RAW.at(-1)!.state)} nhóm`, {
    sayTone: 'good',
  });
  const k = frames.findIndex((f) => f.event.kind === 'same');
  const e = frames[k].event as Extract<UFEvent, { kind: 'same' }>;
  return withAsk(frames, k, {
    prompt: `find(${e.a}) = ${e.root} và find(${e.b}) = ${e.root}. union(${e.a}, ${e.b}) làm gì?`,
    choices: [
      `Không làm gì: ${e.a} và ${e.b} đã cùng nhóm`,
      `Gắn ${e.a} vào dưới ${e.b}`,
      'Tạo một gốc mới cho cả hai',
    ],
    correct: 0,
    explain: `Cùng gốc nghĩa là đã cùng nhóm. Gắn thêm sẽ tạo vòng trong mảng parent và find chạy mãi, nên union kiểm tra ra == rb trước.`,
  });
})();

// ---------- Bước 3: chuỗi dài ----------

const CHAIN_RAW = traceUnions(
  singletons(CHAIN_N),
  CHAIN_PAIRS,
  { bySize: false, compress: false },
  undefined,
  [0],
);
export const CHAIN_PARENT = CHAIN_RAW.at(-1)!.state.parent;

export const CHAIN = (() => {
  const frames = narrate(CHAIN_RAW, false);
  setSay(frames, 0, `union(0, 1), union(1, 2), …, union(${CHAIN_N - 2}, ${CHAIN_N - 1})`);
  setSay(frames, frames.length - 1, `cây cao ${heightOf(CHAIN_PARENT)} tầng: thành một chuỗi`, {
    sayTone: 'bad',
  });
  const k = frames.findIndex((f) => f.event.kind === 'step');
  const steps = (
    CHAIN_RAW.find((f) => f.event.kind === 'root' && f.event.x === 0 && f.event.steps > 0)!
      .event as Extract<UFEvent, { kind: 'root' }>
  ).steps;
  return withAsk(frames, k, {
    prompt: `Sau ${CHAIN_PAIRS.length} lần union kiểu này, find(0) phải đi lên mấy bước?`,
    choices: [String(steps), '1', String(Math.ceil(Math.log2(CHAIN_N)))],
    correct: 0,
    explain: `Lần nào cũng gắn gốc cũ vào dưới phần tử mới, nên cây dài thêm một tầng mỗi lần: 0 → 1 → … → ${CHAIN_N - 1}, ${steps} bước. Với n phần tử, find có thể tốn tới n bước.`,
  });
})();

// ---------- Bước 4: gắn cây nhỏ vào cây lớn ----------

const SIZE_RAW = traceUnions(
  singletons(CHAIN_N),
  CHAIN_PAIRS,
  { bySize: true, compress: false },
  undefined,
  [0],
);

export const BY_SIZE = (() => {
  const frames = narrate(SIZE_RAW, true);
  setSay(frames, 0, 'cùng các lần union đó, nhưng gắn cây nhỏ vào cây lớn');
  setSay(frames, frames.length - 1, `cây chỉ cao ${heightOf(SIZE_RAW.at(-1)!.state.parent)} tầng`, {
    sayTone: 'good',
  });
  // Câu đoán ở lần đầu cây nhỏ hơn là cây của b: cách ngây thơ sẽ gắn ngược.
  const k = frames.findIndex(
    (f, i) => f.event.kind === 'link' && i > 0 && frames[i - 1].state.roots[1] === f.event.child,
  );
  const e = frames[k].event as Extract<UFEvent, { kind: 'link' }>;
  const before = frames[k - 1].state;
  return withAsk(frames, k, {
    prompt: `Cây của ${e.parent} có ${before.size[e.parent]} phần tử, cây của ${e.child} chỉ có ${before.size[e.child]}. Gắn gốc nào vào dưới gốc nào?`,
    choices: [
      `Gắn ${e.child} vào dưới ${e.parent}: cây nhỏ vào cây lớn`,
      `Gắn ${e.parent} vào dưới ${e.child}, như cách ngây thơ`,
      'Tạo một gốc mới cho cả hai',
    ],
    correct: 0,
    explain: `Gắn cây lớn vào dưới cây nhỏ thì ${before.size[e.parent]} phần tử cùng sâu thêm một tầng. Gắn ngược lại chỉ ${before.size[e.child]} phần tử sâu thêm. Nhờ vậy cây không bao giờ cao quá log₂ n tầng.`,
  });
})();

// ---------- Bước 5: nén đường ----------

const COMPRESS_RAW = traceUnions(
  CHAIN_PARENT,
  [],
  { bySize: false, compress: true },
  undefined,
  [0, 0],
);

export const COMPRESS = (() => {
  const frames = narrate(COMPRESS_RAW, true);
  setSay(frames, 0, `quay lại chuỗi ${CHAIN_N} tầng ở bước 3, gọi find(0) hai lần`);
  setSay(frames, frames.length - 1, `lần find(0) thứ hai chỉ còn 1 bước`, { sayTone: 'good' });
  const k = frames.findIndex((f) => f.event.kind === 'compress');
  const e = frames[k].event as Extract<UFEvent, { kind: 'compress' }>;
  return withAsk(frames, k, {
    prompt: `find(0) đã tìm ra gốc ${e.root}. Nén đường thì parent[0] đổi thành gì?`,
    choices: [String(e.root), String(e.was), '0'],
    correct: 0,
    explain: `Mọi phần tử trên đường vừa đi được trỏ thẳng tới gốc ${e.root}. Lần find sau từ bất kỳ phần tử nào trong số đó chỉ cần 1 bước.`,
  });
})();

// ---------- Bước 6: gộp bản ghi ----------

const ENTITY_RAW = traceUnions(
  singletons(RECORDS.length),
  MATCHES.map((m): [number, number] => [m.a, m.b]),
  { bySize: true, compress: true },
  RECORDS.map((r) => r.id),
);

export const ENTITY = (() => {
  const frames = narrate(ENTITY_RAW, true, (i) => MATCHES[i].why);
  const groups = groupsOf(ENTITY_RAW.at(-1)!.state.parent);
  setSay(frames, 0, `${RECORDS.length} bản ghi; cặp nào chung email hoặc số điện thoại thì union`);
  setSay(frames, frames.length - 1, `${groups.length} khách hàng thật`, { sayTone: 'good' });
  const emails = new Set(RECORDS.map((r) => r.email)).size;
  const label = (g: number[]) => g.map((i) => RECORDS[i].id).join(', ');
  return withAsk(frames, frames.length - 1, {
    prompt: `Xử lý xong mọi cặp chung email hoặc số điện thoại. ${RECORDS.length} bản ghi này là của bao nhiêu khách hàng?`,
    choices: [String(groups.length), String(RECORDS.length), String(emails)],
    correct: 0,
    explain: `Các nhóm: ${groups.map((g) => `{${label(g)}}`).join(', ')}. Đếm email khác nhau thì ra ${emails}, nhưng một người có thể dùng nhiều email; nối bằng chuỗi bằng chứng mới ra ${groups.length}.`,
  });
})();

// ---------- Scene ----------

const scene = (
  title: string,
  code: readonly string[],
  file: string,
  frames: F[],
  records?: Record_[],
) =>
  forestScene({
    title,
    code: { file, lines: code },
    width: widthOf(frames),
    levels: levelsOf(frames),
    records,
  });

const FindScene = scene('RỪNG CÂY', CODE_NAIVE, 'union_find.py', FIND);
const UnionScene = scene('UNION: NỐI HAI GỐC', CODE_NAIVE, 'union_find.py', UNION);
const ChainScene = scene('GẮN NGÂY THƠ', CODE_NAIVE, 'union_find.py', CHAIN);
const SizeScene = scene('CÂY NHỎ VÀO CÂY LỚN', CODE_FULL, 'union_find.py', BY_SIZE);
const CompressScene = scene('NÉN ĐƯỜNG', CODE_FULL, 'union_find.py', COMPRESS);
const EntityScene = scene('GỘP KHÁCH HÀNG', CODE_FULL, 'union_find.py', ENTITY, RECORDS);

// ---------- Các bước ----------

const steps = [
  defineStep<UFState, UFEvent>({
    id: 'find',
    short: 'find',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Mỗi nhóm là một cây, gốc là đại diện',
    Scene: FindScene,
    build: () => FIND,
    Body: () => (
      <>
        <p>
          Union-Find giữ các phần tử thành từng nhóm bằng đúng một mảng <code>parent</code>: mỗi
          phần tử trỏ lên một phần tử khác trong cùng nhóm. Phần tử trỏ vào chính nó là <b>gốc</b>,
          đại diện cho cả nhóm.
        </p>
        <p>
          <code>find(x)</code> đi theo parent lên tới gốc. Hai phần tử cùng nhóm khi và chỉ khi cùng
          gốc. Mũi tên trong hình là parent; mảng bên dưới là thứ thật sự được lưu.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Union-Find không cần biết các phần tử nối nhau thế nào, chỉ cần biết chúng thuộc nhóm nào. Câu hỏi "a và b có cùng nhóm không?" là so hai gốc.',
    },
  }),

  defineStep<UFState, UFEvent>({
    id: 'union',
    short: 'union',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'union: nối gốc của nhóm này vào gốc của nhóm kia',
    Scene: UnionScene,
    build: () => UNION,
    Body: ({ frames }) => (
      <>
        <p>
          <code>union(a, b)</code> tìm gốc của a và gốc của b. Khác nhau thì gắn một gốc vào dưới
          gốc kia: hai cây thành một, số nhóm giảm 1. Cùng gốc thì không làm gì.
        </p>
        <p>
          Sau {UNION_PAIRS.length} lần union, {UNION_N} phần tử còn{' '}
          {countGroups(frames.at(-1)!.state)} nhóm. Không cần duyệt lại các cặp đã gộp: mọi thứ nằm
          trong mảng parent.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Gộp nhóm theo các cặp nối nhau chính là tìm thành phần liên thông (connected components) của một đồ thị. Với đồ thị quá lớn cho một máy, thư viện GraphFrames của Spark có sẵn connectedComponents().',
    },
  }),

  defineStep<UFState, UFEvent>({
    id: 'chuoi',
    short: 'Bẫy chuỗi',
    tag: 'BẪY',
    tone: 'rose',
    title: 'Gắn ngây thơ: cây thành một chuỗi',
    Scene: ChainScene,
    build: () => CHAIN,
    Body: () => (
      <>
        <p>
          Gọi union(0, 1), union(1, 2), … theo thứ tự. Cách ngây thơ luôn gắn gốc của a vào dưới gốc
          của b, nên lần nào cây cũng dài thêm một tầng.
        </p>
        <p>
          Kết quả: một chuỗi {heightOf(CHAIN_PARENT)} tầng, và find(0) đi qua mọi phần tử. Với n
          phần tử, find tốn <b>O(n)</b>: không hơn gì dò cả list.
        </p>
      </>
    ),
  }),

  defineStep<UFState, UFEvent>({
    id: 'theo-kich-thuoc',
    short: 'Cây nhỏ vào cây lớn',
    tag: 'CẢI TIẾN',
    tone: 'lav',
    title: 'Gắn cây nhỏ vào dưới cây lớn',
    Scene: SizeScene,
    build: () => BY_SIZE,
    Body: ({ frames }) => (
      <>
        <p>
          Lưu thêm <code>size</code> của mỗi cây. Khi union, gắn gốc của cây <b>nhỏ hơn</b> vào dưới
          gốc của cây lớn hơn. Cùng các lần union như bước trước, cây giờ chỉ cao{' '}
          {heightOf(frames.at(-1)!.state.parent)} tầng.
        </p>
        <p>
          Một phần tử chỉ sâu thêm khi nhóm của nó ít nhất gấp đôi, nên cây không bao giờ cao quá
          log₂ n tầng: find còn <b>O(log n)</b>.
        </p>
      </>
    ),
  }),

  defineStep<UFState, UFEvent>({
    id: 'nen-duong',
    short: 'Nén đường',
    tag: 'CẢI TIẾN',
    tone: 'sun',
    title: 'Nén đường: find xong thì trỏ thẳng tới gốc',
    Scene: CompressScene,
    build: () => COMPRESS,
    Body: () => (
      <>
        <p>
          find đã đi hết đường lên gốc, nên tiện tay sửa parent của mọi phần tử trên đường đó trỏ
          thẳng vào gốc. Lần find đầu vẫn chậm, nhưng các lần sau chỉ còn 1 bước.
        </p>
        <p>
          Dùng cả hai mẹo thì mỗi thao tác trung bình tốn <b>O(α(n))</b>. α là hàm tăng cực chậm:
          không quá 4 với mọi kích thước dữ liệu thực tế, nên coi như hằng số.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Hai dòng code thêm vào (size và vòng nén đường) biến find từ O(n) thành gần như O(1).',
    },
  }),

  defineStep<UFState, UFEvent>({
    id: 'gop-khach-hang',
    short: 'Gộp bản ghi',
    tag: 'ỨNG DỤNG',
    tone: 'peach',
    title: 'Gộp các bản ghi của cùng một khách hàng',
    Scene: EntityScene,
    build: () => ENTITY,
    Body: () => (
      <>
        <p>
          {RECORDS.length} bản ghi đến từ app, web và CRM. Duyệt từng bản ghi: email hay số điện
          thoại nào đã gặp thì union với bản ghi đầu tiên có giá trị đó. Một dict lưu &quot;giá trị
          → bản ghi đầu tiên&quot;, Union-Find lo phần gộp.
        </p>
        <p>
          r0 và r3 không có gì chung, nhưng r0 chung số điện thoại với r1, r1 chung email với r3:
          gộp có tính bắc cầu nên cả ba là một khách hàng.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Bài toán này gọi là entity resolution, hay identity stitching: gộp người dùng từ nhiều hệ thống thành một khách hàng để đếm đúng số khách, tính đúng doanh thu mỗi người. Dữ liệu vừa một máy thì Union-Find trong Python là đủ; dữ liệu rất lớn thì chạy connected components trên Spark.',
    },
  }),
];

export const unionFindLesson: Lesson = {
  slug: 'union-find',
  steps,
  legend: [
    { swatch: 'mint', label: 'gốc của nhóm' },
    { swatch: 'sun', label: 'đang đứng' },
    { swatch: 'sky', label: 'đường đi của find' },
    { swatch: 'peach', label: 'vừa đổi parent' },
    { dashed: true, label: 'cặp đang union' },
  ],
  objectives: [
    { text: 'Hiểu mảng parent và find', step: 0 },
    { text: 'Gộp hai nhóm bằng union', step: 1 },
    { text: 'Thấy vì sao gắn ngây thơ làm cây dài', step: 2 },
    { text: 'Gắn cây nhỏ vào cây lớn', step: 3 },
    { text: 'Nén đường khi find', step: 4 },
    { text: 'Gộp bản ghi của cùng một khách hàng', step: 5 },
  ],
  quiz: QUIZ,
};
