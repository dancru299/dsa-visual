import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import {
  build,
  heightOf,
  MAX_KEYS,
  minHeight,
  traceInsert,
  traceSearch,
  type BEvent,
  type BState,
} from './algorithm';
import { layout, PAD } from './layout';
import { QUIZ } from './quiz';
import { btreeScene } from './scenes';

// ---------- Dữ liệu ----------

export const BASE = [40, 10, 60, 20, 30, 70, 80, 45, 50]; // thứ tự chèn để dựng cây ban đầu
export const TARGET = 50;
export const ADDED = 55;
export const CASCADE = [85, 90, 95];
export const SORTED_KEYS = Array.from({ length: 13 }, (_, i) => (i + 1) * 10);
export const FANOUT = 300;
export const SIZES = [
  { n: 1_000, label: '1.000' },
  { n: 1_000_000, label: '1 triệu' },
  { n: 1_000_000_000, label: '1 tỷ' },
];

// ---------- Code hiển thị trên trang ----------

export const CODE_SEARCH = [
  'def search(node, key):',
  '    while True:',
  '        i = 0',
  '        while i < len(node.keys) and key > node.keys[i]:',
  '            i += 1                    # vị trí của key trong node',
  '        if i < len(node.keys) and node.keys[i] == key:',
  '            return node',
  '        if node.is_leaf:',
  '            return None',
  '        node = node.children[i]       # xuống con thứ i',
];

export const CODE_INSERT = [
  `MAX_KEYS = ${MAX_KEYS}`,
  '',
  'def insert(tree, key):',
  '    leaf = find_leaf(tree.root, key)       # đi xuống như khi tìm',
  '    bisect.insort(leaf.keys, key)          # thêm, giữ thứ tự trong node',
  '    node = leaf',
  '    while len(node.keys) > MAX_KEYS:       # tràn thì tách',
  '        mid = len(node.keys) // 2',
  '        up = node.keys[mid]',
  '        left, right = split(node, mid)     # nửa trái, nửa phải',
  '        if node is tree.root:',
  '            tree.root = Node([up], [left, right])  # gốc mới',
  '            return',
  '        node = node.parent',
  '        node.add(up, left, right)          # khoá giữa đi lên cha',
];

// ---------- Tiện ích ----------

type F = Frame<BState, BEvent>;

