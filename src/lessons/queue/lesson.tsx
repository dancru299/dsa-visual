import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import {
  tailOf,
  tracePopFront,
  traceQueue,
  traceRing,
  type QueueEvent,
  type QueueOp,
  type QueueState,
  type RingEvent,
  type RingOp,
  type RingState,
  type ShiftEvent,
  type ShiftState,
} from './algorithm';
import { queueScene, ringScene, shiftScene } from './scenes';
import { QUIZ } from './quiz';

// ---------- Code hiển thị trên trang ----------

const CODE_DEQUE = [
  'from collections import deque',
  '',
  'q = deque()',
  'q.append("e1")     # enqueue',
  'q.append("e2")',
  'q.append("e3")',
  'q.popleft()        # dequeue → "e1"',
  'q.popleft()        # → "e2"',
];

const CODE_POP0 = [
  'events = ["e1", "e2", "e3", "e4", "e5", "e6"]',
  'first = events.pop(0)',
  '# Python phải dời 5 phần tử còn lại sang trái',
  '',
  'from collections import deque',
  'q = deque(events)',
  'first = q.popleft()   # không phải dời gì',
];

export const CODE_RING = [
  'class RingBuffer:',
  '    def __init__(self, capacity):',
  '        self.buf = [None] * capacity',
  '        self.head = self.size = 0',
  '    def put(self, x):',
  '        if self.size == len(self.buf):',
  '            return False          # đầy',
  '        tail = (self.head + self.size) % len(self.buf)',
  '        self.buf[tail] = x',
  '        self.size += 1',
  '        return True',
  '    def get(self):',
  '        x = self.buf[self.head]',
  '        self.head = (self.head + 1) % len(self.buf)',
  '        self.size -= 1',
  '        return x',
];

