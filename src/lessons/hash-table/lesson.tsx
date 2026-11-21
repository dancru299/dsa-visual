import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import {
  bucketOf,
  buildState,
  hashKey,
  loadFactor,
  longestChain,
  traceHash,
  type HashEvent,
  type HashOp,
  type HashState,
} from './algorithm';
import { hashScene } from './scenes';

// ---------- Code hiển thị trên trang ----------

export const CODE_TABLE = [
  'def h(key):',
  '    return sum(ord(c) for c in key)',
  '',
  'buckets = [[] for _ in range(8)]',
  '',
  'def put(key, value):',
  '    chain = buckets[h(key) % len(buckets)]',
  '    for i, (k, v) in enumerate(chain):',
  '        if k == key:',
  '            chain[i] = (key, value)',
  '            return',
  '    chain.append((key, value))',
  '',
  'def get(key):',
  '    chain = buckets[h(key) % len(buckets)]',
  '    for k, v in chain:',
  '        if k == key:',
  '            return v',
  '    return None',
];

const CODE_RESIZE = [
  'def resize(new_size):',
  '    global buckets',
  '    old = buckets',
  '    buckets = [[] for _ in range(new_size)]',
  '    for chain in old:',
  '        for key, value in chain:',
  '            buckets[h(key) % new_size].append((key, value))',
];

const CODE_GROUP = [
  'counts = {}        # dict của Python là một hash table',
  'for row in orders:',
  '    key = row["customer"]',
  '    counts[key] = counts.get(key, 0) + 1',
];

const SQL_GROUP = 'SELECT customer, COUNT(*)\nFROM orders\nGROUP BY customer';

// ---------- Dữ liệu ----------

export const M = 8;
export const FIRST_KEYS = ['an', 'binh', 'chi', 'dung', 'em', 'giang'];
export const MORE_KEYS = ['hoa', 'khoa', 'linh', 'minh', 'nam'];
export const MISSING = 'quan';
export const BIG_M = 16;
export const ORDERS = ['an', 'binh', 'an', 'chi', 'an', 'binh', 'em', 'chi'];
export const ANAGRAMS = ['abc', 'acb', 'bac', 'bca', 'cab', 'cba'];

const insert = (key: string): HashOp => ({ kind: 'insert', key, value: 1 });
const lookup = (key: string): HashOp => ({ kind: 'lookup', key });
const fmt2 = (x: number) => x.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// ---------- Lời dẫn ----------

type Mode = 'table' | 'resize' | 'group';

// Sự kiện kết thúc của thao tác chứa frame k: biết nó là put hay get để tô đúng dòng code.
function terminalAfter(frames: Frame<HashState, HashEvent>[], k: number): HashEvent['kind'] {
  for (let j = k; j < frames.length; j++) {
    const kind = frames[j].event.kind;
    if (kind === 'insert' || kind === 'update' || kind === 'found' || kind === 'miss') return kind;
  }
  return 'done';
}

function linesFor(mode: Mode, e: HashEvent, end: HashEvent['kind']): number[] {
  if (mode === 'resize') return e.kind === 'grow' ? [3, 4] : e.kind === 'move' ? [5, 6, 7] : [];
  if (mode === 'group')
    return e.kind === 'insert' || e.kind === 'update' ? [4] : e.kind === 'start' ? [1] : [3, 4];
  const isGet = end === 'found' || end === 'miss';
  switch (e.kind) {
    case 'hash':
      return isGet ? [15] : [7];
    case 'compare':
      return isGet ? [16, 17] : [8, 9];
    case 'update':
      return [10];
    case 'insert':
      return [12];
    case 'found':
      return [18];
    case 'miss':
      return [19];
    default:
      return [];
  }
}

const tableMetrics = (s: HashState): Metric[] => [
  { label: 'n (số key)', value: String(s.size) },
  { label: 'm (số ngăn)', value: String(s.m) },
  {
    label: 'Load factor n/m',
    value: fmt2(loadFactor(s)),
    tone: loadFactor(s) > 0.75 ? 'bad' : undefined,
  },
  { label: 'Chain dài nhất', value: String(longestChain(s)) },
];

