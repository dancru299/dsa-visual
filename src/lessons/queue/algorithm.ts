import type { Frame } from '@/src/engine/types';

// Mỗi phần tử có id riêng để Motion biết khối nào vừa vào, khối nào vừa ra hay vừa dời chỗ.
export type Item = { id: number; label: string };

// ---------- Ring buffer ----------

// Hàng đợi trên một mảng cố định. head là vị trí phần tử đầu; tail = (head + size) % capacity
// là ô sẽ ghi tiếp. Khi tới cuối mảng, head và tail quay về đầu: không phải dời phần tử nào.
export class RingBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    this.buf = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.count;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }

  // Trả về false khi đầy: producer phải chờ, hoặc bỏ dữ liệu, tuỳ hệ thống.
  put(x: T): boolean {
    if (this.isFull()) return false;
    this.buf[(this.head + this.count) % this.capacity] = x;
    this.count++;
    return true;
  }

  get(): T | undefined {
    if (this.count === 0) return undefined;
    const x = this.buf[this.head];
    this.buf[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return x;
  }

  peek(): T | undefined {
    return this.count === 0 ? undefined : this.buf[this.head];
  }
}

// ---------- Trace: queue không giới hạn ----------

export type QueueState = { items: Item[]; out: Item[] }; // items: từ đầu (front) tới cuối (back)

export type QueueOp = { kind: 'enqueue'; label: string } | { kind: 'dequeue' };

export type QueueEvent =
  | { kind: 'start' }
  | { kind: 'enqueue'; item: Item }
  | { kind: 'dequeue'; item: Item }
  | { kind: 'empty' };

export function traceQueue(
  initial: readonly string[],
  ops: readonly QueueOp[],
): Frame<QueueState, QueueEvent>[] {
  let nextId = 0;
  const s: QueueState = { items: initial.map((label) => ({ id: nextId++, label })), out: [] };
  const frames: Frame<QueueState, QueueEvent>[] = [];
  const snap = (event: QueueEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (const op of ops) {
    if (op.kind === 'enqueue') {
      const item = { id: nextId++, label: op.label };
      s.items.push(item);
      snap({ kind: 'enqueue', item });
    } else {
      const item = s.items.shift();
      if (!item) {
        snap({ kind: 'empty' });
        return frames;
      }
      s.out.push(item);
      snap({ kind: 'dequeue', item });
    }
  }
  return frames;
}

// ---------- Trace: list.pop(0) phải dời từng phần tử ----------

export type ShiftState = {
  slots: (Item | null)[]; // các ô của list; null là ô trống
  removed: Item | null;
  moves: number; // số lần dời một phần tử sang trái
};

export type ShiftEvent =
  | { kind: 'start' }
  | { kind: 'remove'; item: Item }
  | { kind: 'shift'; from: number; to: number }
  | { kind: 'done' };

// Mô phỏng list.pop(0) của Python: lấy phần tử đầu, rồi dời lần lượt n - 1 phần tử còn lại
// sang trái một ô để list liền lại.
export function tracePopFront(labels: readonly string[]): Frame<ShiftState, ShiftEvent>[] {
  const s: ShiftState = {
    slots: labels.map((label, id) => ({ id, label })),
    removed: null,
    moves: 0,
  };
  const frames: Frame<ShiftState, ShiftEvent>[] = [];
  const snap = (event: ShiftEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  if (s.slots.length === 0) return frames;
  const first = s.slots[0]!;
  s.removed = first;
  s.slots[0] = null;
  snap({ kind: 'remove', item: first });
  for (let i = 1; i < s.slots.length; i++) {
    s.slots[i - 1] = s.slots[i];
    s.slots[i] = null;
    s.moves++;
    snap({ kind: 'shift', from: i, to: i - 1 });
  }
  snap({ kind: 'done' });
  return frames;
}

// ---------- Trace: ring buffer, có producer và consumer ----------

export type RingState = {
  slots: (Item | null)[];
  capacity: number;
  head: number;
  size: number;
  out: Item[]; // các phần tử consumer đã lấy ra
  waiting: Item | null; // phần tử producer đang cầm vì buffer đầy
  actor: 'producer' | 'consumer' | null; // ai vừa hành động ở frame này
};

export type RingOp = { kind: 'put'; label: string } | { kind: 'get' };

export type RingEvent =
  | { kind: 'start' }
  | { kind: 'put'; slot: number; item: Item }
  | { kind: 'full'; item: Item } // buffer đầy, producer phải chờ
  | { kind: 'get'; slot: number; item: Item }
  | { kind: 'empty' };

export const tailOf = (s: Pick<RingState, 'head' | 'size' | 'capacity'>) =>
  (s.head + s.size) % s.capacity;

export function traceRing(capacity: number, ops: readonly RingOp[]): Frame<RingState, RingEvent>[] {
  let nextId = 0;
  const s: RingState = {
    slots: new Array<Item | null>(capacity).fill(null),
    capacity,
    head: 0,
    size: 0,
    out: [],
    waiting: null,
    actor: null,
  };
  const frames: Frame<RingState, RingEvent>[] = [];
  const snap = (event: RingEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (const op of ops) {
    if (op.kind === 'put') {
      // Producer thử lại đúng phần tử đang cầm, nếu trước đó phải chờ.
      const item = s.waiting?.label === op.label ? s.waiting : { id: nextId++, label: op.label };
      s.actor = 'producer';
      if (s.size === capacity) {
        s.waiting = item;
        snap({ kind: 'full', item });
        continue;
      }
      const slot = tailOf(s);
      s.slots[slot] = item;
      s.size++;
      s.waiting = null;
      snap({ kind: 'put', slot, item });
    } else {
      s.actor = 'consumer';
      if (s.size === 0) {
        snap({ kind: 'empty' });
        continue;
      }
      const slot = s.head;
      const item = s.slots[slot]!;
      s.slots[slot] = null;
      s.head = (s.head + 1) % capacity;
      s.size--;
      s.out.push(item);
      snap({ kind: 'get', slot, item });
    }
  }
  return frames;
}
