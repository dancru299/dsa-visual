import type { Frame } from '@/src/engine/types';

// ---------- Hàm hash ----------

// FNV-1a 32 bit, thêm seed để có k hàm hash khác nhau, rồi trộn bit cho đều. Bài dùng hàm tự
// viết để chạy y hệt trên server và trình duyệt; Parquet thì dùng XXH64.
export function hashWith(item: string, seed: number): number {
  let h = (2166136261 ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < item.length; i++) {
    h ^= item.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

export const positionsOf = (item: string, m: number, k: number) =>
  Array.from({ length: k }, (_, i) => hashWith(item, i) % m);

// ---------- Cấu trúc dữ liệu ----------

export class BloomFilter {
  readonly bits: number[];
  constructor(
    readonly m: number,
    readonly k: number,
  ) {
    this.bits = new Array(m).fill(0);
  }

  add(item: string) {
    for (const p of positionsOf(item, this.m, this.k)) this.bits[p] = 1;
  }

  // false: chắc chắn không có. true: có thể có.
  mightContain(item: string) {
    return positionsOf(item, this.m, this.k).every((p) => this.bits[p] === 1);
  }

  get ones() {
    return this.bits.filter((b) => b === 1).length;
  }
}

// ---------- Trace cho mảng bit ----------

export type Verdict = 'absent' | 'maybe';

export type BloomState = {
  m: number;
  k: number;
  bits: number[];
  item: string | null; // phần tử đang thêm, kiểm tra hoặc xoá
  positions: number[]; // k vị trí của phần tử đó
  probe: number | null; // vị trí đang xem
  added: string[]; // các phần tử thật sự có trong tập: filter không lưu, chỉ để đối chiếu
  verdict: Verdict | null;
  truth: boolean | null; // phần tử đang kiểm tra có thật trong tập không
  cleared: number[]; // các bit vừa bị tắt khi xoá
};

export type BloomEvent =
  | { kind: 'start' }
  | { kind: 'hash'; item: string; positions: number[]; op: BloomOp['kind'] }
  | { kind: 'set'; item: string; pos: number; was: number }
  | { kind: 'probe'; item: string; pos: number; bit: number }
  | { kind: 'verdict'; item: string; verdict: Verdict; truth: boolean }
  | { kind: 'clear'; item: string; pos: number }
  | { kind: 'done' };

export type BloomOp = { kind: 'add' | 'check' | 'remove'; item: string };

export function traceOps(
  m: number,
  k: number,
  ops: readonly BloomOp[],
  initial: readonly string[] = [],
): Frame<BloomState, BloomEvent>[] {
  const bf = new BloomFilter(m, k);
  initial.forEach((x) => bf.add(x));
  const s: BloomState = {
    m,
    k,
    bits: bf.bits,
    item: null,
    positions: [],
    probe: null,
    added: [...initial],
    verdict: null,
    truth: null,
    cleared: [],
  };
  const frames: Frame<BloomState, BloomEvent>[] = [];
  const snap = (event: BloomEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (const { kind, item } of ops) {
    s.item = item;
    s.positions = positionsOf(item, m, k);
    s.probe = null;
    s.verdict = null;
    s.truth = null;
    s.cleared = [];
    snap({ kind: 'hash', item, positions: [...s.positions], op: kind });

    if (kind === 'add') {
      for (const pos of s.positions) {
        const was = s.bits[pos];
        s.bits[pos] = 1;
        s.probe = pos;
        snap({ kind: 'set', item, pos, was });
      }
      if (!s.added.includes(item)) s.added.push(item);
    } else if (kind === 'remove') {
      // Cách xoá ngây thơ: tắt cả k bit. Bài dùng nó để cho thấy vì sao không xoá được.
      for (const pos of s.positions) {
        s.bits[pos] = 0;
        s.probe = pos;
        s.cleared.push(pos);
        snap({ kind: 'clear', item, pos });
      }
      s.added = s.added.filter((x) => x !== item);
    } else {
      let verdict: Verdict = 'maybe';
      for (const pos of s.positions) {
        s.probe = pos;
        const bit = s.bits[pos];
        snap({ kind: 'probe', item, pos, bit });
        if (bit === 0) {
          verdict = 'absent';
          break;
        }
      }
      s.verdict = verdict;
      s.truth = s.added.includes(item);
      snap({ kind: 'verdict', item, verdict, truth: s.truth });
    }
  }
  s.item = null;
  s.positions = [];
  s.probe = null;
  snap({ kind: 'done' });
  return frames;
}

// ---------- Trace cho các row group của Parquet ----------

export type RowGroup = { name: string; keys: string[]; bits: number[] };

export type ScanState = {
  m: number;
  k: number;
  groups: RowGroup[];
  query: string;
  positions: number[];
  current: number | null; // row group đang xét
  verdicts: (Verdict | null)[];
  found: (boolean | null)[]; // sau khi đọc row group: có thật hay không
};

export type ScanEvent =
  | { kind: 'start' }
  | { kind: 'check'; group: number; verdict: Verdict }
  | { kind: 'read'; group: number; found: boolean }
  | { kind: 'done' };

export function buildGroups(
  groups: readonly { name: string; keys: string[] }[],
  m: number,
  k: number,
) {
  return groups.map(({ name, keys }) => {
    const bf = new BloomFilter(m, k);
    keys.forEach((x) => bf.add(x));
    return { name, keys: [...keys], bits: [...bf.bits] };
  });
}

// WHERE key = query: xem filter của từng row group; "chắc chắn không có" thì bỏ qua, "có thể có"
// thì phải đọc row group đó mới biết.
export function traceRowGroups(
  groups: readonly { name: string; keys: string[] }[],
  query: string,
  m: number,
  k: number,
): Frame<ScanState, ScanEvent>[] {
  const s: ScanState = {
    m,
    k,
    groups: buildGroups(groups, m, k),
    query,
    positions: positionsOf(query, m, k),
    current: null,
    verdicts: groups.map(() => null),
    found: groups.map(() => null),
  };
  const frames: Frame<ScanState, ScanEvent>[] = [];
  const snap = (event: ScanEvent) => frames.push({ state: structuredClone(s), event });
  snap({ kind: 'start' });
  s.groups.forEach((g, i) => {
    s.current = i;
    const verdict: Verdict = s.positions.every((p) => g.bits[p] === 1) ? 'maybe' : 'absent';
    s.verdicts[i] = verdict;
    snap({ kind: 'check', group: i, verdict });
    if (verdict === 'maybe') {
      s.found[i] = g.keys.includes(query);
      snap({ kind: 'read', group: i, found: s.found[i]! });
    }
  });
  s.current = null;
  snap({ kind: 'done' });
  return frames;
}

// ---------- Đo tỉ lệ dương tính giả ----------

// Tỉ lệ lý thuyết sau khi thêm n phần tử vào m bit với k hàm hash.
export const falsePositiveRate = (m: number, k: number, n: number) =>
  (1 - Math.exp((-k * n) / m)) ** k;

// Thêm n khoá rồi hỏi `trials` khoá chưa từng thêm; đếm số lần filter trả lời "có thể có".
export function measureFalsePositive(m: number, k: number, n: number, trials: number) {
  const bf = new BloomFilter(m, k);
  for (let i = 0; i < n; i++) bf.add(`khach-${i}`);
  let wrong = 0;
  for (let i = 0; i < trials; i++) if (bf.mightContain(`la-${i}`)) wrong++;
  return { ones: bf.ones, rate: wrong / trials };
}