const withAsk = <S, E>(frames: Frame<S, E>[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const enqueue = (label: string): QueueOp => ({ kind: 'enqueue', label });
const dequeue: QueueOp = { kind: 'dequeue' };
const put = (label: string): RingOp => ({ kind: 'put', label });
const get: RingOp = { kind: 'get' };

// ---------- Trace: queue ----------

function narrateQueue(
  frames: Frame<QueueState, QueueEvent>[],
  lines: (k: number) => number[],
): Frame<QueueState, QueueEvent>[] {
  return frames.map((f, k) => {
    const s = f.state;
    const e = f.event;
    const metrics: Metric[] = [
      { label: 'Size', value: String(s.items.length) },
      { label: 'Front', value: s.items[0]?.label ?? '—' },
      { label: 'Back', value: s.items.at(-1)?.label ?? '—' },
      { label: 'enqueue / dequeue', value: 'O(1)', tone: 'good' },
    ];
    const base = { ...f, metrics, codeLines: k > 0 ? lines(k) : [3] };
    switch (e.kind) {
      case 'start':
        return { ...base, holdMs: 700 };
      case 'enqueue':
        return { ...base, say: `enqueue ${e.item.label}: vào ở cuối`, holdMs: 1000 };
      case 'dequeue':
        return { ...base, say: `dequeue → ${e.item.label}: ra ở đầu`, holdMs: 1100 };
      case 'empty':
        return { ...base, say: 'queue rỗng', sayTone: 'bad', holdMs: 1200 };
    }
  });
}

const ENQUEUES = narrateQueue(traceQueue([], ['e1', 'e2', 'e3'].map(enqueue)), (k) => [3 + k]);

export const DEQUEUES = withAsk(
  narrateQueue(traceQueue(['e1', 'e2', 'e3'], [dequeue, dequeue]), (k) => [6 + k]),
  1,
  {
    prompt: 'Queue đang là e1, e2, e3, với e1 vào trước. Gọi dequeue() thì phần tử nào ra?',
    choices: ['e1', 'e3', 'e2'],
    correct: 0,
    explain:
      'Queue là FIFO: vào trước ra trước, nên e1 ra đầu tiên. Stack thì ngược lại: e3, phần tử vào sau cùng, sẽ ra trước.',
  },
);

// ---------- Trace: list.pop(0) ----------

export const POP_LABELS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];

export const SHIFTS = withAsk(
  tracePopFront(POP_LABELS).map((f): Frame<ShiftState, ShiftEvent> => {
    const s = f.state;
    const e = f.event;
    const metrics: Metric[] = [
      { label: 'Số phần tử', value: String(POP_LABELS.length) },
      { label: 'Đã dời', value: String(s.moves), tone: s.moves > 0 ? 'bad' : undefined },
      { label: 'list.pop(0)', value: 'O(n)', tone: 'bad' },
      { label: 'deque.popleft()', value: 'O(1)', tone: 'good' },
    ];
    switch (e.kind) {
      case 'start':
        return { ...f, metrics, codeLines: [1], holdMs: 900 };
      case 'remove':
        return {
          ...f,
          metrics,
          say: `lấy ${e.item.label} ra, ô [0] trống`,
          codeLines: [2],
          holdMs: 1000,
        };
      case 'shift':
        return {
          ...f,
          metrics,
          say: `dời ${s.slots[e.to]?.label} từ [${e.from}] sang [${e.to}]`,
          codeLines: [2, 3],
          holdMs: 650,
        };
      case 'done':
        return {
          ...f,
          metrics,
          say: `${s.moves} lần dời chỉ để lấy một phần tử ra`,
          sayTone: 'bad',
          codeLines: [5, 6, 7],
          holdMs: 1500,
        };
    }
  }),
  1,
  {
    prompt: `List có ${POP_LABELS.length} phần tử. pop(0) phải dời bao nhiêu phần tử sang trái?`,
    choices: [String(POP_LABELS.length - 1), '1', '0'],
    correct: 0,
    explain: `List của Python là một mảng liền nhau. Lấy phần tử đầu ra thì ${POP_LABELS.length - 1} phần tử còn lại phải dời lên một ô để lấp chỗ trống: O(n).`,
  },
);

// ---------- Trace: ring buffer ----------

const ringMetrics = (s: RingState, e: RingEvent): Metric[] => [
  {
    label: 'Size',
    value: `${s.size}/${s.capacity}`,
    tone: s.size === s.capacity ? 'bad' : undefined,
  },
  { label: 'head', value: String(s.head) },
  { label: 'tail', value: String(tailOf(s)) },
  {
    label: 'Thao tác cuối',
    value:
      e.kind === 'put'
        ? `put(${e.item.label}) → [${e.slot}]`
        : e.kind === 'get'
          ? `get() → ${e.item.label}`
          : e.kind === 'full'
            ? `put(${e.item.label}): đầy`
            : '—',
  },
];

function narrateRing(frames: Frame<RingState, RingEvent>[]): Frame<RingState, RingEvent>[] {
  return frames.map((f) => {
    const e = f.event;
    const base = { ...f, metrics: ringMetrics(f.state, e) };
    switch (e.kind) {
      case 'start':
        return { ...base, codeLines: [3, 4], holdMs: 800 };
      case 'put':
        return {
          ...base,
          say: `put ${e.item.label} vào ô [${e.slot}]`,
          codeLines: [8, 9, 10],
          holdMs: 1000,
        };
      case 'get':
        return {
          ...base,
          say: `get → ${e.item.label}, head sang ô kế`,
          codeLines: [13, 14, 15],
          holdMs: 1000,
        };
      case 'full':
        return {
          ...base,
          say: `đầy: chưa ghi được ${e.item.label}`,
          sayTone: 'bad',
          codeLines: [6, 7],
          holdMs: 1500,
        };
      case 'empty':
        return { ...base, say: 'rỗng: chưa có gì để đọc', codeLines: [13], holdMs: 1200 };
    }
  });
}

export const WRAP_OPS: RingOp[] = [
  put('e1'),
  put('e2'),
  put('e3'),
  put('e4'),
  get,
  get,
  put('e5'),
  put('e6'),
  put('e7'),
];
export const WRAP_CAPACITY = 6;
const WRAP_RAW = traceRing(WRAP_CAPACITY, WRAP_OPS);

export const WRAP = narrateRing(WRAP_RAW).map((f, k, all) => {
  const e = f.event;
  // Câu đoán: lần ghi đầu tiên sau khi tail đã quay về 0.
  const prev = all[k - 1]?.event;
  const wrapped =
    e.kind === 'put' && e.slot === 0 && prev?.kind === 'put' && prev.slot === WRAP_CAPACITY - 1;
  return wrapped
    ? {
        ...f,
        ask: {
          prompt: `Ô cuối, index ${WRAP_CAPACITY - 1}, vừa được ghi. Phần tử tiếp theo ghi vào index nào?`,
          choices: ['0', String(WRAP_CAPACITY), String(f.state.head)].filter(
            (c, i, a) => a.indexOf(c) === i,
          ),
          correct: 0,
          explain: `tail = (head + size) % ${WRAP_CAPACITY}, nên sau ô ${WRAP_CAPACITY - 1} là ô 0: quay lại đầu mảng. Ô 0 và 1 đang trống vì e1, e2 đã được lấy ra. Không cần dời phần tử nào.`,
        },
      }
    : f;
});

export const PRESSURE_CAPACITY = 4;
export const PRESSURE_OPS: RingOp[] = [
  put('e1'),
  put('e2'),
  get,
  put('e3'),
  put('e4'),
  get,
  put('e5'),
  put('e6'),
  get,
  put('e7'),
  put('e8'),
  get,
  put('e8'),
];

export const PRESSURE = narrateRing(traceRing(PRESSURE_CAPACITY, PRESSURE_OPS)).map((f, k, all) => {
  const blocked = all.slice(0, k + 1).filter((x) => x.event.kind === 'full').length;
  const metrics: Metric[] = [
    {
      label: 'Size',
      value: `${f.state.size}/${f.state.capacity}`,
      tone: f.state.size === f.state.capacity ? 'bad' : undefined,
    },
    {
      label: 'Producer',
      value: f.state.waiting ? 'phải chờ' : 'chạy',
      tone: f.state.waiting ? 'bad' : 'good',
    },
    { label: 'Consumer đã đọc', value: String(f.state.out.length) },
    { label: 'Lần put phải chờ', value: String(blocked) },
  ];
  const ask: Ask | undefined =
    f.event.kind === 'full'
      ? {
          prompt: `Buffer ${f.state.size}/${f.state.capacity} đã đầy, producer muốn ghi ${f.event.item.label}. Nếu buffer là queue.Queue(maxsize=${PRESSURE_CAPACITY}) của Python, put() làm gì?`,
          choices: ['Chờ tới khi consumer lấy bớt', 'Ghi đè phần tử cũ nhất', 'Báo lỗi ngay'],
          correct: 0,
          explain:
            'Mặc định put() của queue.Queue chặn lại cho tới khi có chỗ trống, nên producer bị kéo chậm theo tốc độ của consumer. Đó là backpressure. Muốn báo lỗi ngay thì dùng put_nowait(), nó ném queue.Full.',
        }
      : undefined;
  return { ...f, metrics, ask };
});

// Bảng trace cho bước tóm tắt: mỗi thao tác của bước 4 là một hàng.
function toRingTable(frames: Frame<RingState, RingEvent>[]): Frame<CodeTraceState, RingEvent>[] {
  const rows: string[][] = [];
  return frames.map((f) => {
    const e = f.event;
    const s = f.state;
    if (e.kind === 'put')
      rows.push([
        `put(${e.item.label})`,
        `[${e.slot}]`,
        String(s.head),
        String(tailOf(s)),
        String(s.size),
      ]);
    if (e.kind === 'get')
      rows.push([
        `get() → ${e.item.label}`,
        `[${e.slot}]`,
        String(s.head),
        String(tailOf(s)),
        String(s.size),
      ]);
    return {
      state: { rows: rows.map((r) => [...r]) },
      event: e,
      codeLines: f.codeLines,
      holdMs: e.kind === 'start' ? 700 : 850,
      metrics: [
        { label: 'Thao tác', value: String(rows.length) },
        { label: 'Phần tử phải dời', value: '0', tone: 'good' },
        { label: 'put / get', value: 'O(1)', tone: 'good' },
        { label: 'Dung lượng', value: `${s.capacity} ô, cố định` },
      ],
    };
  });
}

const RECAP = toRingTable(narrateRing(WRAP_RAW));

// ---------- Scene ----------

const DequeScene = queueScene({ code: { file: 'queue.py', lines: CODE_DEQUE } });
const PopScene = shiftScene({ code: { file: 'pop_front.py', lines: CODE_POP0 } });
const WrapScene = ringScene({ code: { file: 'ring_buffer.py', lines: CODE_RING }, roles: false });
const PressureScene = ringScene({
  code: { file: 'ring_buffer.py', lines: CODE_RING },
  roles: true,
});
const RecapScene = codeTraceScene({
  file: 'ring_buffer.py',
  code: CODE_RING,
  columns: ['thao tác', 'ô', 'head', 'tail', 'size'],
  title: 'TRACE CỦA BƯỚC 4',
});

// ---------- Các bước ----------

const steps = [
  defineStep<QueueState, QueueEvent>({
    id: 'fifo',
    short: 'FIFO',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Queue: vào trước, ra trước',
    Scene: DequeScene,
    build: () => ENQUEUES,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Queue là hàng đợi: phần tử mới <b>vào ở cuối</b> (back), phần tử cũ nhất <b>ra ở đầu</b>{' '}
            (front). Quy tắc này gọi là <b>FIFO</b> (First In, First Out: vào trước, ra trước).
          </p>
          <p>
            Ba event {s.items.map((x) => x.label).join(', ')} vừa vào theo thứ tự đó.{' '}
            {s.items[0].label} đứng đầu hàng, sẽ được xử lý trước tiên.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Queue là bộ đệm giữa nơi tạo dữ liệu (producer) và nơi xử lý (consumer). Ví dụ, Airflow với CeleryExecutor đưa task vào hàng đợi trên Redis hoặc RabbitMQ, rồi các worker lấy ra chạy dần.',
    },
  }),

  defineStep<QueueState, QueueEvent>({
    id: 'dequeue',
    short: 'dequeue',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'dequeue: lấy ra ở đầu',
    Scene: DequeScene,
    build: () => DEQUEUES,
    Body: ({ frames }) => {
      const out = frames.at(-1)!.state.out.map((x) => x.label);
      return (
        <>
          <p>
            Gọi dequeue hai lần: {out[0]} ra trước, rồi {out[1]}, <b>đúng thứ tự đã vào</b>. Với
            stack thì thứ tự này ngược lại.
          </p>
          <p>
            Trong Python, dùng <code>collections.deque</code>: <code>append()</code> để enqueue,{' '}
            <code>popleft()</code> để dequeue. Cả hai đều O(1).
          </p>
        </>
      );
    },
  }),

  defineStep<ShiftState, ShiftEvent>({
    id: 'pop-0',
    short: 'Bẫy pop(0)',
    tag: 'CẠM BẪY',
    tone: 'rose',
    title: 'Vì sao không dùng list.pop(0)',
    Scene: PopScene,
    build: () => SHIFTS,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            List của Python là một mảng liền nhau trong bộ nhớ. Lấy phần tử đầu bằng{' '}
            <code>pop(0)</code> thì để lại một ô trống ở đầu, và Python phải{' '}
            <b>dời {s.moves} phần tử còn lại</b> lên một ô.
          </p>
          <p>
            List càng dài, mỗi lần pop(0) càng chậm: O(n). <code>deque</code> lưu theo cách khác nên{' '}
            <code>popleft()</code> không phải dời gì, chỉ O(1).
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'LỖI HAY GẶP',
      text: 'Dùng list làm queue rồi gọi pop(0) trong vòng lặp xử lý hàng triệu event: mỗi lần O(n), cả vòng lặp thành O(n²). Đổi sang deque là xong.',
    },
  }),

  defineStep<RingState, RingEvent>({
    id: 'ring',
    short: 'Ring buffer',
    tag: 'Ý TƯỞNG',
    tone: 'lav',
    title: 'Ring buffer: mảng cố định, đầu và cuối quay vòng',
    Scene: WrapScene,
    build: () => WRAP,
    Body: ({ frames }) => {
      const s = frames.at(-1)!.state;
      return (
        <>
          <p>
            Ring buffer là một queue trên mảng có <b>{s.capacity} ô cố định</b>. <b>head</b> chỉ ô
            sẽ đọc, <b>tail</b> chỉ ô sẽ ghi. Đọc hay ghi xong thì con trỏ tiến một ô.
          </p>
          <p>
            Tới ô cuối, con trỏ <b>quay về ô 0</b> nhờ phép <code>% capacity</code>. Các ô đầu đã
            được đọc nên trống, ghi lại được. Không phần tử nào phải dời.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Không dời phần tử, không cấp phát thêm bộ nhớ: put và get đều O(1). Đổi lại, dung lượng cố định, nên phải quyết định làm gì khi đầy.',
    },
  }),

  defineStep<RingState, RingEvent>({
    id: 'backpressure',
    short: 'Khi đầy',
    tag: 'EDGE CASE',
    tone: 'peach',
    title: 'Producer nhanh hơn consumer: backpressure',
    Scene: PressureScene,
    build: () => PRESSURE,
    Body: ({ frames }) => {
      const blocked = frames.filter((f) => f.event.kind === 'full').length;
      return (
        <>
          <p>
            Producer ghi 2 event mỗi nhịp, consumer chỉ đọc được 1. Buffer {PRESSURE_CAPACITY} ô đầy
            dần, và producer phải chờ {blocked} lần.
          </p>
          <p>
            Khi đầy chỉ có ba lựa chọn: <b>chờ</b> (producer chậm lại theo consumer), <b>bỏ bớt</b>{' '}
            dữ liệu, hoặc <b>ghi đè</b> phần tử cũ nhất. Chờ là lựa chọn an toàn nhất khi không được
            mất dữ liệu, và việc phía sau đẩy ngược áp lực lên phía trước như vậy gọi là{' '}
            <b>backpressure</b>.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: 'Flink truyền dữ liệu giữa các task qua những buffer có giới hạn. Khi buffer phía sau đầy, task phía trước phải chậm lại, và giao diện Flink báo task đó đang bị backpressure. Kafka thì khác: dữ liệu nằm trên đĩa, producer không phải chờ consumer, phần chênh lệch hiện ra thành consumer lag.',
    },
  }),

  defineStep<CodeTraceState, RingEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'sun',
    title: 'Code và những gì cần nhớ',
    Scene: RecapScene,
    build: () => RECAP,
    Body: () => (
      <>
        <p>
          Code bên trái là ring buffer của bước 4. Bảng trace ghi lại từng put, get cùng giá trị
          head, tail và size sau mỗi thao tác.
        </p>
        <p>
          Ba điều cần nhớ: queue là <b>FIFO</b>; trong Python dùng <code>deque</code>, đừng dùng{' '}
          <code>list.pop(0)</code>; buffer có giới hạn thì phải chọn cách xử lý khi đầy, và{' '}
          <b>chờ</b> tạo ra backpressure.
        </p>
      </>
    ),
  }),
];

export const queueLesson: Lesson = {
  slug: 'queue',
  steps,
  legend: [
    { swatch: 'sky', label: 'head: ô sẽ đọc' },
    { swatch: 'rose', label: 'tail: ô sẽ ghi' },
    { swatch: 'sun', label: 'producer, consumer đang làm' },
    { dashed: true, label: 'ô trống' },
  ],
  objectives: [
    { text: 'Hiểu quy tắc FIFO', step: 1 },
    { text: 'Biết vì sao dùng deque thay cho list.pop(0)', step: 2 },
    { text: 'Hiểu ring buffer quay vòng bằng % capacity', step: 3 },
    { text: 'Giải thích backpressure khi buffer đầy', step: 4 },
  ],
  quiz: QUIZ,
};