function narrate(
  frames: Frame<HashState, HashEvent>[],
  mode: Mode,
  metrics: (f: Frame<HashState, HashEvent>, k: number) => Metric[] = (f) => tableMetrics(f.state),
): Frame<HashState, HashEvent>[] {
  return frames.map((f, k) => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      metrics: metrics(f, k),
      codeLines: linesFor(mode, e, terminalAfter(frames, k)),
    };
    switch (e.kind) {
      case 'start':
        return { ...base, holdMs: 700 };
      case 'hash':
        return { ...base, say: `hash("${e.key}") = ${e.hash} → ngăn ${e.bucket}`, holdMs: 1200 };
      case 'compare':
        return {
          ...base,
          say: e.equal ? `${e.with} = ${e.key}: đúng key` : `${e.with} ≠ ${e.key}: so tiếp`,
          holdMs: 700,
        };
      case 'insert': {
        const chain = s.buckets[e.bucket];
        const collided = chain.length > 1;
        return {
          ...base,
          say: collided
            ? `va chạm: ${e.key} xếp sau ${chain[chain.length - 2].key} trong ngăn ${e.bucket}`
            : `thêm ${e.key} vào ngăn ${e.bucket}`,
          holdMs: collided ? 1300 : 900,
        };
      }
      case 'update':
        return {
          ...base,
          say: mode === 'group' ? `${e.key} đã có: count = ${e.value}` : `ghi đè ${e.key}`,
          sayTone: 'good',
          holdMs: 1000,
        };
      case 'found':
        return {
          ...base,
          say: `tìm thấy ${e.key} sau ${s.comparisons} lần so`,
          sayTone: 'good',
          holdMs: 1400,
        };
      case 'miss':
        return {
          ...base,
          say:
            s.buckets[e.bucket].length === 0
              ? `ngăn ${e.bucket} rỗng: không có ${e.key}`
              : `hết ngăn ${e.bucket}: không có ${e.key}`,
          sayTone: 'bad',
          holdMs: 1400,
        };
      case 'grow':
        return { ...base, say: `tạo bảng mới ${e.to} ngăn, chuyển từng key sang`, holdMs: 1200 };
      case 'move':
        return { ...base, say: `${e.key}: ngăn ${e.from} → ngăn ${e.to}`, holdMs: 750 };
      case 'done':
        return { ...base, say: 'xong: mọi key đã ở bảng mới', sayTone: 'good', holdMs: 1300 };
    }
  });
}

// Gắn câu đoán vào frame đầu tiên thoả điều kiện.
function askAt(
  frames: Frame<HashState, HashEvent>[],
  match: (f: Frame<HashState, HashEvent>) => boolean,
  ask: (f: Frame<HashState, HashEvent>) => Ask,
): Frame<HashState, HashEvent>[] {
  const k = frames.findIndex(match);
  return frames.map((f, i) => (i === k ? { ...f, ask: ask(f) } : f));
}

// ---------- Trace của từng bước ----------

const EMPTY = buildState(M, []);
const AFTER_FIRST = buildState(M, FIRST_KEYS);
const AFTER_MORE = buildState(M, [...FIRST_KEYS, ...MORE_KEYS]);

export const HASHING = askAt(
  narrate(traceHash(EMPTY, FIRST_KEYS.map(insert)), 'table'),
  (f) => f.event.kind === 'hash' && f.event.key === 'em',
  (f) => {
    const { hash, bucket } = f.state.probe!;
    return {
      prompt: `"em" có hash = 101 + 109 = ${hash}. Bảng có ${M} ngăn. "em" vào ngăn nào?`,
      choices: [String(bucket), String(Math.floor(hash / M)), '0'],
      correct: 0,
      explain: `${hash} % ${M} = ${bucket}: lấy phần dư khi chia cho số ngăn. Phần dư luôn nằm trong khoảng 0 tới ${M - 1}, nên luôn là một ngăn hợp lệ.`,
    };
  },
);

export const LOOKUPS = askAt(
  narrate(traceHash(AFTER_FIRST, [lookup('giang'), lookup(MISSING)]), 'table', (f) => [
    { label: 'Key đang tra', value: f.state.probe?.key ?? '—' },
    { label: 'Số lần so', value: String(f.state.comparisons) },
    { label: 'Số key trong bảng', value: String(f.state.size) },
    { label: 'Tra cứu', value: 'O(1) trung bình', tone: 'good' },
  ]),
  (f) => f.event.kind === 'hash' && f.event.key === MISSING,
  (f) => {
    const { hash, bucket } = f.state.probe!;
    return {
      prompt: `"${MISSING}" có hash = ${hash}. Tra "${MISSING}" thì phải nhìn vào ngăn nào?`,
      choices: [String(bucket), 'Cả 8 ngăn', String(bucketOf('giang', M))],
      correct: 0,
      explain: `${hash} % ${M} = ${bucket}. Nếu "${MISSING}" có trong bảng thì nó chỉ có thể nằm ở ngăn ${bucket}, nên không cần nhìn ngăn nào khác.`,
    };
  },
);

