import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  RingBuffer,
  tailOf,
  tracePopFront,
  traceQueue,
  traceRing,
  type QueueOp,
  type RingOp,
} from './algorithm';

const label = fc.constantFrom('a', 'b', 'c', 'd', 'e');
const ringOp: fc.Arbitrary<RingOp> = fc.oneof(
  label.map((l): RingOp => ({ kind: 'put', label: l })),
  fc.constant<RingOp>({ kind: 'get' }),
);

describe('RingBuffer', () => {
  // So với một mô hình đơn giản: mảng JavaScript, push ở cuối, shift ở đầu, giới hạn độ dài.
  test('khớp với mô hình mảng có giới hạn trên mọi dãy put, get', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(ringOp, { maxLength: 60 }),
        (cap, ops) => {
          const ring = new RingBuffer<string>(cap);
          const model: string[] = [];
          for (const op of ops) {
            if (op.kind === 'put') {
              const ok = model.length < cap;
              expect(ring.put(op.label)).toBe(ok);
              if (ok) model.push(op.label);
            } else {
              expect(ring.get()).toBe(model.shift());
            }
            expect(ring.size).toBe(model.length);
            expect(ring.peek()).toBe(model[0]);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('trace queue', () => {
  test('dequeue hết thì lấy ra đúng thứ tự đã enqueue (FIFO)', () => {
    fc.assert(
      fc.property(fc.array(label, { maxLength: 10 }), (labels) => {
        const ops: QueueOp[] = [
          ...labels.map((l): QueueOp => ({ kind: 'enqueue', label: l })),
          ...labels.map((): QueueOp => ({ kind: 'dequeue' })),
        ];
        const last = traceQueue([], ops).at(-1)!.state;
        expect(last.out.map((x) => x.label)).toEqual(labels);
        expect(last.items).toHaveLength(0);
      }),
      { numRuns: 300 },
    );
  });
});

describe('list.pop(0)', () => {
  test('dời đúng n - 1 phần tử, và list còn lại giữ nguyên thứ tự', () => {
    fc.assert(
      fc.property(fc.array(label, { minLength: 1, maxLength: 12 }), (labels) => {
        const last = tracePopFront(labels).at(-1)!.state;
        expect(last.moves).toBe(labels.length - 1);
        expect(last.removed?.label).toBe(labels[0]);
        expect(last.slots.filter((x) => x !== null).map((x) => x!.label)).toEqual(labels.slice(1));
      }),
      { numRuns: 300 },
    );
  });
});

describe('trace ring buffer', () => {
  test('dữ liệu lấy ra khớp với RingBuffer, và size không vượt capacity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(ringOp, { maxLength: 40 }),
        (cap, ops) => {
          const frames = traceRing(cap, ops);
          const ring = new RingBuffer<string>(cap);
          const out: string[] = [];
          for (const op of ops) {
            if (op.kind === 'put') ring.put(op.label);
            else {
              const x = ring.get();
              if (x !== undefined) out.push(x);
            }
          }
          expect(frames.at(-1)!.state.out.map((x) => x.label)).toEqual(out);
          for (const f of frames) {
            expect(f.state.size).toBeLessThanOrEqual(cap);
            expect(f.state.slots.filter((x) => x !== null)).toHaveLength(f.state.size);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  test('tail quay về 0 sau ô cuối', () => {
    const ops: RingOp[] = [
      ...['a', 'b', 'c', 'd'].map((l): RingOp => ({ kind: 'put', label: l })),
      { kind: 'get' },
      { kind: 'get' },
      { kind: 'put', label: 'e' },
      { kind: 'put', label: 'f' },
    ];
    const last = traceRing(6, ops).at(-1)!.state;
    expect(tailOf(last)).toBe(0);
    expect(last.slots.map((x) => x?.label ?? null)).toEqual([null, null, 'c', 'd', 'e', 'f']);
  });

  test('put khi đầy thì phải chờ, và lần thử lại sau khi có chỗ dùng lại đúng phần tử đó', () => {
    const ops: RingOp[] = [
      { kind: 'put', label: 'a' },
      { kind: 'put', label: 'b' },
      { kind: 'put', label: 'c' },
      { kind: 'get' },
      { kind: 'put', label: 'c' },
    ];
    const frames = traceRing(2, ops);
    const full = frames.find((f) => f.event.kind === 'full')!;
    expect(full.state.waiting?.label).toBe('c');
    const last = frames.at(-1)!;
    expect(last.event.kind).toBe('put');
    if (last.event.kind === 'put' && full.event.kind === 'full') {
      expect(last.event.item.id).toBe(full.event.item.id);
    }
    expect(last.state.waiting).toBeNull();
  });
});
