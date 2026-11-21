import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  bucketOf,
  buildState,
  hashKey,
  HashTable,
  traceHash,
  type HashOp,
  type HashState,
} from './algorithm';

const key = fc.constantFrom('an', 'binh', 'chi', 'dung', 'em', 'giang', 'abc', 'cba', 'bac', 'x');
const op = fc.oneof(
  fc.tuple(key, fc.integer({ min: 0, max: 9 })).map(([k, v]) => ({ kind: 'set' as const, k, v })),
  key.map((k) => ({ kind: 'get' as const, k })),
  key.map((k) => ({ kind: 'delete' as const, k })),
  fc.integer({ min: 1, max: 16 }).map((m) => ({ kind: 'resize' as const, m })),
);

// Nội dung bảng dưới dạng Map, để so sánh không phụ thuộc thứ tự trong chain.
const contents = (s: HashState) =>
  new Map(s.buckets.flat().map((e) => [e.key, e.value] as [string, number]));

describe('hàm hash', () => {
  test('hash("an") = 97 + 110 = 207, và với 8 ngăn thì vào ngăn 7', () => {
    expect(hashKey('an')).toBe(207);
    expect(bucketOf('an', 8)).toBe(7);
  });

  test('chuỗi đảo chữ luôn cùng hash: điểm yếu của tổng mã ký tự', () => {
    expect(new Set(['abc', 'acb', 'bac', 'bca', 'cab', 'cba'].map(hashKey)).size).toBe(1);
  });
});

describe('HashTable', () => {
  // So với Map của JavaScript, cũng là một hash table nhưng do engine cài sẵn.
  test('khớp với Map trên mọi dãy set, get, delete, resize', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), fc.array(op, { maxLength: 50 }), (m, ops) => {
        const table = new HashTable<number>(m);
        const model = new Map<string, number>();
        for (const o of ops) {
          if (o.kind === 'set') {
            table.set(o.k, o.v);
            model.set(o.k, o.v);
          } else if (o.kind === 'get') {
            expect(table.get(o.k)).toBe(model.get(o.k));
          } else if (o.kind === 'delete') {
            expect(table.delete(o.k)).toBe(model.delete(o.k));
          } else {
            table.resize(o.m);
          }
          expect(table.size).toBe(model.size);
        }
      }),
      { numRuns: 1000 },
    );
  });
});

describe('trace', () => {
  const insertOrAdd = fc.oneof(
    fc
      .tuple(key, fc.integer({ min: 0, max: 9 }))
      .map(([k, v]): HashOp => ({ kind: 'insert', key: k, value: v })),
    key.map((k): HashOp => ({ kind: 'add', key: k, by: 1 })),
    key.map((k): HashOp => ({ kind: 'lookup', key: k })),
    fc.integer({ min: 1, max: 16 }).map((m): HashOp => ({ kind: 'resize', m })),
  );

  test('nội dung bảng sau trace khớp với Map; mọi key nằm đúng ngăn hash % m', () => {
    fc.assert(
      fc.property(fc.array(insertOrAdd, { maxLength: 40 }), (ops) => {
        const last = traceHash(buildState(8, []), ops).at(-1)!.state;
        const model = new Map<string, number>();
        for (const o of ops) {
          if (o.kind === 'insert') model.set(o.key, o.value);
          if (o.kind === 'add') model.set(o.key, (model.get(o.key) ?? 0) + o.by);
        }
        expect(contents(last)).toEqual(model);
        expect(last.size).toBe(model.size);
        last.buckets.forEach((chain, b) =>
          chain.forEach((e) => expect(bucketOf(e.key, last.m)).toBe(b)),
        );
      }),
      { numRuns: 1000 },
    );
  });

  test('tra cứu chỉ so với các key trong đúng một ngăn', () => {
    fc.assert(
      fc.property(fc.array(key, { maxLength: 12 }), key, (keys, target) => {
        const init = buildState(8, [...new Set(keys)]);
        const frames = traceHash(init, [{ kind: 'lookup', key: target }]);
        const chain = init.buckets[bucketOf(target, 8)];
        const compares = frames.filter((f) => f.event.kind === 'compare');
        expect(compares.length).toBeLessThanOrEqual(chain.length);
        expect(frames.at(-1)!.event.kind).toBe(keys.includes(target) ? 'found' : 'miss');
      }),
      { numRuns: 500 },
    );
  });

  test('resize chuyển đủ mọi key sang bảng mới, không mất key nào', () => {
    fc.assert(
      fc.property(fc.array(key, { maxLength: 12 }), fc.integer({ min: 1, max: 32 }), (keys, m) => {
        const init = buildState(8, [...new Set(keys)]);
        const frames = traceHash(init, [{ kind: 'resize', m }]);
        const last = frames.at(-1)!.state;
        expect(last.m).toBe(m);
        expect(contents(last)).toEqual(contents(init));
        expect(frames.filter((f) => f.event.kind === 'move')).toHaveLength(init.size);
      }),
      { numRuns: 300 },
    );
  });
});