export const COLLISIONS = askAt(
  narrate(traceHash(AFTER_FIRST, [...MORE_KEYS.map(insert), lookup('nam')]), 'table'),
  (f) => f.event.kind === 'found',
  (f) => {
    const chain = f.state.buckets[f.state.hit!.bucket].map((e) => e.key);
    return {
      prompt: `Ngăn ${f.state.hit!.bucket} đang có ${chain.join(' → ')}. Tra "nam" phải so bao nhiêu key?`,
      choices: [String(f.state.comparisons), '1', String(f.state.size)],
      correct: 0,
      explain: `Đi dọc chain từ đầu: ${chain.join(', ')}. Tới "nam" là ${f.state.comparisons} lần so. Chain càng dài, tra càng chậm.`,
    };
  },
);

export const RESIZE = askAt(
  narrate(traceHash(AFTER_MORE, [{ kind: 'resize', m: BIG_M }]), 'resize', (f) => {
    const s = f.state;
    const moved = s.old ? s.size - s.old.flat().length : f.event.kind === 'done' ? s.size : 0;
    return [
      { label: 'm (số ngăn)', value: String(s.m) },
      {
        label: 'Load factor',
        value: fmt2(loadFactor(s)),
        tone: loadFactor(s) > 0.75 ? 'bad' : 'good',
      },
      { label: 'Chain dài nhất', value: String(longestChain(s)) },
      { label: 'Đã chuyển', value: `${moved}/${s.size}` },
    ];
  }),
  (f) => f.event.kind === 'move' && f.event.key === 'nam',
  (f) => {
    const e = f.event as Extract<HashEvent, { kind: 'move' }>;
    return {
      prompt: `"nam" có hash = ${hashKey('nam')}. Bảng mới có ${BIG_M} ngăn. "nam" sang ngăn nào?`,
      choices: [String(e.to), String(e.from), String(hashKey('nam'))],
      correct: 0,
      explain: `${hashKey('nam')} % ${BIG_M} = ${e.to}. Số ngăn đổi thì phần dư đổi, nên mọi key phải được hash lại, không thể giữ nguyên ngăn cũ (${e.from}).`,
    };
  },
);

export const GROUP_BY = askAt(
  narrate(
    traceHash(
      EMPTY,
      ORDERS.map((key): HashOp => ({ kind: 'add', key, by: 1 })),
    ),
    'group',
    (f) => [
      { label: 'Số nhóm', value: String(f.state.size) },
      { label: 'Đơn đang xử lý', value: f.state.probe?.key ?? '—' },
      { label: 'Số dòng đầu vào', value: String(ORDERS.length) },
      { label: 'Mỗi dòng', value: 'O(1) trung bình', tone: 'good' },
    ],
  ),
  (f) => f.event.kind === 'update',
  (f) => {
    const e = f.event as Extract<HashEvent, { kind: 'update' }>;
    return {
      prompt: `Đơn này lại là của "${e.key}", mà "${e.key}" đã có trong bảng. Làm gì?`,
      choices: [
        `Tăng count của "${e.key}" thêm 1`,
        `Thêm một entry "${e.key}" mới`,
        'Quét lại mọi đơn đã đọc',
      ],
      correct: 0,
      explain: `Mỗi khách hàng là một nhóm, nên chỉ có một entry cho "${e.key}". Hash tới đúng ngăn, tìm entry đó và cộng thêm 1: không cần đọc lại dữ liệu cũ.`,
    };
  },
);

export const SKEW = askAt(
  narrate(traceHash(EMPTY, [...ANAGRAMS.map(insert), lookup(ANAGRAMS.at(-1)!)]), 'table'),
  (f) => f.event.kind === 'found',
  (f) => ({
    prompt: `${ANAGRAMS.length} key đều nằm ở ngăn ${f.state.hit!.bucket}. Tra "${ANAGRAMS.at(-1)}" phải so bao nhiêu key?`,
    choices: [String(f.state.comparisons), '1', String(M)],
    correct: 0,
    explain: `Mọi key chung một chain, nên tra key cuối phải so cả ${f.state.comparisons} key: hash table thoái hoá thành một danh sách, O(n).`,
  }),
);

// ---------- Scene ----------

