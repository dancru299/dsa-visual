import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { isValid, isValidBruteForce, Stack, traceBrackets, traceOps, type Op } from './algorithm';

const bracket = fc.constantFrom(...'()[]{}');
const bracketString = fc.array(bracket, { maxLength: 14 }).map((cs) => cs.join(''));

// Chuỗi ngoặc hợp lệ, sinh theo định nghĩa: rỗng, hoặc (A)B, [A]B, {A}B với A, B hợp lệ.
const { balanced } = fc.letrec<{ balanced: string }>((tie) => ({
  balanced: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constant(''),
    fc
      .tuple(fc.constantFrom('()', '[]', '{}'), tie('balanced'), tie('balanced'))
      .map(([pair, inner, rest]) => pair[0] + inner + pair[1] + rest),
  ),
}));

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.constantFrom('A', 'B', 'C', 'D').map((label): Op => ({ kind: 'push', label })),
  fc.constant<Op>({ kind: 'pop' }),
);

describe('Stack', () => {
  test('pop trả về theo thứ tự ngược với push (LIFO)', () => {
    const s = new Stack<string>();
    ['A', 'B', 'C'].forEach((x) => s.push(x));
    expect([s.pop(), s.pop(), s.pop(), s.pop()]).toEqual(['C', 'B', 'A', undefined]);
    expect(s.isEmpty()).toBe(true);
  });

  // So với một mô hình viết theo cách khác: danh sách mà phần tử mới nằm ở đầu.
  test('khớp với mô hình danh sách trên mọi dãy thao tác', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        const s = new Stack<string>();
        let model: string[] = [];
        for (const o of ops) {
          if (o.kind === 'push') {
            s.push(o.label);
            model = [o.label, ...model];
          } else {
            expect(s.pop()).toBe(model[0]);
            model = model.slice(1);
          }
          expect(s.size).toBe(model.length);
          expect(s.peek()).toBe(model[0]);
        }
      }),
      { numRuns: 1000 },
    );
  });
});

describe('trace thao tác stack', () => {
  test('mỗi lần pop lấy ra phần tử được push gần nhất mà chưa bị lấy ra', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
        const frames = traceOps([], ops);
        for (let k = 1; k < frames.length; k++) {
          const e = frames[k].event;
          if (e.kind === 'pop') expect(frames[k - 1].state.items.at(-1)).toEqual(e.item);
        }
      }),
      { numRuns: 500 },
    );
  });

  test('id của các phần tử không trùng nhau, kể cả khi nhãn trùng', () => {
    const last = traceOps(
      [],
      [
        { kind: 'push', label: '(' },
        { kind: 'push', label: '(' },
      ],
    ).at(-1)!.state;
    expect(last.items.map((x) => x.label)).toEqual(['(', '(']);
    expect(new Set(last.items.map((x) => x.id)).size).toBe(2);
  });

  test('pop trên stack rỗng là underflow và dừng trace', () => {
    const frames = traceOps([], [{ kind: 'pop' }, { kind: 'push', label: 'A' }]);
    expect(frames.at(-1)!.event.kind).toBe('underflow');
    expect(frames).toHaveLength(2);
  });
});

describe('isValid', () => {
  test('các ví dụ trong bài', () => {
    expect(isValid('{[()]}')).toBe(true);
    expect(isValid('([)]')).toBe(false);
    expect(isValid('(()')).toBe(false);
    expect(isValid(')(')).toBe(false);
    expect(isValid('')).toBe(true);
  });

  test('khớp với lời giải brute-force trên chuỗi ngoặc ngẫu nhiên', () => {
    fc.assert(
      fc.property(bracketString, (s) => {
        expect(isValid(s)).toBe(isValidBruteForce(s));
      }),
      { numRuns: 1000 },
    );
  });

  // Chuỗi ngẫu nhiên hầu như luôn sai. Test này buộc nhánh "hợp lệ" cũng được thử nhiều lần.
  test('mọi chuỗi sinh theo định nghĩa ngoặc hợp lệ đều được chấp nhận', () => {
    fc.assert(
      fc.property(balanced, (s) => {
        expect(isValid(s)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  test('bỏ một ký tự khỏi chuỗi hợp lệ thì không còn hợp lệ', () => {
    const withIndex = balanced
      .filter((s) => s.length > 0)
      .chain((s) => fc.tuple(fc.constant(s), fc.nat({ max: s.length - 1 })));
    fc.assert(
      fc.property(withIndex, ([s, k]) => {
        expect(isValid(s.slice(0, k) + s.slice(k + 1))).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('trace kiểm tra ngoặc', () => {
  test('kích thước stack không bao giờ âm và không vượt quá số ký tự đã đọc', () => {
    fc.assert(
      fc.property(bracketString, (s) => {
        for (const f of traceBrackets(s)) {
          const read = f.state.cursor === null ? s.length : f.state.cursor + 1;
          expect(f.state.items.length).toBeLessThanOrEqual(read);
        }
      }),
      { numRuns: 500 },
    );
  });

  test('ba cách một chuỗi bị sai có lý do riêng', () => {
    expect(traceBrackets('([)]').at(-1)!.state.reason).toBe('mismatch');
    expect(traceBrackets('(()').at(-1)!.state.reason).toBe('leftover');
    expect(traceBrackets(')(').at(-1)!.state.reason).toBe('underflow');
  });
});
