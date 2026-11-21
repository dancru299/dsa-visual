import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { isHeap, kWayMerge, MinHeap, topK, traceOps, type HeapOp } from './algorithm';

const num = fc.integer({ min: -50, max: 50 });
const op: fc.Arbitrary<HeapOp> = fc.oneof(
  num.map((value): HeapOp => ({ kind: 'push', value })),
  fc.constant<HeapOp>({ kind: 'pop' }),
);

describe('MinHeap', () => {
  test('pop lần lượt ra đúng thứ tự tăng dần', () => {
    fc.assert(
      fc.property(fc.array(num, { maxLength: 40 }), (xs) => {
        const h = new MinHeap();
        xs.forEach((x) => h.push(x));
        const out: number[] = [];
        while (h.size > 0) out.push(h.pop()!);
        expect(out).toEqual([...xs].sort((a, b) => a - b));
      }),
      { numRuns: 1000 },
    );
  });

  test('sau mỗi push, pop, mảng vẫn giữ tính chất heap và gốc là số nhỏ nhất', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 50 }), (ops) => {
        const h = new MinHeap();
        const model: number[] = [];
        for (const o of ops) {
          if (o.kind === 'push') {
            h.push(o.value);
            model.push(o.value);
          } else if (model.length > 0) {
            model.sort((a, b) => a - b);
            expect(h.pop()).toBe(model.shift());
          }
          expect(isHeap(h.toArray())).toBe(true);
          expect(h.peek()).toBe(model.length ? Math.min(...model) : undefined);
        }
      }),
      { numRuns: 1000 },
    );
  });
});

describe('trace', () => {
  test('mảng trong trace khớp với MinHeap sau cùng dãy thao tác, và luôn là heap ở cuối mỗi thao tác', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
        const frames = traceOps([], ops);
        const h = new MinHeap();
        for (const o of ops) {
          if (o.kind === 'push') h.push(o.value);
          else h.pop();
        }
        expect(frames.at(-1)!.state.heap.map((n) => n.value)).toEqual(h.toArray());
        for (const f of frames) {
          if (f.event.kind === 'settle' || f.event.kind === 'done') {
            expect(isHeap(f.state.heap.map((n) => n.value))).toBe(true);
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('Top-K', () => {
  test('khớp với sort giảm dần rồi lấy k phần tử đầu', () => {
    fc.assert(
      fc.property(fc.array(num, { maxLength: 40 }), fc.integer({ min: 1, max: 6 }), (xs, k) => {
        expect(topK(xs, k)).toEqual([...xs].sort((a, b) => b - a).slice(0, k));
      }),
      { numRuns: 1000 },
    );
  });
});

describe('k-way merge', () => {
  const sortedList = fc.array(num, { maxLength: 8 }).map((xs) => [...xs].sort((a, b) => a - b));

  test('trộn k dãy đã sort ra đúng dãy đã sort gồm mọi phần tử', () => {
    fc.assert(
      fc.property(fc.array(sortedList, { minLength: 1, maxLength: 5 }), (lists) => {
        const tagged = lists.map((values, i) => ({ tag: String.fromCharCode(65 + i), values }));
        expect(kWayMerge(tagged)).toEqual(lists.flat().sort((a, b) => a - b));
      }),
      { numRuns: 1000 },
    );
  });
});
