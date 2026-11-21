import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import {
  falsePositiveRate,
  measureFalsePositive,
  positionsOf,
  traceOps,
  traceRowGroups,
  type BloomEvent,
  type BloomOp,
  type BloomState,
  type ScanEvent,
  type ScanState,
} from './algorithm';
import { QUIZ } from './quiz';
import { bloomScene, rowGroupScene } from './scenes';

// ---------- Dữ liệu ----------

export const M = 16;
export const K = 3;
export const ADDED = ['an', 'binh', 'dung'];
export const ABSENT = 'nam'; // không có, và filter nhận ra ngay
export const TRUE_POS = 'an';
export const FALSE_POS = 'em'; // không có, nhưng cả 3 bit đều đã bật
export const REMOVED = 'binh';
export const KEYS = 1000; // số khoá khi đo tỉ lệ sai
export const TRIALS = 5000;
export const BITS_PER_KEY = [2, 4, 6, 8, 10, 16];
export const ASKED_BITS = 10;
export const GROUPS = [0, 1, 2, 3].map((g) => ({
  name: `rg${g + 1}`,
  keys: [0, 1, 2].map((j) => `c${String((g * 3 + j) * 7 + 1).padStart(3, '0')}`),
}));
export const QUERY = 'c022';

// ---------- Code hiển thị trên trang ----------

export const CODE_BLOOM = [
  'class BloomFilter:',
  '    def __init__(self, m, k):',
  '        self.bits = [0] * m',
  '        self.m, self.k = m, k',
  '',
  '    def positions(self, item):       # k hàm hash, mỗi hàm cho một vị trí',
  '        return [hash_i(item, i) % self.m for i in range(self.k)]',
  '',
  '    def add(self, item):',
  '        for p in self.positions(item):',
  '            self.bits[p] = 1',
  '',
  '    def might_contain(self, item):   # False: chắc chắn không có',
  '        return all(self.bits[p] for p in self.positions(item))',
  '',
  '    def remove(self, item):          # SAI: đừng làm thế này',
  '        for p in self.positions(item):',
  '            self.bits[p] = 0',
];

const CODE_SIZE = [
  'import math',
  '',
  'def false_positive_rate(m, k, n):   # m bit, k hàm hash, n khoá',
  '    return (1 - math.exp(-k * n / m)) ** k',
  '',
  'def best_k(bits_per_key):',
  '    return round(bits_per_key * math.log(2))',
];

const CODE_SPARK = [
  '(df.write',
  '   .option("parquet.bloom.filter.enabled#customer_id", "true")',
  '   .option("parquet.bloom.filter.expected.ndv#customer_id", "1000000")',
  '   .parquet("orders/"))',
  '',
  '# Mỗi row group có một bloom filter riêng cho cột customer_id.',
  '# Điều kiện bằng: row group nào chắc chắn không có thì bỏ qua.',
  'orders = spark.read.parquet("orders/")',
  `orders.where("customer_id = '${QUERY}'").show()`,
];

// ---------- Tiện ích ----------

type F = Frame<BloomState, BloomEvent>;

