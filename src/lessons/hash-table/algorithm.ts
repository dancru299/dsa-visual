import type { Frame } from '@/src/engine/types';

// Hàm hash dùng trong bài: tổng mã ký tự. Đủ đơn giản để tự tính bằng tay, ví dụ
// hash("an") = 97 + 110 = 207. Hàm hash thật trộn bit kỹ hơn nhiều; điểm yếu của hàm này
// (các chuỗi đảo chữ luôn cùng hash) được dùng ở bước cuối để minh hoạ trường hợp tệ nhất.
export const hashKey = (key: string) => [...key].reduce((sum, c) => sum + c.charCodeAt(0), 0);

export const bucketOf = (key: string, m: number) => hashKey(key) % m;

// ---------- Cấu trúc dữ liệu ----------

// Hash table dùng chaining: mỗi ngăn là một danh sách các cặp (key, value).
export class HashTable<V> {
  private buckets: [string, V][][];
  private count = 0;

  constructor(m = 8) {
    this.buckets = Array.from({ length: m }, () => []);
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.buckets.length;
  }

  set(key: string, value: V): void {
    const chain = this.buckets[bucketOf(key, this.capacity)];
    const i = chain.findIndex(([k]) => k === key);
    if (i >= 0) chain[i] = [key, value];
    else {
      chain.push([key, value]);
      this.count++;
    }
  }

  get(key: string): V | undefined {
    return this.buckets[bucketOf(key, this.capacity)].find(([k]) => k === key)?.[1];
  }

  delete(key: string): boolean {
    const chain = this.buckets[bucketOf(key, this.capacity)];
    const i = chain.findIndex(([k]) => k === key);
    if (i < 0) return false;
    chain.splice(i, 1);
    this.count--;
    return true;
  }

  resize(m: number): void {
    const old = this.buckets.flat();
    this.buckets = Array.from({ length: m }, () => []);
    for (const [k, v] of old) this.buckets[bucketOf(k, m)].push([k, v]);
  }

  longestChain(): number {
    return Math.max(0, ...this.buckets.map((c) => c.length));
  }
}

// ---------- Trace ----------

export type Entry = { id: number; key: string; value: number };
export type Pos = { bucket: number; index: number };

export type HashState = {
  m: number;
  buckets: Entry[][];
  size: number;
  probe: { key: string; hash: number; bucket: number } | null; // key đang được hash
  cursor: Pos | null; // entry đang được so với key
  hit: Pos | null; // entry vừa tìm thấy, vừa thêm hoặc vừa cập nhật
  missBucket: number | null; // ngăn vừa tra mà không thấy
  comparisons: number; // số lần so key trong thao tác hiện tại
  old: Entry[][] | null; // bảng cũ trong lúc resize
};

export type HashOp =
  | { kind: 'insert'; key: string; value: number } // thêm, hoặc ghi đè nếu key đã có
  | { kind: 'add'; key: string; by: number } // cộng dồn: kiểu COUNT, SUM trong GROUP BY
  | { kind: 'lookup'; key: string }
  | { kind: 'resize'; m: number };

export type HashEvent =
  | { kind: 'start' }
  | { kind: 'hash'; key: string; hash: number; bucket: number }
  | { kind: 'compare'; key: string; with: string; equal: boolean }
  | { kind: 'insert'; key: string; bucket: number }
  | { kind: 'update'; key: string; bucket: number; value: number }
  | { kind: 'found'; key: string; bucket: number; value: number }
  | { kind: 'miss'; key: string; bucket: number }
  | { kind: 'grow'; from: number; to: number }
  | { kind: 'move'; key: string; from: number; to: number }
  | { kind: 'done' };

// Dựng sẵn một bảng từ danh sách key, không ghi frame. Dùng làm điểm bắt đầu cho các bước sau.
export function buildState(m: number, keys: readonly string[]): HashState {
  const buckets: Entry[][] = Array.from({ length: m }, () => []);
  keys.forEach((key, id) => buckets[bucketOf(key, m)].push({ id, key, value: 1 }));
  return {
    m,
    buckets,
    size: keys.length,
    probe: null,
    cursor: null,
    hit: null,
    missBucket: null,
    comparisons: 0,
    old: null,
  };
}

export function traceHash(init: HashState, ops: readonly HashOp[]): Frame<HashState, HashEvent>[] {
  const s: HashState = structuredClone(init);
  let nextId = Math.max(-1, ...s.buckets.flat().map((e) => e.id)) + 1;
  const frames: Frame<HashState, HashEvent>[] = [];
  const snap = (event: HashEvent) => frames.push({ state: structuredClone(s), event });
  const clear = () => {
    s.probe = null;
    s.cursor = null;
    s.hit = null;
    s.missBucket = null;
    s.comparisons = 0;
  };

  // Hash key, rồi đi dọc chain của ngăn đó. Trả về vị trí nếu thấy key.
  const findIn = (key: string): { bucket: number; index: number } => {
    clear();
    const hash = hashKey(key);
    const bucket = hash % s.m;
    s.probe = { key, hash, bucket };
    snap({ kind: 'hash', key, hash, bucket });
    const chain = s.buckets[bucket];
    for (let i = 0; i < chain.length; i++) {
      s.cursor = { bucket, index: i };
      s.comparisons++;
      const equal = chain[i].key === key;
      snap({ kind: 'compare', key, with: chain[i].key, equal });
      if (equal) return { bucket, index: i };
    }
    s.cursor = null;
    return { bucket, index: -1 };
  };

  snap({ kind: 'start' });
  for (const op of ops) {
    if (op.kind === 'resize') {
      clear();
      s.old = s.buckets;
      s.buckets = Array.from({ length: op.m }, () => []);
      const from = s.m;
      s.m = op.m;
      snap({ kind: 'grow', from, to: op.m });
      for (let b = 0; b < s.old.length; b++) {
        while (s.old[b].length > 0) {
          const e = s.old[b].shift()!;
          const to = bucketOf(e.key, s.m);
          s.buckets[to].push(e);
          s.hit = { bucket: to, index: s.buckets[to].length - 1 };
          s.probe = { key: e.key, hash: hashKey(e.key), bucket: to };
          snap({ kind: 'move', key: e.key, from: b, to });
        }
      }
      s.old = null;
      clear();
      snap({ kind: 'done' });
      continue;
    }

    const { bucket, index } = findIn(op.key);
    s.cursor = null;
    if (op.kind === 'lookup') {
      if (index >= 0) {
        s.hit = { bucket, index };
        snap({ kind: 'found', key: op.key, bucket, value: s.buckets[bucket][index].value });
      } else {
        s.missBucket = bucket;
        snap({ kind: 'miss', key: op.key, bucket });
      }
      continue;
    }

    if (index >= 0) {
      const e = s.buckets[bucket][index];
      e.value = op.kind === 'add' ? e.value + op.by : op.value;
      s.hit = { bucket, index };
      snap({ kind: 'update', key: op.key, bucket, value: e.value });
    } else {
      const value = op.kind === 'add' ? op.by : op.value;
      s.buckets[bucket].push({ id: nextId++, key: op.key, value });
      s.size++;
      s.hit = { bucket, index: s.buckets[bucket].length - 1 };
      snap({ kind: 'insert', key: op.key, bucket });
    }
  }
  clear();
  return frames;
}

export const loadFactor = (s: Pick<HashState, 'size' | 'm'>) => s.size / s.m;
export const longestChain = (s: Pick<HashState, 'buckets'>) =>
  Math.max(0, ...s.buckets.map((c) => c.length));
