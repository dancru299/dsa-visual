import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import {
  componentsBruteForce,
  groupsOf,
  heightOf,
  matchPairs,
  singletons,
  traceFind,
  traceUnions,
  type Mode,
  type Record_,
} from './algorithm';

const MODES: Mode[] = [
  { bySize: false, compress: false },
  { bySize: true, compress: false },
  { bySize: false, compress: true },
  { bySize: true, compress: true },
];

const caseArb = fc.integer({ min: 1, max: 12 }).chain((n) =>
  fc.record({
    n: fc.constant(n),
    pairs: fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 20 }),
  }),
);

const finalParent = (n: number, pairs: [number, number][], mode: Mode) =>
  traceUnions(singletons(n), pairs, mode).at(-1)!.state.parent;

describe('Union-Find', () => {
  test('mọi cách gộp đều ra đúng các thành phần liên thông', () => {
    fc.assert(
      fc.property(caseArb, ({ n, pairs }) => {
        for (const mode of MODES) {
          expect(groupsOf(finalParent(n, pairs, mode))).toEqual(componentsBruteForce(n, pairs));
        }
      }),
      { numRuns: 1000 },
    );
  });

  test('gắn cây nhỏ vào cây lớn: chiều cao không quá log₂ n + 1', () => {
    fc.assert(
      fc.property(caseArb, ({ n, pairs }) => {
        const h = heightOf(finalParent(n, pairs, { bySize: true, compress: false }));
        expect(h).toBeLessThanOrEqual(Math.floor(Math.log2(n)) + 1);
      }),
      { numRuns: 1000 },
    );
  });

  test('nén đường: sau find(x), mọi phần tử trên đường đi trỏ thẳng tới gốc', () => {
    fc.assert(
      fc.property(caseArb, fc.nat(11), ({ n, pairs }, pick) => {
        const parent = finalParent(n, pairs, { bySize: false, compress: false });
        const x = pick % n;
        const frames = traceFind(parent, x, true);
        const rootFrame = frames.find((f) => f.event.kind === 'root')!;
        const path = rootFrame.state.path;
        const root = path.at(-1)!;
        const after = frames.at(-1)!.state.parent;
        path.forEach((y) => expect(after[y]).toBe(root));
        expect(groupsOf(after)).toEqual(groupsOf(parent));
      }),
      { numRuns: 1000 },
    );
  });

  test('gộp ngây thơ theo một chuỗi tạo ra cây cao đúng n tầng', () => {
    for (let n = 1; n <= 10; n++) {
      const pairs = singletons(n - 1).map((i): [number, number] => [i, i + 1]);
      expect(heightOf(finalParent(n, pairs, { bySize: false, compress: false }))).toBe(n);
      expect(
        heightOf(finalParent(n, pairs, { bySize: true, compress: false })),
      ).toBeLessThanOrEqual(2);
    }
  });

  test('gộp bản ghi theo email hoặc số điện thoại chung khớp với cách gộp brute-force', () => {
    const value = fc.constantFrom('a', 'b', 'c', 'd', 'e');
    fc.assert(
      fc.property(
        fc.array(fc.record({ email: value, phone: value }), { minLength: 1, maxLength: 10 }),
        (raw) => {
          const records: Record_[] = raw.map((r, i) => ({ id: `r${i}`, ...r }));
          const pairs = matchPairs(records).map((p): [number, number] => [p.a, p.b]);
          // Brute force: hai bản ghi nối nhau nếu chung email hoặc chung số điện thoại.
          const direct: [number, number][] = [];
          records.forEach((x, i) =>
            records.forEach((y, j) => {
              if (i < j && (x.email === y.email || x.phone === y.phone)) direct.push([i, j]);
            }),
          );
          expect(groupsOf(finalParent(records.length, pairs, MODES[3]))).toEqual(
            componentsBruteForce(records.length, direct),
          );
        },
      ),
      { numRuns: 1000 },
    );
  });
});