const withAsk = <S, E>(frames: Frame<S, E>[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

// Phần tử nào trong tập đã bật bit p.
const ownersOf = (p: number, items: readonly string[]) =>
  items.filter((x) => positionsOf(x, M, K).includes(p));

function bloomLines(e: BloomEvent): number[] {
  switch (e.kind) {
    case 'hash':
      return [6, 7];
    case 'set':
      return [10, 11];
    case 'probe':
      return [14];
    case 'verdict':
      return [13, 14];
    case 'clear':
      return [17, 18];
    default:
      return [];
  }
}

function narrate(raw: F[]): F[] {
  return raw.map((f) => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      codeLines: bloomLines(e),
      metrics: [
        { label: 'Bit đang bật', value: `${s.bits.filter((b) => b === 1).length}/${M}` },
        { label: 'Phần tử đã thêm', value: String(s.added.length) },
        { label: 'Đang xét', value: s.item ?? '—' },
        { label: 'Bộ nhớ', value: `${M} bit`, tone: 'good' },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'hash': {
        const verb = e.op === 'add' ? 'thêm' : e.op === 'remove' ? 'xoá' : 'kiểm tra';
        return {
          ...base,
          say: `${verb} "${e.item}": ${K} hàm hash cho bit ${e.positions.join(', ')}`,
          holdMs: 1300,
        };
      }
      case 'set':
        return {
          ...base,
          say: e.was === 1 ? `bit ${e.pos} đã là 1, vẫn là 1` : `bật bit ${e.pos}`,
          holdMs: 800,
        };
      case 'probe':
        return {
          ...base,
          say: e.bit === 1 ? `bit ${e.pos} = 1` : `bit ${e.pos} = 0`,
          sayTone: e.bit === 0 ? 'good' : undefined,
          holdMs: 900,
        };
      case 'verdict': {
        const wrong = (e.verdict === 'maybe') !== e.truth;
        return {
          ...base,
          say: e.verdict === 'absent' ? `chắc chắn không có "${e.item}"` : `có thể có "${e.item}"`,
          sayTone: wrong ? 'bad' : 'good',
          holdMs: 1500,
        };
      }
      case 'clear':
        return { ...base, say: `tắt bit ${e.pos}`, sayTone: 'bad', holdMs: 900 };
      default:
        return { ...base, holdMs: 1200 };
    }
  });
}

const run = (ops: BloomOp[], initial: readonly string[] = []) =>
  narrate(traceOps(M, K, ops, initial));

// ---------- Bước 1: thêm ----------

export const ADD = (() => {
  const frames = run(ADDED.map((item) => ({ kind: 'add', item })));
  setSay(frames, 0, `${M} bit, tất cả là 0`);
  setSay(
    frames,
    frames.length - 1,
    `${ADDED.length} phần tử, ${frames.at(-1)!.state.bits.filter((b) => b === 1).length} bit đang bật; filter không lưu tên nào`,
    {
      sayTone: 'good',
    },
  );
  // Câu đoán ở lần đầu tiên một phần tử cần bit đã được phần tử khác bật.
  const k = frames.findIndex((f) => f.event.kind === 'set' && f.event.was === 1);
  const e = frames[k].event as Extract<BloomEvent, { kind: 'set' }>;
  const owner = ownersOf(e.pos, frames[k - 1].state.added)[0];
  return withAsk(frames, k, {
    prompt: `Bit ${e.pos} đã được "${owner}" bật. "${e.item}" cũng cần bit ${e.pos}. Chuyện gì xảy ra?`,
    choices: [
      `Bit ${e.pos} vẫn là 1: ${owner} và ${e.item} dùng chung bit này`,
      `Bit ${e.pos} tắt về 0`,
      `${e.item} chọn một bit khác còn trống`,
    ],
    correct: 0,
    explain:
      'Thêm chỉ bật bit lên 1, không bao giờ tắt. Hai phần tử có thể chung một bit, và filter không biết bit nào là của ai. Đó là gốc của dương tính giả, và cũng là lý do không xoá được.',
  });
})();

// ---------- Bước 2: chắc chắn không có ----------

export const ABSENT_CHECK = (() => {
  const frames = run([{ kind: 'check', item: ABSENT }], ADDED);
  setSay(frames, 0, `tập hiện có: ${ADDED.join(', ')}`);
  const k = frames.findIndex((f) => f.event.kind === 'verdict');
  const zero = frames[k - 1].event as Extract<BloomEvent, { kind: 'probe' }>;
  const ones = frames
    .slice(0, k - 1)
    .flatMap((f) => (f.event.kind === 'probe' && f.event.bit === 1 ? [f.event.pos] : []));
  return withAsk(frames, k, {
    prompt: `${ones.length ? `Bit ${ones.join(', ')} của "${ABSENT}" đang bật, nhưng bit` : 'Bit'} ${zero.pos} là 0. Filter kết luận gì?`,
    choices: [`Chắc chắn không có ${ABSENT}`, `Có thể có ${ABSENT}`, 'Phải xem thêm bit còn lại'],
    correct: 0,
    explain: `Nếu ${ABSENT} từng được thêm thì cả ${K} bit của nó đều phải là 1, và bit không bao giờ bị tắt. Một bit 0 là đủ để chắc chắn, không cần xem bit còn lại.`,
  });
})();

// ---------- Bước 3: dương tính giả ----------

export const FALSE_CHECK = (() => {
  const frames = run(
    [
      { kind: 'check', item: TRUE_POS },
      { kind: 'check', item: FALSE_POS },
    ],
    ADDED,
  );
  setSay(frames, 0, `kiểm tra "${TRUE_POS}" (có thật) rồi "${FALSE_POS}" (chưa từng thêm)`);
  const k = frames.findIndex((f) => f.event.kind === 'verdict' && f.event.item === FALSE_POS);
  const pos = positionsOf(FALSE_POS, M, K);
  const owners = pos.map((p) => `bit ${p} do ${ownersOf(p, ADDED).join(' và ')}`);
  return withAsk(frames, k, {
    prompt: `Cả ${K} bit của "${FALSE_POS}" (${pos.join(', ')}) đều đang bật, dù ta chưa từng thêm ${FALSE_POS}. Filter trả lời gì?`,
    choices: [
      'Có thể có: lần này là dương tính giả',
      `Chắc chắn có ${FALSE_POS}`,
      `Chắc chắn không có ${FALSE_POS}`,
    ],
    correct: 0,
    explain: `${owners.join(', ')} bật. Filter chỉ thấy bit, không biết bit do ai bật, nên trả lời "có thể có". Vì vậy "có thể có" luôn phải kiểm tra lại ở dữ liệu thật.`,
  });
})();

// ---------- Bước 4: không xoá được ----------

export const REMOVE = (() => {
  const frames = run(
    [
      { kind: 'remove', item: REMOVED },
      { kind: 'check', item: TRUE_POS },
    ],
    ADDED,
  );
  setSay(frames, 0, `thử xoá "${REMOVED}" bằng cách tắt các bit của nó`);
  const shared = positionsOf(TRUE_POS, M, K).filter((p) => positionsOf(REMOVED, M, K).includes(p));
  const k = frames.findIndex((f) => f.event.kind === 'verdict');
  return withAsk(frames, k, {
    prompt: `Đã "xoá" ${REMOVED} bằng cách tắt ${K} bit của nó. Giờ kiểm tra "${TRUE_POS}", vẫn còn trong tập. Filter trả lời gì?`,
    choices: [
      `Chắc chắn không có ${TRUE_POS}: sai, vì ${TRUE_POS} chung bit với ${REMOVED}`,
      `Có thể có ${TRUE_POS}`,
      'Báo lỗi vì bit đã bị sửa',
    ],
    correct: 0,
    explain: `${TRUE_POS} và ${REMOVED} chung bit ${shared.join(', ')}. Tắt bit của ${REMOVED} làm ${TRUE_POS} mất bit, và filter bỏ sót một phần tử có thật: lỗi tệ nhất. Bloom filter thường không hỗ trợ xoá; cần xoá thì dựng lại từ đầu, hoặc dùng biến thể có bộ đếm (counting Bloom filter).`,
  });
})();

// ---------- Bước 5: kích thước ----------

type RowEvent = { kind: 'row'; index: number };
// Số có dấu chấm ngăn hàng nghìn, tự viết để server và trình duyệt cho cùng một chuỗi.
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pct = (x: number) => `${(x * 100).toFixed(2).replace('.', ',')}%`;

export const SIZE_ROWS = BITS_PER_KEY.map((b) => {
  const k = Math.max(1, Math.round(b * Math.LN2));
  return {
    b,
    k,
    measured: measureFalsePositive(KEYS * b, k, KEYS, TRIALS).rate,
    formula: falsePositiveRate(KEYS * b, k, KEYS),
  };
});

export const SIZE = (() => {
  const frames = Array.from(
    { length: SIZE_ROWS.length + 1 },
    (_, i): Frame<CodeTraceState, RowEvent> => {
      const r = SIZE_ROWS[i - 1];
      return {
        state: {
          rows: SIZE_ROWS.slice(0, i).map((x) => [
            String(x.b),
            String(x.k),
            pct(x.measured),
            pct(x.formula),
          ]),
        },
        event: { kind: 'row', index: i },
        codeLines: i === 0 ? [] : [3, 4, 6, 7],
        holdMs: i === 0 ? 1000 : 1400,
        metrics: [
          { label: 'Số khoá', value: fmt(KEYS) },
          { label: 'Bit mỗi khoá', value: r ? String(r.b) : '—' },
          { label: 'Bộ nhớ', value: r ? `${(KEYS * r.b) / 8} byte` : '—' },
          { label: 'Câu hỏi thử', value: fmt(TRIALS) },
        ],
      };
    },
  );
  const k = 1 + SIZE_ROWS.findIndex((r) => r.b === ASKED_BITS);
  const r = SIZE_ROWS[k - 1];
  return withAsk(frames, k, {
    prompt: `${fmt(KEYS)} khoá, ${r.b} bit cho mỗi khoá, k = ${r.k}. Hỏi về một khoá không có thì khoảng bao nhiêu phần trăm bị trả lời sai "có thể có"?`,
    choices: ['Dưới 1%', 'Khoảng 10%', '0%: không bao giờ sai'],
    correct: 0,
    explain: `Đo được ${pct(r.measured)}, công thức cho ${pct(r.formula)}. Quy tắc dễ nhớ: khoảng 10 bit mỗi khoá cho tỉ lệ sai cỡ 1%, và mỗi khi thêm khoảng 5 bit mỗi khoá thì tỉ lệ sai giảm chừng 10 lần.`,
  });
})();

// ---------- Bước 6: Parquet ----------

const SCAN_RAW = traceRowGroups(GROUPS, QUERY, M, K);

export const SCAN = (() => {
  const frames = SCAN_RAW.map((f, idx): Frame<ScanState, ScanEvent> => {
    const e = f.event;
    const s = f.state;
    const sofar = SCAN_RAW.slice(0, idx + 1);
    const skipped = sofar.filter(
      (x) => x.event.kind === 'check' && x.event.verdict === 'absent',
    ).length;
    const read = sofar.filter((x) => x.event.kind === 'read').length;
    const wasted = sofar.filter((x) => x.event.kind === 'read' && !x.event.found).length;
    const base = {
      ...f,
      metrics: [
        { label: 'Row group', value: String(s.groups.length) },
        { label: 'Bỏ qua', value: String(skipped), tone: 'good' },
        { label: 'Phải đọc', value: String(read) },
        { label: 'Đọc thừa', value: String(wasted), tone: wasted ? 'bad' : undefined },
      ] as Metric[],
    };
    switch (e.kind) {
      case 'start':
        return {
          ...base,
          say: `tìm customer_id = '${QUERY}': bit ${s.positions.join(', ')}`,
          codeLines: [8, 9],
          holdMs: 1400,
        };
      case 'check':
        return {
          ...base,
          say:
            e.verdict === 'absent'
              ? `${s.groups[e.group].name}: có bit 0, chắc chắn không có, bỏ qua`
              : `${s.groups[e.group].name}: cả ${K} bit đều bật, có thể có`,
          sayTone: e.verdict === 'absent' ? 'good' : undefined,
          codeLines: [6, 7],
          holdMs: 1400,
        };
      case 'read':
        return {
          ...base,
          say: e.found
            ? `đọc ${s.groups[e.group].name}: có '${QUERY}'`
            : `đọc ${s.groups[e.group].name}: không có, dương tính giả`,
          sayTone: e.found ? 'good' : 'bad',
          codeLines: [9],
          holdMs: 1500,
        };
      default:
        return {
          ...base,
          say: `đọc ${read}/${s.groups.length} row group thay vì cả file`,
          sayTone: 'good',
          holdMs: 1600,
        };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'check' && f.event.verdict === 'maybe');
  const g = (frames[k].event as Extract<ScanEvent, { kind: 'check' }>).group;
  const name = GROUPS[g].name;
  return withAsk(frames, k, {
    prompt: `Filter của ${name} có cả ${K} bit của '${QUERY}' đều bật. Đã chắc ${name} chứa '${QUERY}' chưa?`,
    choices: ['Chưa: phải đọc row group đó mới biết', 'Chắc chắn có', 'Chắc chắn không có'],
    correct: 0,
    explain:
      '"Có thể có" chỉ nói rằng không loại được row group này. Phải đọc nó mới biết là có thật, hay là dương tính giả như một row group khác trong file này.',
  });
})();

// ---------- Scene ----------

const AddScene = bloomScene({
  title: 'THÊM PHẦN TỬ',
  code: { file: 'bloom.py', lines: CODE_BLOOM },
});
const CheckScene = bloomScene({ title: 'KIỂM TRA', code: { file: 'bloom.py', lines: CODE_BLOOM } });
const RemoveScene = bloomScene({ title: 'THỬ XOÁ', code: { file: 'bloom.py', lines: CODE_BLOOM } });
const SizeScene = codeTraceScene({
  file: 'size.py',
  code: CODE_SIZE,
  columns: ['bit mỗi khoá', 'k', 'sai (đo)', 'sai (công thức)'],
  title: `TỈ LỆ SAI VỚI ${fmt(KEYS)} KHOÁ`,
});
const ScanScene = rowGroupScene({ code: { file: 'orders.py', lines: CODE_SPARK } });

// ---------- Các bước ----------

const steps = [
  defineStep<BloomState, BloomEvent>({
    id: 'them',
    short: 'Thêm',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Một mảng bit và vài hàm hash',
    Scene: AddScene,
    build: () => ADD,
    Body: () => (
      <>
        <p>
          Bloom filter là một mảng m bit, ban đầu toàn 0, cùng k hàm hash. Thêm một phần tử: tính k
          hàm hash để được k vị trí, rồi bật các bit đó lên 1. Ở đây m = {M}, k = {K}.
        </p>
        <p>
          Filter không lưu phần tử nào, chỉ lưu bit. Vì vậy nó rất nhỏ, nhưng chỉ trả lời được một
          câu hỏi: phần tử này <b>có thể</b> đã được thêm hay chưa.
        </p>
      </>
    ),
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Hash table lưu chính phần tử nên trả lời chắc chắn. Bloom filter đổi độ chắc chắn lấy bộ nhớ: vài bit mỗi phần tử, dù phần tử dài bao nhiêu.',
    },
  }),

  defineStep<BloomState, BloomEvent>({
    id: 'khong-co',
    short: 'Không có',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'Một bit 0 là đủ: chắc chắn không có',
    Scene: CheckScene,
    build: () => ABSENT_CHECK,
    Body: () => (
      <>
        <p>
          Kiểm tra &quot;{ABSENT}&quot;: tính lại k vị trí, xem từng bit. Gặp một bit 0 là dừng: nếu{' '}
          {ABSENT} từng được thêm, bit đó đã là 1, mà bit không bao giờ bị tắt.
        </p>
        <p>
          Đây là câu trả lời luôn đúng của Bloom filter: <b>chắc chắn không có</b>. Kiểm tra tốn k
          bước, dù tập có bao nhiêu phần tử.
        </p>
      </>
    ),
  }),

  defineStep<BloomState, BloomEvent>({
    id: 'duong-tinh-gia',
    short: 'Dương tính giả',
    tag: 'THAO TÁC',
    tone: 'lav',
    title: 'Mọi bit đều bật: chỉ là "có thể có"',
    Scene: CheckScene,
    build: () => FALSE_CHECK,
    Body: () => (
      <>
        <p>
          &quot;{TRUE_POS}&quot; có thật: cả {K} bit đều bật, filter trả lời có thể có, và đúng là
          có. &quot;{FALSE_POS}&quot; chưa từng được thêm, nhưng các bit của nó tình cờ đã được
          những phần tử khác bật.
        </p>
        <p>
          Filter trả lời &quot;có thể có&quot; cho {FALSE_POS}: <b>dương tính giả</b>. Bloom filter
          có thể nói có khi thật ra không có, nhưng không bao giờ nói không có khi thật ra có.
        </p>
      </>
    ),
    callout: {
      kind: 'warn',
      title: 'CHÚ Ý',
      text: 'Dùng Bloom filter để loại bỏ, không phải để khẳng định. "Chắc chắn không có" thì bỏ qua được; "có thể có" thì vẫn phải kiểm tra lại ở dữ liệu thật.',
    },
  }),

  defineStep<BloomState, BloomEvent>({
    id: 'khong-xoa',
    short: 'Không xoá được',
    tag: 'BẪY',
    tone: 'rose',
    title: 'Tắt bit để xoá: filter bắt đầu bỏ sót',
    Scene: RemoveScene,
    build: () => REMOVE,
    Body: () => (
      <>
        <p>
          Thử xoá &quot;{REMOVED}&quot; bằng cách tắt {K} bit của nó. Nhưng {TRUE_POS} cũng dùng một
          trong các bit đó. Kiểm tra lại {TRUE_POS}: filter nói chắc chắn không có, dù {TRUE_POS}{' '}
          vẫn còn.
        </p>
        <p>
          Đó là <b>âm tính giả</b>, đúng thứ Bloom filter hứa không bao giờ xảy ra. Vì vậy Bloom
          filter thường chỉ cho thêm, không cho xoá; dữ liệu đổi nhiều thì dựng lại filter.
        </p>
      </>
    ),
  }),

  defineStep<CodeTraceState, RowEvent>({
    id: 'kich-thuoc',
    short: 'Kích thước',
    tag: 'BIG-O',
    tone: 'sun',
    title: 'Bao nhiêu bit thì đủ?',
    Scene: SizeScene,
    build: () => SIZE,
    Body: () => {
      const ten = SIZE_ROWS.find((r) => r.b === ASKED_BITS)!;
      return (
        <>
          <p>
            Càng nhiều bit cho mỗi khoá, các bit càng ít bị dùng chung, tỉ lệ sai càng thấp. Bảng
            bên cạnh thêm {fmt(KEYS)} khoá rồi hỏi {fmt(TRIALS)} khoá chưa từng thêm, đếm số lần trả
            lời sai, và so với công thức.
          </p>
          <p>
            Với {ten.b} bit mỗi khoá (k = {ten.k}), tỉ lệ sai chỉ {pct(ten.measured)}. 1 triệu khoá
            như vậy tốn khoảng 1,25 MB. Thêm và kiểm tra đều tốn k bước: <b>O(k)</b>, không phụ
            thuộc số phần tử.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Đặc tả bloom filter của Parquet có bảng tra tương tự: khoảng 10,5 bit mỗi giá trị cho tỉ lệ sai 1%, khoảng 16,9 bit cho 0,1%.',
    },
  }),

  defineStep<ScanState, ScanEvent>({
    id: 'parquet',
    short: 'Parquet',
    tag: 'ỨNG DỤNG',
    tone: 'peach',
    title: 'Parquet: bỏ qua row group không cần đọc',
    Scene: ScanScene,
    build: () => SCAN,
    Body: ({ frames }) => {
      const read = frames.filter((f) => f.event.kind === 'read').length;
      return (
        <>
          <p>
            File Parquet chia thành các row group. Khi ghi, có thể bật bloom filter cho một cột: mỗi
            row group có filter riêng cho cột đó. Ở đây mỗi row group có 3 khách và một filter {M}{' '}
            bit.
          </p>
          <p>
            Tìm customer_id = &apos;{QUERY}&apos;: row group nào có bit 0 thì bỏ qua, không đọc. Chỉ{' '}
            {read}/{GROUPS.length} row group phải đọc, trong đó một cái là dương tính giả. Điều kiện
            bằng (=) trên cột có nhiều giá trị khác nhau, như id, là chỗ Bloom filter có ích nhất.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Spark bật bloom filter khi ghi Parquet bằng{' '}
          <code>
            .option(&quot;parquet.bloom.filter.enabled#customer_id&quot;, &quot;true&quot;)
          </code>
          . Đặc tả của Parquet dùng split block Bloom filter: các khối 256 bit, hash bằng XXH64, và
          filter lưu theo từng cột trong từng row group.
        </>
      ),
    },
  }),
];

export const bloomLesson: Lesson = {
  slug: 'bloom-filter',
  steps,
  legend: [
    { swatch: 'sky', label: 'bit đang bật' },
    { swatch: 'sun', label: 'bit đang xem, có thể có' },
    { swatch: 'mint', label: 'chắc chắn không có' },
    { swatch: 'rose', label: 'bit vừa tắt, trả lời sai' },
  ],
  objectives: [
    { text: 'Thêm phần tử bằng k hàm hash', step: 0 },
    { text: 'Trả lời "chắc chắn không có"', step: 1 },
    { text: 'Hiểu dương tính giả', step: 2 },
    { text: 'Hiểu vì sao không xoá được', step: 3 },
    { text: 'Chọn số bit theo tỉ lệ sai', step: 4 },
    { text: 'Bỏ qua row group của Parquet', step: 5 },
  ],
  quiz: QUIZ,
};