const TableScene = hashScene({ code: { file: 'hash_table.py', lines: CODE_TABLE } });
const ResizeScene = hashScene({ code: { file: 'resize.py', lines: CODE_RESIZE } });
const GroupScene = hashScene({
  code: { file: 'group_by.py', lines: CODE_GROUP },
  sql: SQL_GROUP,
  valueLabel: 'count',
});

// ---------- Các bước ----------

const steps = [
  defineStep<HashState, HashEvent>({
    id: 'ham-hash',
    short: 'Hàm hash',
    tag: 'Ý TƯỞNG',
    tone: 'mint',
    title: 'Biến key thành số ngăn',
    Scene: TableScene,
    build: () => HASHING,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      const collided = s.buckets.findIndex((c) => c.length > 1);
      return (
        <>
          <p>
            Hash table cất mỗi key vào một <b>ngăn</b> (bucket). Ngăn được tính từ chính key: một{' '}
            <b>hàm hash</b> biến key thành một số, rồi lấy phần dư khi chia cho số ngăn.
          </p>
          <p>
            Trong bài, hàm hash là tổng mã ký tự, ví dụ{' '}
            <code>hash(&quot;an&quot;) = 97 + 110 = {hashKey('an')}</code>, và{' '}
            <code>
              {hashKey('an')} % {M} = {bucketOf('an', M)}
            </code>
            . Hàm hash thật trộn bit kỹ hơn nhiều, nhưng ý tưởng giống hệt.
          </p>
          {collided >= 0 && (
            <p>
              Ngăn {collided} nhận hai key {s.buckets[collided].map((e) => e.key).join(' và ')}: đó
              là <b>va chạm</b>. Cách xử lý ở đây là xếp chúng thành một danh sách (chaining).
            </p>
          )}
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Cùng một key thì luôn ra cùng một ngăn. Vì vậy muốn tìm lại key, chỉ cần tính lại hash, không phải lục cả bảng.',
    },
  }),

  defineStep<HashState, HashEvent>({
    id: 'tra-cuu',
    short: 'Tra cứu',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'Tra cứu: chỉ nhìn đúng một ngăn',
    Scene: TableScene,
    build: () => LOOKUPS,
    Body: ({ frames }) => {
      const found = frames.find((f) => f.event.kind === 'found')!;
      const miss = frames.find((f) => f.event.kind === 'miss')!;
      return (
        <>
          <p>
            Tra &quot;giang&quot;: hash ra ngăn {found.state.hit!.bucket}, so{' '}
            {found.state.comparisons} key trong ngăn đó là thấy. Các ngăn khác không cần nhìn tới.
          </p>
          <p>
            Tra &quot;{MISSING}&quot;: hash ra ngăn {(miss.event as { bucket: number }).bucket},
            ngăn này rỗng, nên biết ngay là không có. Không phải quét {miss.state.size} key như full
            scan.
          </p>
          <p>
            Miễn là các chain ngắn, mỗi lần tra chỉ tốn vài bước, không phụ thuộc bảng lớn cỡ nào:{' '}
            <b>O(1) trung bình</b>.
          </p>
        </>
      );
    },
  }),

  defineStep<HashState, HashEvent>({
    id: 'va-cham',
    short: 'Va chạm',
    tag: 'VA CHẠM',
    tone: 'peach',
    title: 'Bảng đầy dần, chain dài dần',
    Scene: TableScene,
    build: () => COLLISIONS,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Thêm {MORE_KEYS.join(', ')}. Có {s.size} key mà chỉ {s.m} ngăn, nên va chạm nhiều hơn:
            chain dài nhất giờ có {longestChain(s)} key, và tra &quot;nam&quot; mất {s.comparisons}{' '}
            lần so.
          </p>
          <p>
            Đại lượng để theo dõi là <b>load factor</b> = số key / số ngăn, ở đây là{' '}
            {fmt2(loadFactor(s))}. Load factor càng cao, chain trung bình càng dài.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'LƯU Ý',
      text: 'Va chạm là chuyện bình thường, không phải lỗi. Điều cần tránh là để chain dài ra: khi đó tra cứu chậm dần về phía O(n).',
    },
  }),

  defineStep<HashState, HashEvent>({
    id: 'resize',
    short: 'Resize',
    tag: 'MỞ RỘNG',
    tone: 'lav',
    title: 'Gấp đôi số ngăn khi bảng quá đầy',
    Scene: ResizeScene,
    build: () => RESIZE,
    Body: ({ frames }) => {
      const before = frames[0].state;
      const after = frames.at(-1)!.state;
      return (
        <>
          <p>
            Khi load factor vượt một ngưỡng (thường khoảng 0,75), hash table tạo bảng mới gấp đôi số
            ngăn rồi chuyển từng key sang. Số ngăn đổi nên phần dư đổi: <b>mọi key phải hash lại</b>
            .
          </p>
          <p>
            Từ {before.m} lên {after.m} ngăn: load factor giảm từ {fmt2(loadFactor(before))} xuống{' '}
            {fmt2(loadFactor(after))}, chain dài nhất từ {longestChain(before)} xuống{' '}
            {longestChain(after)}.
          </p>
          <p>
            Một lần resize tốn O(n), nhưng rất hiếm khi xảy ra, nên tính trung bình mỗi lần thêm key
            vẫn là O(1).
          </p>
        </>
      );
    },
  }),

  defineStep<HashState, HashEvent>({
    id: 'group-by',
    short: 'GROUP BY',
    tag: 'ỨNG DỤNG',
    tone: 'sun',
    title: 'GROUP BY bằng hash table',
    Scene: GroupScene,
    build: () => GROUP_BY,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      const groups = s.buckets
        .flat()
        .sort((a, b) => b.value - a.value)
        .map((e) => `${e.key}: ${e.value}`);
      return (
        <>
          <p>
            Đếm số đơn theo khách hàng: đọc từng đơn, hash tên khách tới đúng ngăn, có rồi thì cộng
            thêm 1, chưa có thì thêm một nhóm mới.
          </p>
          <p>
            Đọc {ORDERS.length} đơn một lượt, ra {s.size} nhóm: {groups.join(', ')}. Bảng chỉ lớn
            theo <b>số nhóm</b>, không theo số dòng đầu vào.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Cơ sở dữ liệu gọi cách này là hash aggregation. Hash join cũng dùng đúng ý tưởng: dựng
          hash table từ bảng nhỏ (ví dụ <code>customers</code> theo <code>id</code>), rồi đọc bảng
          lớn một lượt, mỗi dòng tra O(1). Đó là cách tránh nested loop join O(n²) ở bài Big-O.
        </>
      ),
    },
  }),

  defineStep<HashState, HashEvent>({
    id: 'lech',
    short: 'Hash lệch',
    tag: 'EDGE CASE',
    tone: 'rose',
    title: 'Khi mọi key rơi vào một ngăn',
    Scene: TableScene,
    build: () => SKEW,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            {ANAGRAMS.join(', ')} là các chuỗi đảo chữ, nên tổng mã ký tự giống hệt nhau (
            {hashKey('abc')}). Cả {ANAGRAMS.length} key rơi vào một ngăn.
          </p>
          <p>
            Tra key cuối phải so {s.comparisons} lần: hash table thoái hoá thành một danh sách,{' '}
            <b>O(n)</b>. Hàm hash tốt rải key đều ra các ngăn; đó là lý do hàm hash thật phức tạp
            hơn phép cộng.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Spark chia dữ liệu khi shuffle theo hash của key, rồi lấy dư cho số partition. Nếu một key
          chiếm phần lớn dữ liệu (ví dụ <code>customer_id</code> rỗng), partition chứa nó phình to
          và cả job phải chờ nó: đó là data skew. Thêm một chú ý: <code>hash()</code> của Python cho
          chuỗi đổi kết quả giữa các lần chạy, nên đừng dùng nó để chia dữ liệu giữa các máy.
        </>
      ),
    },
  }),
];

export const hashTableLesson: Lesson = {
  slug: 'hash-table',
  steps,
  legend: [
    { swatch: 'lav', label: 'entry (key)' },
    { swatch: 'sun', label: 'ngăn, entry đang xét' },
    { swatch: 'mint', label: 'tìm thấy, vừa thêm' },
    { swatch: 'rose', label: 'ngăn không có key' },
  ],
  objectives: [
    { text: 'Hiểu hàm hash biến key thành số ngăn', step: 0 },
    { text: 'Biết vì sao tra cứu là O(1) trung bình', step: 1 },
    { text: 'Hiểu va chạm, chaining và load factor', step: 2 },
    { text: 'Hiểu vì sao resize phải hash lại mọi key', step: 3 },
    { text: 'Nối hash table với GROUP BY và hash join', step: 4 },
    { text: 'Nhận ra hash lệch và data skew', step: 5 },
  ],
};
