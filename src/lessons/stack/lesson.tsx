import { defineStep, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import {
  traceBrackets,
  traceOps,
  type BracketEvent,
  type BracketState,
  type Op,
  type OpEvent,
  type StackState,
} from './algorithm';
import { stackScene } from './StackScene';

// ---------- Code hiển thị trên trang ----------

const CODE_LIFO = ['stack = []', 'stack.append("A")', 'stack.append("B")', 'stack.append("C")'];
const CODE_PUSH = ['stack = ["A", "B", "C"]', 'stack.append("D")   # push'];
const CODE_POP = ['stack = ["A", "B", "C", "D"]', 'stack.pop()   # → "D"', 'stack.pop()   # → "C"'];
export const CODE_BRACKETS = [
  'def is_valid(s):',
  '    stack, pairs = [], {")": "(", "]": "[", "}": "{"}',
  '    for ch in s:',
  '        if ch in "([{":',
  '            stack.append(ch)',
  '        elif not stack or stack.pop() != pairs[ch]:',
  '            return False',
  '    return not stack',
];
const CODE_CALLS = [
  'def main():',
  '    run_pipeline()',
  '',
  'def run_pipeline():',
  '    load_table("orders")',
  '',
  'def load_table(name):',
  '    parse_row("1,alice,42")',
  '',
  'def parse_row(row):',
  '    return row.split(",")',
];

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const push = (label: string): Op => ({ kind: 'push', label });
const pop: Op = { kind: 'pop' };

const topLabel = (s: StackState) => s.items.at(-1)?.label ?? '—';

const opMetrics = (f: Frame<StackState, OpEvent>): Metric[] => [
  { label: 'Size', value: String(f.state.items.length) },
  { label: 'Top', value: topLabel(f.state) },
  {
    label: 'Thao tác cuối',
    value:
      f.event.kind === 'push'
        ? `push("${f.event.item.label}")`
        : f.event.kind === 'pop'
          ? `pop() → "${f.event.item.label}"`
          : '—',
  },
  { label: 'push / pop', value: 'O(1)', tone: 'good' },
];

// Lời dẫn cho các bước push, pop đơn giản. lines(k) là các dòng code ứng với thao tác thứ k.
function narrateOps(
  frames: Frame<StackState, OpEvent>[],
  lines: (k: number) => number[],
): Frame<StackState, OpEvent>[] {
  return frames.map((f, k) => {
    const e = f.event;
    const base = { ...f, metrics: opMetrics(f), codeLines: k > 0 ? lines(k) : [] };
    switch (e.kind) {
      case 'start':
        return { ...base, holdMs: 600 };
      case 'push':
        return { ...base, say: `push("${e.item.label}")`, holdMs: 950 };
      case 'pop':
        return { ...base, say: `pop() → "${e.item.label}"`, holdMs: 1100 };
      case 'underflow':
        return { ...base, say: 'IndexError: pop from empty list', sayTone: 'bad', holdMs: 1400 };
    }
  });
}

const bracketMetrics = (f: Frame<BracketState, BracketEvent>): Metric[] => {
  const s = f.state;
  const read = s.result !== null ? s.text.length : s.cursor === null ? 0 : s.cursor + 1;
  return [
    { label: 'Đã đọc', value: `${read} / ${s.text.length}` },
    { label: 'Size', value: String(s.items.length) },
    { label: 'Top', value: topLabel(s) },
    {
      label: 'Kết quả',
      value: s.result === null ? '…' : s.result ? 'hợp lệ' : 'sai',
      tone: s.result === null ? undefined : s.result ? 'good' : 'bad',
    },
  ];
};

type BracketAsks = { askTopAt?: number; askLeftover?: boolean };

function narrateBrackets(
  frames: Frame<BracketState, BracketEvent>[],
  asks: BracketAsks = {},
): Frame<BracketState, BracketEvent>[] {
  return frames.map((f, k) => {
    const { text } = f.state;
    const e = f.event;
    const base = { ...f, metrics: bracketMetrics(f) };
    switch (e.kind) {
      case 'start':
        return { ...base, codeLines: [2], holdMs: 700 };
      case 'read':
        return { ...base, say: `đọc ${text[e.i]}`, codeLines: [3], holdMs: 450 };
      case 'push':
        return { ...base, say: `${text[e.i]} là ngoặc mở → push`, codeLines: [4, 5], holdMs: 850 };
      case 'compare': {
        const ch = text[e.i];
        // Câu đoán: đỉnh stack đang là gì? Lấy ba loại ngoặc mở làm lựa chọn, đúng đặt đầu tiên.
        const ask =
          asks.askTopAt === e.i && e.top
            ? {
                prompt: `Đọc tới ${ch}. Phần tử ở đỉnh stack lúc này là gì?`,
                choices: [e.top, ...'([{'.split('').filter((c) => c !== e.top)],
                correct: 0,
                explain: `Ngoặc mở gần nhất chưa được đóng là ${e.top}. Đó chính là phần tử nằm trên cùng của stack.`,
              }
            : undefined;
        return {
          ...base,
          say: `${ch} cần ${PAIRS[ch]}, đỉnh là ${e.top}`,
          codeLines: [6],
          holdMs: 800,
          ask,
        };
      }
      case 'match':
        return { ...base, say: `khớp → pop`, codeLines: [6], holdMs: 750 };
      case 'mismatch':
        return {
          ...base,
          say: `KHÔNG HỢP LỆ: ${text[e.i]} không khớp ${e.top}`,
          sayTone: 'bad',
          codeLines: [7],
          holdMs: 2000,
        };
      case 'underflow':
        return {
          ...base,
          say: `KHÔNG HỢP LỆ: gặp ${text[e.i]} khi stack rỗng`,
          sayTone: 'bad',
          codeLines: [6, 7],
          holdMs: 2000,
        };
      case 'leftover': {
        const left = frames[k].state.items.at(-1)?.label ?? '';
        return {
          ...base,
          say: `KHÔNG HỢP LỆ: còn ${left} trong stack`,
          sayTone: 'bad',
          codeLines: [8],
          holdMs: 2000,
          ask: asks.askLeftover
            ? {
                prompt: `Đã đọc hết "${text}" nhưng stack còn ${left}. Chuỗi này có hợp lệ không?`,
                choices: ['Không, còn ngoặc mở chưa được đóng', 'Có, vì mọi ngoặc đóng đều khớp'],
                correct: 0,
                explain:
                  'Hợp lệ nghĩa là mọi ngoặc mở đều được đóng. Stack còn phần tử tức là còn ngoặc mở chưa có cặp, nên hàm trả về not stack = False.',
              }
            : undefined,
        };
      }
      case 'valid':
        return {
          ...base,
          say: 'HỢP LỆ: stack rỗng',
          sayTone: 'good',
          codeLines: [8],
          holdMs: 1400,
        };
    }
  });
}

// ---------- Trace dùng trong bài ----------

const LIFO = narrateOps(traceOps([], [push('A'), push('B'), push('C')]), (k) => [k + 1]);
const PUSH = narrateOps(traceOps(['A', 'B', 'C'], [push('D')]), () => [2]);
const POPS = narrateOps(traceOps(['A', 'B', 'C', 'D'], [pop, pop]), (k) => [k + 1]).map((f, k) =>
  k === 1 && f.event.kind === 'pop'
    ? {
        ...f,
        ask: {
          prompt: 'Stack là A, B, C, D, với D ở đỉnh. Gọi pop() một lần thì phần tử nào ra?',
          choices: [f.event.item.label, 'A', 'C'],
          correct: 0,
          explain: `pop() lấy phần tử ở đỉnh, tức là phần tử được push sau cùng: ${f.event.item.label}.`,
        },
      }
    : f,
);

export const VALID_TEXT = '{[()]}';
const VALID = narrateBrackets(traceBrackets(VALID_TEXT), { askTopAt: 4 });

export const INVALID_TEXTS = ['([)]', '(()', ')('];
const INVALID = INVALID_TEXTS.flatMap((text, n) =>
  narrateBrackets(traceBrackets(text, 100 * (n + 1)), { askLeftover: text === '(()' }),
);

const CALL_SEQUENCE: Op[] = [
  push('main()'),
  push('run_pipeline()'),
  push('load_table()'),
  push('parse_row()'),
  pop,
  pop,
  pop,
  pop,
];
const CALL_LINES = [[], [1], [2, 4], [5, 7], [8, 10], [11], [8], [5], [2]];

const CALLS: Frame<StackState, OpEvent>[] = traceOps([], CALL_SEQUENCE).map((f, k) => {
  const e = f.event;
  const running = topLabel(f.state);
  const say =
    e.kind === 'push'
      ? `gọi ${e.item.label}`
      : e.kind === 'pop'
        ? `${e.item.label} return`
        : undefined;
  const firstReturn = e.kind === 'pop' && k === CALL_SEQUENCE.indexOf(pop) + 1;
  return {
    ...f,
    say,
    codeLines: CALL_LINES[k],
    holdMs: k === 0 ? 600 : 950,
    metrics: [
      { label: 'Độ sâu', value: String(f.state.items.length) },
      { label: 'Đang chạy', value: running },
      { label: 'Sự kiện', value: say ?? '—' },
      { label: 'Giới hạn mặc định', value: '1000 tầng' },
    ],
    ask:
      firstReturn && e.kind === 'pop'
        ? {
            prompt: `${e.item.label} chạy xong và return. Hàm nào chạy tiếp?`,
            choices: [running, 'main()', 'run_pipeline()'].filter((c, i, a) => a.indexOf(c) === i),
            correct: 0,
            explain: `Frame của ${e.item.label} bị pop. Đỉnh stack giờ là ${running}: hàm đã gọi ${e.item.label} chạy tiếp từ chỗ nó đang dừng.`,
          }
        : undefined,
  };
});

// ---------- Scene ----------

const PoppedTray = 'ĐÃ POP (THEO THỨ TỰ LẤY RA)';
const LifoScene = stackScene({ file: 'stack.py', code: CODE_LIFO, tray: PoppedTray });
const PushScene = stackScene({ file: 'stack.py', code: CODE_PUSH, tray: PoppedTray });
const PopScene = stackScene({ file: 'stack.py', code: CODE_POP, tray: PoppedTray });
const BracketScene = stackScene({ file: 'is_valid.py', code: CODE_BRACKETS });
const CallScene = stackScene({
  file: 'pipeline.py',
  code: CODE_CALLS,
  tray: 'ĐÃ RETURN (THEO THỨ TỰ)',
});

const labels = (s: StackState) => s.items.map((x) => x.label).join(', ');

// ---------- Các bước ----------

const steps = [
  defineStep<StackState, OpEvent>({
    id: 'lifo',
    short: 'LIFO',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Stack: vào sau, ra trước',
    Scene: LifoScene,
    build: () => LIFO,
    Body: ({ frames }) => {
      const last = frames.at(-1)!.state;
      return (
        <>
          <p>
            Stack là một danh sách mà bạn <b>chỉ được đụng vào phần tử trên cùng</b> (gọi là top).
          </p>
          <p>
            Giống chồng đĩa: đĩa đặt lên sau cùng là đĩa được lấy ra đầu tiên. Quy tắc này gọi là{' '}
            <b>LIFO</b> (Last In, First Out: vào sau, ra trước).
          </p>
          <p>
            Vừa rồi ta đặt lần lượt {labels(last)}. {topLabel(last)} đang ở trên cùng.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: (
        <>
          Stack chỉ có hai thao tác chính: <b>push</b> (đặt lên đỉnh) và <b>pop</b> (lấy từ đỉnh).
        </>
      ),
    },
  }),

  defineStep<StackState, OpEvent>({
    id: 'push',
    short: 'push',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'push: đặt lên đỉnh',
    Scene: PushScene,
    build: () => PUSH,
    Body: ({ frames }) => {
      const before = frames[0].state;
      const after = frames.at(-1)!.state;
      return (
        <>
          <p>
            <code>push(&quot;{topLabel(after)}&quot;)</code> đặt {topLabel(after)} lên trên{' '}
            {topLabel(before)}. Không phần tử nào khác phải dịch chuyển.
          </p>
          <p>
            Vì chỉ chạm vào đỉnh, push tốn <b>O(1)</b>: stack có {after.items.length} hay 4 triệu
            phần tử thì chi phí như nhau. Nói chính xác là O(1) tính trung bình, vì list của Python
            thỉnh thoảng phải cấp phát lại bộ nhớ khi đầy.
          </p>
          <p>
            Trong Python, <code>list.append()</code> đóng vai trò push.
          </p>
        </>
      );
    },
  }),

  defineStep<StackState, OpEvent>({
    id: 'pop',
    short: 'pop',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'pop: lấy từ đỉnh',
    Scene: PopScene,
    build: () => POPS,
    Body: ({ frames }) => {
      const out = frames.at(-1)!.state.popped.map((x) => x.label);
      return (
        <>
          <p>
            <code>pop()</code> lấy phần tử trên cùng ra. Gọi hai lần: {out[0]} ra trước, rồi đến{' '}
            {out[1]}, <b>ngược với thứ tự đã push</b>.
          </p>
          <p>
            Muốn lấy A ở đáy thì phải pop hết mọi thứ phía trên nó. Đó là cái giá của LIFO; đổi lại
            pop cũng chỉ tốn <b>O(1)</b>.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'CẨN THẬN',
      text: (
        <>
          Gọi pop() trên stack rỗng là lỗi stack underflow. Python báo{' '}
          <code>IndexError: pop from empty list</code>, nên hãy kiểm tra stack trước khi pop.
        </>
      ),
    },
  }),

  defineStep<BracketState, BracketEvent>({
    id: 'ngoac-dung',
    short: 'Ngoặc đúng',
    tag: 'ỨNG DỤNG',
    tone: 'mint',
    title: 'Kiểm tra ngoặc bằng stack',
    Scene: BracketScene,
    build: () => VALID,
    Body: ({ frames }) => {
      const { text } = frames[0].state;
      return (
        <>
          <p>
            Đọc chuỗi <code>{text}</code> từ trái sang phải. Gặp ngoặc mở thì <b>push</b>. Gặp ngoặc
            đóng thì <b>pop</b> và kiểm tra có khớp cặp không.
          </p>
          <p>
            Ngoặc mở gần nhất phải được đóng trước tiên. Ngoặc mở gần nhất chính là phần tử trên
            cùng của stack, nên stack vừa khít với bài này.
          </p>
          <p>Đọc hết chuỗi mà stack rỗng: hợp lệ.</p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Trình phân tích cú pháp SQL làm việc tương tự khi đọc{' '}
          <code>WHERE (a = 1 AND (b = 2 OR c = 3))</code>: mỗi dấu mở ngoặc mở một nhóm điều kiện,
          mỗi dấu đóng ngoặc đóng nhóm gần nhất. Thiếu một dấu đóng là lỗi cú pháp ngay.
        </>
      ),
    },
  }),

  defineStep<BracketState, BracketEvent>({
    id: 'ngoac-sai',
    short: 'Ngoặc sai',
    tag: 'EDGE CASE',
    tone: 'rose',
    title: 'Ba cách một chuỗi ngoặc bị sai',
    Scene: BracketScene,
    build: () => INVALID,
    Body: () => (
      <>
        <p>
          <code>{INVALID_TEXTS[0]}</code>: push <code>(</code>, push <code>[</code>. Gặp{' '}
          <code>)</code> nhưng đỉnh stack là <code>[</code>: không khớp, dừng ngay và trả về False.
        </p>
        <p>
          <code>{INVALID_TEXTS[1]}</code>: mọi ngoặc đóng đều khớp, nhưng đọc hết chuỗi vẫn còn{' '}
          <code>(</code> trong stack. Cũng không hợp lệ.
        </p>
        <p>
          <code>{INVALID_TEXTS[2]}</code>: gặp ngoặc đóng khi stack đang rỗng, không có gì để so.
        </p>
      </>
    ),
    callout: {
      kind: 'warn',
      title: 'LỖI HAY GẶP',
      text: (
        <>
          Quên kiểm tra stack ở cuối hàm (<code>return not stack</code>). Khi đó{' '}
          <code>{INVALID_TEXTS[1]}</code> sẽ bị báo nhầm là hợp lệ.
        </>
      ),
    },
  }),

  defineStep<StackState, OpEvent>({
    id: 'call-stack',
    short: 'Call stack',
    tag: 'THỰC TẾ',
    tone: 'lav',
    title: 'Call stack: stack bạn dùng mỗi ngày',
    Scene: CallScene,
    build: () => CALLS,
    Body: ({ frames }) => {
      const order = frames.at(-1)!.state.popped.map((x) => x.label);
      return (
        <>
          <p>
            Mỗi lần gọi một hàm, Python push một <b>stack frame</b> (chứa biến cục bộ và chỗ để quay
            về). Hàm return thì frame đó bị pop.
          </p>
          <p>
            main() gọi run_pipeline(), rồi load_table(), rồi parse_row(). Thứ tự return là{' '}
            {order.join(' → ')}: hàm được gọi sau cùng return đầu tiên.
          </p>
          <p>
            Đệ quy quá sâu làm call stack quá dài. Python chặn lại bằng <code>RecursionError</code>;
            giới hạn mặc định của CPython là 1000 tầng, xem bằng{' '}
            <code>sys.getrecursionlimit()</code>. Mọi frame Python đang chạy đều được tính, nên số
            tầng đệ quy thực tế ít hơn 1000 một chút.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          Khi một task Airflow lỗi, log in ra traceback của Python, mở đầu bằng{' '}
          <code>Traceback (most recent call last)</code>. Đó chính là call stack lúc lỗi, in từ đáy
          lên đỉnh: dòng cuối là hàm được gọi sau cùng, thường là nơi lỗi xảy ra.
        </>
      ),
    },
  }),
];

export const stackLesson: Lesson = {
  slug: 'stack',
  steps,
  legend: [
    { swatch: 'lav', label: 'phần tử' },
    { swatch: 'sun', label: 'top' },
    { swatch: 'mint', label: 'khớp cặp' },
    { swatch: 'rose', label: 'lỗi' },
  ],
  objectives: [
    { text: 'Hiểu quy tắc LIFO', step: 0 },
    { text: 'push và pop đều O(1)', step: 2 },
    { text: 'Dùng stack để kiểm tra ngoặc', step: 3 },
    { text: 'Nhận ra các trường hợp ngoặc sai', step: 4 },
    { text: 'Hiểu call stack và RecursionError', step: 5 },
  ],
};