const withAsk = (frames: F[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

const list = (keys: readonly number[]) => `[${keys.join(', ')}]`;
const levelsOf = (s: BState) => layout(s.root, s.nodes).levels;
const keyCount = (s: BState) => s.nodes.reduce((n, x) => n + x.keys.length, 0);
const splitsUpTo = (frames: F[], k: number) =>
  frames.slice(0, k + 1).filter((f) => f.event.kind === 'split').length;

// Lời dẫn khi xét một node trên đường đi xuống.
function scanSay(e: Extract<BEvent, { kind: 'scan' }>, leaf: boolean, inserting: boolean): string {
  const { keys, target, slot } = e;
  if (e.found) return `trong ${list(keys)}: có ${target}`;
  if (leaf) return inserting ? `${list(keys)} là lá: ${target} vào đây` : `${list(keys)} là lá`;
  if (slot === 0) return `${target} < ${keys[0]}: xuống con đầu tiên`;
  if (slot === keys.length) return `${target} > ${keys.at(-1)}: xuống con cuối cùng`;
  return `${keys[slot - 1]} < ${target} < ${keys[slot]}: xuống con thứ ${slot + 1}`;
}

const isLeafIn = (s: BState, id: number) => s.nodes.find((n) => n.id === id)!.children.length === 0;

// Bề ngang viewBox đủ cho mọi frame của một bước.
const widthOf = (frames: F[]) =>
  Math.max(...frames.map((f) => layout(f.state.root, f.state.nodes).width)) + 2 * PAD;
const maxLevels = (frames: F[]) => Math.max(...frames.map((f) => levelsOf(f.state)));

// ---------- Bước 1: tìm ----------

const SEARCH_RAW = traceSearch(BASE, TARGET);

export const SEARCH = (() => {
  const frames = SEARCH_RAW.map((f): F => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      metrics: [
        { label: 'Node đã đọc', value: String(s.path.length) },
        { label: 'Số khoá', value: String(keyCount(s)) },
        { label: 'Chiều cao', value: `${levelsOf(s)} tầng` },
        { label: 'Độ phức tạp', value: 'O(log n)', tone: 'good' },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'start':
        return { ...base, say: `tìm ${TARGET}, bắt đầu ở gốc`, holdMs: 1200 };
      case 'scan': {
        const leaf = isLeafIn(s, e.node);
        return {
          ...base,
          say: scanSay(e, leaf, false),
          sayTone: e.found ? 'good' : undefined,
          codeLines: e.found ? [3, 4, 5, 6, 7] : leaf ? [3, 4, 5, 8] : [3, 4, 5, 8, 10],
          holdMs: 1400,
        };
      }
      case 'found':
        return {
          ...base,
          say: `tìm thấy ${e.key} sau khi đọc ${s.path.length} node`,
          sayTone: 'good',
          codeLines: [7],
          holdMs: 1500,
        };
      case 'miss':
        return { ...base, say: `không có ${e.target}`, codeLines: [9], holdMs: 1400 };
      default:
        return { ...base, holdMs: 1200 };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'scan');
  const e = frames[k].event as Extract<BEvent, { kind: 'scan' }>;
  const n = e.keys.length + 1;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== e.slot);
  return withAsk(frames, k, {
    prompt: `Gốc ${list(e.keys)} có ${n} con. Tìm ${TARGET} thì xuống con nào?`,
    choices: [
      `Con thứ ${e.slot + 1}: ${e.keys[e.slot - 1]} < ${TARGET} < ${e.keys[e.slot]}`,
      ...others.map((i) => `Con thứ ${i + 1}`),
    ],
    correct: 0,
    explain: `${e.keys.length} khoá chia trục số thành ${n} khoảng, mỗi khoảng là một con. ${TARGET} nằm giữa ${e.keys[e.slot - 1]} và ${e.keys[e.slot]} nên chỉ cần xuống con thứ ${e.slot + 1}; các con khác không thể chứa ${TARGET}.`,
  });
})();

// ---------- Bước 2, 3, 4: chèn ----------

function insertLines(e: BEvent): number[] {
  switch (e.kind) {
    case 'scan':
      return [4];
    case 'place':
      return [5];
    case 'overflow':
      return [7];
    case 'split':
      return e.parent === null ? [8, 9, 10, 11, 12] : [8, 9, 10, 14, 15];
    default:
      return [];
  }
}

function narrateInsert(raw: F[]): F[] {
  return raw.map((f, k) => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      codeLines: insertLines(e),
      metrics: [
        { label: 'Số khoá', value: String(keyCount(s)) },
        { label: 'Chiều cao', value: `${levelsOf(s)} tầng` },
        { label: 'Node đã đọc', value: String(s.path.length) },
        { label: 'Lần tách', value: String(splitsUpTo(raw, k)) },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'scan':
        return { ...base, say: scanSay(e, isLeafIn(s, e.node), true), holdMs: 1100 };
      case 'place':
        return e.keys.length > MAX_KEYS
          ? {
              ...base,
              say: `thêm ${e.key}: ${list(e.keys)}, quá ${MAX_KEYS} khoá`,
              sayTone: 'bad',
              holdMs: 1300,
            }
          : { ...base, say: `thêm ${e.key}: ${list(e.keys)}`, sayTone: 'good', holdMs: 1100 };
      case 'overflow':
        return { ...base, say: `${list(e.keys)} tràn: tách đôi`, sayTone: 'bad', holdMs: 1300 };
      case 'split':
        return {
          ...base,
          say:
            e.parent === null
              ? `tách gốc: ${list(e.left)} và ${list(e.right)}, ${e.up} thành gốc mới`
              : `tách: ${list(e.left)} và ${list(e.right)}, ${e.up} đi lên cha`,
          sayTone: 'good',
          holdMs: 1700,
        };
      default:
        return { ...base, holdMs: 1300 };
    }
  });
}

const INSERT_RAW = traceInsert(BASE, [ADDED]);

export const INSERT = (() => {
  const frames = narrateInsert(INSERT_RAW);
  setSay(frames, 0, `chèn ${ADDED}: đi xuống như khi tìm`);
  setSay(frames, frames.length - 1, 'xong: chỉ lá bị tràn và node cha của nó thay đổi', {
    sayTone: 'good',
  });
  const k = frames.findIndex((f) => f.event.kind === 'overflow');
  const e = frames[k].event as Extract<BEvent, { kind: 'overflow' }>;
  return withAsk(frames, k, {
    prompt: `Thêm ${ADDED} xong, lá thành ${list(e.keys)}: ${e.keys.length} khoá, quá giới hạn ${MAX_KEYS}. Chuyện gì xảy ra?`,
    choices: [
      'Tách đôi lá, khoá ở giữa đi lên node cha',
      'Thêm một tầng mới bên dưới lá này',
      `Lá được giữ ${e.keys.length} khoá, không cần làm gì`,
    ],
    correct: 0,
    explain: `Lá tách thành hai lá nhỏ, khoá ở giữa đi lên node cha để làm khoá ngăn cách. Cây không mọc thêm tầng bên dưới, nên mọi lá vẫn cùng độ sâu.`,
  });
})();

const AFTER_INSERT = [...BASE, ADDED];
const CASCADE_RAW = traceInsert(AFTER_INSERT, CASCADE);

export const CASCADED = (() => {
  const frames = narrateInsert(CASCADE_RAW);
  setSay(frames, 0, `chèn ${CASCADE.join(', ')} vào cây ${levelsOf(CASCADE_RAW[0].state)} tầng`);
  setSay(
    frames,
    frames.length - 1,
    `cây cao ${levelsOf(CASCADE_RAW.at(-1)!.state)} tầng, mọi lá vẫn cùng độ sâu`,
    { sayTone: 'good' },
  );
  const k = frames.findIndex((f) => f.event.kind === 'split' && f.event.parent === null);
  const before = frames[k - 1].state;
  const root = before.nodes.find((n) => n.id === before.root)!;
  return withAsk(frames, k, {
    prompt: `Khoá đi lên làm gốc ${list(root.keys)} cũng tràn. Tách gốc xong thì cây thế nào?`,
    choices: [
      'Có gốc mới ở trên cùng: cây cao thêm 1 tầng, mọi lá vẫn cùng độ sâu',
      'Chỉ nhánh bên phải sâu thêm 1 tầng',
      'Chiều cao không đổi',
    ],
    correct: 0,
    explain:
      'Gốc không có cha để nhận khoá giữa, nên khoá đó thành một gốc mới phía trên. Cả cây cao thêm đúng 1 tầng cùng lúc: B-tree cao lên từ gốc, không phải từ lá, nên không bao giờ lệch.',
  });
})();

const SORTED_RAW = traceInsert([], SORTED_KEYS);

export const SORTED = (() => {
  const frames = narrateInsert(SORTED_RAW);
  const finalHeight = levelsOf(SORTED_RAW.at(-1)!.state);
  setSay(
    frames,
    0,
    `chèn ${SORTED_KEYS[0]}, ${SORTED_KEYS[1]}, …, ${SORTED_KEYS.at(-1)} theo thứ tự tăng`,
  );
  setSay(
    frames,
    frames.length - 1,
    `${SORTED_KEYS.length} khoá đã sort: cây cao ${finalHeight} tầng, BST thường sẽ cao ${SORTED_KEYS.length}`,
    { sayTone: 'good' },
  );
  const last = SORTED_KEYS.at(-1)!;
  const k = frames.findIndex((f) => f.event.kind === 'scan' && f.event.target === last);
  return withAsk(frames, k, {
    prompt: `Chèn ${SORTED_KEYS.length} khoá đã sort ${SORTED_KEYS[0]}, ${SORTED_KEYS[1]}, …, ${last}. BST thường sẽ cao ${SORTED_KEYS.length} tầng. Chèn nốt ${last} thì B-tree này cao bao nhiêu tầng?`,
    choices: [String(finalHeight), String(SORTED_KEYS.length), String(finalHeight + 3)],
    correct: 0,
    explain: `Khoá tăng dần luôn vào lá bên phải nhất. Lá đầy thì tách, gốc đầy thì tách gốc: ${last} làm gốc tách, cây cao ${finalHeight} tầng. Cây chỉ cao thêm khi gốc tách, nên chiều cao vẫn khoảng log n.`,
  });
})();

// ---------- Bước 5: một node là một trang ----------

type RowEvent = { kind: 'row'; index: number };

export const FANOUT_ROWS = SIZES.map(({ n, label }) => ({
  label,
  binary: minHeight(n, 1),
  small: minHeight(n, MAX_KEYS),
  page: minHeight(n, FANOUT),
}));

export const PAGES = (() => {
  const frames = Array.from(
    { length: FANOUT_ROWS.length + 1 },
    (_, i): Frame<CodeTraceState, RowEvent> => ({
      state: {
        rows: FANOUT_ROWS.slice(0, i).map((r) => [
          r.label,
          String(r.binary),
          String(r.small),
          String(r.page),
        ]),
      },
      event: { kind: 'row', index: i },
      codeLines: i === 0 ? [] : [2, 10],
      holdMs: i === 0 ? 1000 : 1600,
      metrics: [
        { label: 'Mỗi node', value: `${FANOUT} khoá` },
        { label: 'Trang của Postgres', value: '8 KB' },
        { label: 'Tầng = trang phải đọc', value: 'log n' },
        { label: '1 tỷ dòng', value: `${FANOUT_ROWS.at(-1)!.page} trang`, tone: 'good' },
      ],
    }),
  );
  const big = FANOUT_ROWS.at(-1)!;
  return frames.map((f, k) =>
    k === frames.length - 1
      ? {
          ...f,
          ask: {
            prompt: `Bảng ${big.label} dòng, index B-tree mỗi node chứa ${FANOUT} khoá. Tìm một dòng cần đọc khoảng bao nhiêu node?`,
            choices: [String(big.page), String(big.binary), String(big.small)],
            correct: 0,
            explain: `Cây cao h tầng chứa được tới ${FANOUT + 1}^h − 1 khoá: ${FANOUT + 1}⁴ đã hơn 8 tỷ, nên ${big.page} tầng là đủ. Cây nhị phân cần ${big.binary} tầng, tức ${big.binary} lần đọc trang.`,
          },
        }
      : f,
  );
})();

// ---------- Bước 6: tóm tắt ----------

// Một hàng cho mỗi khoá chèn ở bước 4: việc xảy ra và chiều cao sau đó.
export const RECAP = (() => {
  const rows: string[][] = [];
  const frames: Frame<CodeTraceState, RowEvent>[] = [
    {
      state: { rows: [] },
      event: { kind: 'row', index: 0 },
      codeLines: [3],
      holdMs: 900,
    },
  ];
  let splits: string[] = [];
  for (const f of SORTED_RAW) {
    const e = f.event;
    if (e.kind === 'split') {
      splits.push(e.parent === null ? `tách gốc, ${e.up} thành gốc` : `tách lá, ${e.up} lên`);
    }
    const next = SORTED_RAW[SORTED_RAW.indexOf(f) + 1];
    const endOfInsert =
      (e.kind === 'place' || e.kind === 'split') &&
      (next === undefined || next.event.kind === 'scan' || next.event.kind === 'done');
    if (!endOfInsert) continue;
    const key = f.state.fresh!;
    rows.push([
      String(key),
      splits.length ? splits.join('; ') : 'thêm vào lá',
      String(levelsOf(f.state)),
    ]);
    frames.push({
      state: { rows: rows.map((r) => [...r]) },
      event: { kind: 'row', index: rows.length },
      codeLines: splits.length ? [7, 8, 9, 10] : [4, 5],
      holdMs: splits.length ? 1300 : 700,
      metrics: [
        { label: 'Số khoá', value: String(rows.length) },
        { label: 'Chiều cao', value: `${levelsOf(f.state)} tầng` },
        { label: 'Tìm, chèn', value: 'O(log n)', tone: 'good' },
        { label: 'Mọi lá', value: 'cùng độ sâu', tone: 'good' },
      ],
    });
    splits = [];
  }
  return frames;
})();

// ---------- Scene ----------

const scene = (title: string, code: readonly string[], file: string, frames: F[]) =>
  btreeScene({
    title,
    code: { file, lines: code },
    width: widthOf(frames),
    levels: maxLevels(frames),
  });

const SearchScene = scene('B-TREE', CODE_SEARCH, 'btree.py', SEARCH);
const InsertScene = scene('CHÈN VÀ TÁCH', CODE_INSERT, 'btree.py', INSERT);
const CascadeScene = scene('TÁCH LAN LÊN GỐC', CODE_INSERT, 'btree.py', CASCADED);
const SortedScene = scene('CHÈN KHOÁ ĐÃ SORT', CODE_INSERT, 'btree.py', SORTED);
const PagesScene = codeTraceScene({
  file: 'btree.py',
  code: CODE_SEARCH,
  columns: ['số dòng', 'cây nhị phân', `${MAX_KEYS} khoá/node`, `${FANOUT} khoá/node`],
  title: 'SỐ TẦNG = SỐ NODE PHẢI ĐỌC',
});
const RecapScene = codeTraceScene({
  file: 'btree.py',
  code: CODE_INSERT,
  columns: ['chèn', 'việc xảy ra', 'cao'],
  title: `CHÈN ${SORTED_KEYS.length} KHOÁ ĐÃ SORT`,
});

// ---------- Các bước ----------

const steps = [
  defineStep<BState, BEvent>({
    id: 'tim',
    short: 'Tìm',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Một node, nhiều khoá',
    Scene: SearchScene,
    build: () => SEARCH,
    Body: () => (
      <>
        <p>
          BST mỗi node chỉ có một khoá và hai con. B-tree cho mỗi node chứa <b>nhiều khoá</b> đã
          sort, ở đây tối đa {MAX_KEYS}. Node có k khoá thì có k + 1 con: k khoá chia trục số thành
          k + 1 khoảng, mỗi khoảng là một con.
        </p>
        <p>
          Tìm {TARGET}: ở mỗi node, dò các khoá để biết {TARGET} nằm ở khoảng nào, rồi xuống đúng
          con đó. Mọi lá nằm cùng một tầng, nên tìm khoá nào cũng đọc đúng bằng số tầng.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>CREATE INDEX idx_orders_customer ON orders (customer_id);</code> không ghi loại
          index thì Postgres tạo B-tree. MySQL (InnoDB) cũng lưu index và cả bảng theo B-tree.
        </>
      ),
    },
  }),

  defineStep<BState, BEvent>({
    id: 'chen',
    short: 'Chèn, tách',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'Chèn vào lá; lá tràn thì tách đôi',
    Scene: InsertScene,
    build: () => INSERT,
    Body: () => (
      <>
        <p>
          Chèn {ADDED}: đi xuống như khi tìm, tới lá thì thêm {ADDED} vào đúng thứ tự trong lá. Lá
          còn chỗ thì xong. Lá đã đủ {MAX_KEYS} khoá thì thêm vào sẽ <b>tràn</b>.
        </p>
        <p>
          Lá tràn được tách đôi: nửa trái, nửa phải, và khoá ở giữa đi lên node cha làm khoá ngăn
          cách. Chỉ lá đó và node cha thay đổi; phần còn lại của cây giữ nguyên.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Không bao giờ thêm tầng ở dưới lá. Khoá mới luôn vào một lá có sẵn; đầy thì tách sang ngang và đẩy một khoá lên trên.',
    },
  }),

  defineStep<BState, BEvent>({
    id: 'tach-goc',
    short: 'Tách gốc',
    tag: 'THAO TÁC',
    tone: 'lav',
    title: 'Tách lan lên tới gốc: cây cao thêm một tầng',
    Scene: CascadeScene,
    build: () => CASCADED,
    Body: () => (
      <>
        <p>
          Đẩy khoá lên có thể làm node cha tràn theo, và cha lại tách, cứ thế lên trên. Khi gốc
          tràn, không còn cha để nhận khoá giữa: khoá đó thành <b>gốc mới</b>.
        </p>
        <p>
          Đó là cách duy nhất để B-tree cao thêm, và cả cây cao thêm cùng lúc. Vì vậy mọi lá luôn
          cùng độ sâu: B-tree luôn cân bằng, không cần bước cân bằng lại nào.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'BST mọc dài ở lá nên có thể lệch. B-tree mọc lên ở gốc nên không bao giờ lệch.',
    },
  }),

  defineStep<BState, BEvent>({
    id: 'khoa-da-sort',
    short: 'Khoá đã sort',
    tag: 'TRƯỜNG HỢP KHÓ',
    tone: 'rose',
    title: 'Khoá đến đã sort: B-tree vẫn thấp',
    Scene: SortedScene,
    build: () => SORTED,
    Body: ({ frames }) => {
      const h = levelsOf(frames.at(-1)!.state);
      return (
        <>
          <p>
            Bài trước, chèn khoá đã sort làm BST thành một chuỗi. Ở đây cũng chèn{' '}
            {SORTED_KEYS.length} khoá theo thứ tự tăng: khoá nào cũng vào lá bên phải nhất, lá đó
            đầy thì tách.
          </p>
          <p>
            Kết quả: cây cao {h} tầng thay vì {SORTED_KEYS.length}. ID tự tăng hay cột thời gian,
            trường hợp tệ nhất của BST, lại là trường hợp bình thường của B-tree.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Ngược lại, khoá ngẫu nhiên như UUID v4 chèn rải khắp các lá: lá nào cũng phải tách dần và index dễ phình to, ghi rải rác. Vì vậy nhiều hệ thống chọn khoá chính tăng dần, như ID tự tăng hay UUID v7 (có phần thời gian ở đầu).',
    },
  }),

  defineStep<CodeTraceState, RowEvent>({
    id: 'trang',
    short: 'Một node một trang',
    tag: 'BIG-O',
    tone: 'sun',
    title: 'Vì sao node chứa hàng trăm khoá',
    Scene: PagesScene,
    build: () => PAGES,
    Body: () => (
      <>
        <p>
          Database đọc đĩa theo <b>trang</b>, không theo từng khoá. Đọc một trang tốn gần như nhau
          dù trang chứa 1 hay {FANOUT} khoá, nên mỗi node của index là một trang chứa càng nhiều
          khoá càng tốt.
        </p>
        <p>
          Số tầng chính là số trang phải đọc. Bảng bên cạnh tính số tầng ít nhất: với {FANOUT} khoá
          mỗi node, {FANOUT_ROWS.at(-1)!.label} dòng chỉ cần {FANOUT_ROWS.at(-1)!.page} tầng, trong
          khi cây nhị phân cần {FANOUT_ROWS.at(-1)!.binary}.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Postgres đọc và ghi theo trang 8 KB; mỗi node của index B-tree là một trang chứa vài trăm khoá. Tra một dòng trong bảng 1 tỷ dòng chỉ đọc khoảng 4 trang, và vài tầng trên cùng thường đã nằm sẵn trong bộ nhớ đệm.',
    },
  }),

  defineStep<CodeTraceState, RowEvent>({
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
          Bảng ghi lại từng lần chèn ở bước 4: phần lớn chỉ là thêm vào lá, thỉnh thoảng tách lá, và
          chỉ một lần tách gốc làm cây cao thêm. Tìm và chèn đều <b>O(log n)</b>, với cơ số là số
          khoá mỗi node.
        </p>
        <p>
          Postgres và InnoDB dùng biến thể <b>B+tree</b>: node trong chỉ giữ khoá để dẫn đường, mọi
          dòng nằm ở lá, và các lá nối với nhau, nên quét một khoảng chỉ cần đi dọc các lá.
        </p>
      </>
    ),
  }),
];

export const btreeLesson: Lesson = {
  slug: 'b-tree',
  steps,
  legend: [
    { swatch: 'sun', label: 'node đang xét, khoá đi lên' },
    { swatch: 'sky', label: 'đường đi từ gốc' },
    { swatch: 'mint', label: 'khoá tìm thấy, vừa chèn' },
    { swatch: 'rose', label: 'node tràn' },
    { swatch: 'lav', label: 'node' },
  ],
  objectives: [
    { text: 'Tìm trong node nhiều khoá', step: 0 },
    { text: 'Chèn và tách node khi tràn', step: 1 },
    { text: 'Hiểu vì sao cây cao lên từ gốc', step: 2 },
    { text: 'Thấy B-tree vẫn thấp khi khoá đến đã sort', step: 3 },
    { text: 'Ước lượng số trang đọc khi tra index', step: 4 },
  ],
  quiz: QUIZ,
};

// Dùng trong test.
export const HEIGHT_AFTER_SORTED = heightOf(build(SORTED_KEYS));
