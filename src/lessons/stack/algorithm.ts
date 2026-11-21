import type { Frame } from '@/src/engine/types';

// ---------- Cấu trúc dữ liệu ----------

// Stack dựa trên mảng: đỉnh là phần tử cuối mảng, nên push và pop đều O(1).
export class Stack<T> {
  private items: T[] = [];

  push(x: T): void {
    this.items.push(x);
  }

  // Trả về undefined khi stack rỗng. Python thì báo IndexError: pop from empty list.
  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items.at(-1);
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

// ---------- Trace cho scene "ống stack" ----------

// Mỗi phần tử có id riêng: hai dấu "(" trùng nhãn vẫn là hai phần tử khác nhau,
// và Motion cần id ổn định để biết phần tử nào vừa vào, phần tử nào vừa ra.
export type StackItem = { id: number; label: string };

export type StackState = {
  items: StackItem[]; // từ đáy lên đỉnh
  popped: StackItem[]; // các phần tử đã lấy ra, theo thứ tự lấy ra
  mark: { id: number; kind: 'ok' | 'bad' } | null; // phần tử đỉnh đang được so khớp
};

export type Op = { kind: 'push'; label: string } | { kind: 'pop' };

export type OpEvent =
  | { kind: 'start' }
  | { kind: 'push'; item: StackItem }
  | { kind: 'pop'; item: StackItem }
  | { kind: 'underflow' };

// Chạy một dãy push, pop bắt đầu từ các phần tử có sẵn, ghi lại state sau mỗi thao tác.
export function traceOps(
  initial: readonly string[],
  ops: readonly Op[],
  idBase = 0,
): Frame<StackState, OpEvent>[] {
  let nextId = idBase;
  const s: StackState = {
    items: initial.map((label) => ({ id: nextId++, label })),
    popped: [],
    mark: null,
  };
  const frames: Frame<StackState, OpEvent>[] = [];
  const snap = (event: OpEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (const op of ops) {
    if (op.kind === 'push') {
      const item = { id: nextId++, label: op.label };
      s.items.push(item);
      snap({ kind: 'push', item });
    } else {
      const item = s.items.pop();
      if (!item) {
        snap({ kind: 'underflow' });
        return frames;
      }
      s.popped.push(item);
      snap({ kind: 'pop', item });
    }
  }
  return frames;
}

// ---------- Kiểm tra ngoặc ----------

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const OPENERS = '([{';

export type TokenState =
  | { kind: 'idle' }
  | { kind: 'open' } // đã push, chưa được đóng
  | { kind: 'matched'; opener: string } // đã khớp cặp; opener để tô cùng màu với ngoặc mở
  | { kind: 'bad' };

export type BracketState = StackState & {
  text: string;
  cursor: number | null; // ký tự đang đọc
  tokens: TokenState[];
  result: boolean | null; // null khi chưa đọc xong
  reason: 'mismatch' | 'underflow' | 'leftover' | null;
};

export type BracketEvent =
  | { kind: 'start' }
  | { kind: 'read'; i: number }
  | { kind: 'push'; i: number }
  | { kind: 'compare'; i: number; top: string | null } // gặp ngoặc đóng, nhìn đỉnh stack
  | { kind: 'match'; i: number; j: number } // pop, khớp với ngoặc mở ở vị trí j
  | { kind: 'mismatch'; i: number; top: string }
  | { kind: 'underflow'; i: number }
  | { kind: 'valid' }
  | { kind: 'leftover'; open: number };

// Chuỗi chỉ gồm các ký tự ()[]{}. Ghi lại từng lần đọc, push, so khớp và kết luận.
export function traceBrackets(text: string, idBase = 0): Frame<BracketState, BracketEvent>[] {
  let nextId = idBase;
  const s: BracketState = {
    items: [],
    popped: [],
    mark: null,
    text,
    cursor: null,
    tokens: [...text].map((): TokenState => ({ kind: 'idle' })),
    result: null,
    reason: null,
  };
  const openAt: number[] = []; // vị trí trong chuỗi của từng phần tử trong stack
  const frames: Frame<BracketState, BracketEvent>[] = [];
  const snap = (event: BracketEvent) => frames.push({ state: structuredClone(s), event });

  snap({ kind: 'start' });
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    s.cursor = i;
    s.mark = null;
    snap({ kind: 'read', i });

    if (OPENERS.includes(ch)) {
      s.items.push({ id: nextId++, label: ch });
      openAt.push(i);
      s.tokens[i] = { kind: 'open' };
      snap({ kind: 'push', i });
      continue;
    }

    const top = s.items.at(-1);
    if (!top) {
      s.tokens[i] = { kind: 'bad' };
      s.result = false;
      s.reason = 'underflow';
      s.cursor = null;
      snap({ kind: 'underflow', i });
      return frames;
    }

    const ok = top.label === PAIRS[ch];
    s.mark = { id: top.id, kind: ok ? 'ok' : 'bad' };
    snap({ kind: 'compare', i, top: top.label });

    const item = s.items.pop()!;
    const j = openAt.pop()!;
    s.popped.push(item);
    s.mark = null;
    if (!ok) {
      s.tokens[i] = { kind: 'bad' };
      s.tokens[j] = { kind: 'bad' };
      s.result = false;
      s.reason = 'mismatch';
      s.cursor = null;
      snap({ kind: 'mismatch', i, top: item.label });
      return frames;
    }
    s.tokens[i] = { kind: 'matched', opener: item.label };
    s.tokens[j] = { kind: 'matched', opener: item.label };
    snap({ kind: 'match', i, j });
  }

  s.cursor = null;
  if (s.items.length > 0) {
    for (const j of openAt) s.tokens[j] = { kind: 'bad' };
    s.result = false;
    s.reason = 'leftover';
    snap({ kind: 'leftover', open: s.items.length });
  } else {
    s.result = true;
    snap({ kind: 'valid' });
  }
  return frames;
}

// Hàm mà property test kiểm tra, suy ra từ chính trace được hiển thị.
export function isValid(text: string): boolean {
  return traceBrackets(text).at(-1)!.state.result!;
}

// Lời giải brute-force để so sánh: xoá dần các cặp "()", "[]", "{}" đứng cạnh nhau.
// Chuỗi hợp lệ khi và chỉ khi xoá được hết. Chậm, O(n²), nhưng khó viết sai.
export function isValidBruteForce(text: string): boolean {
  let s = text;
  for (;;) {
    const next = s.replaceAll('()', '').replaceAll('[]', '').replaceAll('{}', '');
    if (next === s) return s.length === 0;
    s = next;
  }
}
