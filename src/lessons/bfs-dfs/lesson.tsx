import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import { graphScene, type GraphLayout } from '@/src/scenes/GraphScene';
import {
  childrenOf,
  parentsOf,
  shortestHopsBruteForce,
  traceBfs,
  traceDfs,
  traceRead,
  type Graph,
  type WalkEvent,
  type WalkState,
} from './algorithm';
import { QUIZ } from './quiz';

// ---------- Dữ liệu ----------

// Lineage kiểu một project dbt: một bảng nguồn, staging, fact, rồi các báo cáo.
// dau_report tới được bằng hai đường, để thấy vai trò của seen.
export const GRAPH: Graph = {
  raw_events: ['stg_sessions', 'stg_clicks'],
  stg_sessions: ['fct_sessions'],
  stg_clicks: ['fct_clicks'],
  fct_sessions: ['retention', 'dau_report'],
  fct_clicks: ['dau_report', 'ctr_report'],
};
export const SOURCE = 'raw_events';
export const TABLES = [
  'raw_events',
  'stg_sessions',
  'stg_clicks',
  'fct_sessions',
  'fct_clicks',
  'retention',
  'dau_report',
  'ctr_report',
];
export const LIMIT = 2;
const EDGES = Object.entries(GRAPH).flatMap(([from, tos]) => tos.map((to) => ({ from, to })));
const DIST = shortestHopsBruteForce(GRAPH, SOURCE);

// Vị trí node đặt tay theo từng lớp. Khung rộng: các lớp xếp từ trái sang phải.
const WIDE: GraphLayout = {
  width: 576,
  height: 220,
  nodeWidth: 108,
  bend: 26,
  nodes: [
    { id: 'raw_events', label: 'raw_events', x: 62, y: 110 },
    { id: 'stg_sessions', label: 'stg_sessions', x: 212, y: 75 },
    { id: 'stg_clicks', label: 'stg_clicks', x: 212, y: 145 },
    { id: 'fct_sessions', label: 'fct_sessions', x: 362, y: 75 },
    { id: 'fct_clicks', label: 'fct_clicks', x: 362, y: 145 },
    { id: 'retention', label: 'retention', x: 512, y: 40 },
    { id: 'dau_report', label: 'dau_report', x: 512, y: 110 },
    { id: 'ctr_report', label: 'ctr_report', x: 512, y: 180 },
  ],
  edges: EDGES,
};

// Khung hẹp (điện thoại): các lớp xếp từ trên xuống, mỗi lớp nhiều nhất 3 bảng.
const NARROW: GraphLayout = {
  width: 324,
  height: 272,
  flow: 'down',
  nodeWidth: 96,
  nodeHeight: 32,
  bend: 16,
  nodes: [
    { id: 'raw_events', label: 'raw_events', x: 162, y: 30 },
    { id: 'stg_sessions', label: 'stg_sessions', x: 108, y: 100 },
    { id: 'stg_clicks', label: 'stg_clicks', x: 216, y: 100 },
    { id: 'fct_sessions', label: 'fct_sessions', x: 108, y: 170 },
    { id: 'fct_clicks', label: 'fct_clicks', x: 216, y: 170 },
    { id: 'retention', label: 'retention', x: 56, y: 240 },
    { id: 'dau_report', label: 'dau_report', x: 162, y: 240 },
    { id: 'ctr_report', label: 'ctr_report', x: 268, y: 240 },
  ],
  edges: EDGES,
};

// ---------- Code hiển thị trên trang ----------

// Dict của graph sinh từ chính GRAPH, nên code và hình luôn khớp.
const KEYS = Object.keys(GRAPH);
const KEY_WIDTH = Math.max(...KEYS.map((k) => k.length)) + 3;
export const CODE_GRAPH = [
  'graph = {',
  ...KEYS.map(
    (k) => `    ${`'${k}':`.padEnd(KEY_WIDTH)} [${GRAPH[k].map((c) => `'${c}'`).join(', ')}],`,
  ),
  '}',
  '',
  'for table in tables:',
  '    children = graph.get(table, [])',
];
const READ_LOOP = KEYS.length + 4; // dòng "for table in tables:"

export const CODE_BFS = [
  'from collections import deque',
  '',
  'def bfs(graph, source):',
  '    seen = {source}',
  '    queue = deque([source])',
  '    depth = {source: 0}',
  '    while queue:',
  '        table = queue.popleft()',
  '        for child in graph.get(table, []):',
  '            if child not in seen:',
  '                seen.add(child)',
  '                depth[child] = depth[table] + 1',
  '                queue.append(child)',
  '    return depth',
];

export const CODE_DFS = [
  'def dfs(graph, table, seen, order):',
  '    seen.add(table)',
  '    order.append(table)',
  '    for child in graph.get(table, []):',
  '        if child not in seen:',
  '            dfs(graph, child, seen, order)',
  '',
  'order = []',
  `dfs(graph, '${SOURCE}', set(), order)`,
];

const CODE_NO_SEEN = [
  'from collections import deque',
  '',
  'def bfs_no_seen(graph, source):',
  '    queue = deque([source])',
  '    order = []',
  '    while queue:',
  '        table = queue.popleft()',
  '        order.append(table)',
  '        for child in graph.get(table, []):',
  '            queue.append(child)       # không kiểm tra đã thấy chưa',
  '    return order',
];

const CODE_LIMIT = [
  'from collections import deque',
  '',
  'def select_plus(graph, source, n):   # dbt --select "source+n"',
  '    seen, queue = {source}, deque([source])',
  '    depth = {source: 0}',
  '    while queue:',
  '        table = queue.popleft()',
  '        if depth[table] == n:',
  '            continue                  # đủ n bước, không đi tiếp',
  '        for child in graph.get(table, []):',
  '            if child not in seen:',
  '                seen.add(child)',
  '                depth[child] = depth[table] + 1',
  '                queue.append(child)',
  '    return list(depth)',
];

const CODE_BOTH = [
  'def bfs(graph, source):',
  '    seen, queue, order = {source}, deque([source]), []',
  '    while queue:',
  '        table = queue.popleft()           # queue: lấy ở đầu',
  '        order.append(table)',
  '        for child in graph.get(table, []):',
  '            if child not in seen:',
  '                seen.add(child)',
  '                queue.append(child)',
  '    return order',
  '',
  'def dfs(graph, table, seen, order):     # call stack: đi sâu',
  '    seen.add(table)',
  '    order.append(table)',
  '    for child in graph.get(table, []):',
  '        if child not in seen:',
  '            dfs(graph, child, seen, order)',
];

// ---------- Tiện ích ----------

type F = Frame<WalkState, WalkEvent>;

const withAsk = (frames: F[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

const currentOf = (s: WalkState) => Object.keys(s.marks).find((n) => s.marks[n] === 'current');

// Lời dẫn chung cho các biến thể BFS (bước 2, 4, 5).
function narrateBfs(
  frames: F[],
  lines: (e: WalkEvent) => number[],
  metrics: (f: F) => Metric[],
): F[] {
  return frames.map((f) => {
    const e = f.event;
    const s = f.state;
    const base = { ...f, codeLines: lines(e), metrics: metrics(f) };
    switch (e.kind) {
      case 'start':
        return {
          ...base,
          say: `${e.source} vừa đổi schema. Bảng nào phía sau bị ảnh hưởng?`,
          holdMs: 1400,
        };
      case 'dequeue':
        return {
          ...base,
          say: `lấy ${e.node} ra khỏi queue, cách nguồn ${s.badges[e.node]} bước`,
          holdMs: 1000,
        };
      case 'discover':
        return e.again
          ? {
              ...base,
              say: `${e.to} đã vào queue rồi, nhưng không có seen nên thêm lần nữa`,
              sayTone: 'bad',
              holdMs: 1400,
            }
          : {
              ...base,
              say: `${e.to} chưa thấy → vào cuối queue, cách nguồn ${s.badges[e.to]} bước`,
              holdMs: 1000,
            };
      case 'skip':
        return { ...base, say: `${e.to} đã thấy rồi → bỏ qua`, holdMs: 1000 };
      case 'cut':
        return {
          ...base,
          say: `${e.node} cách nguồn ${e.depth} bước = n: không đi tiếp`,
          holdMs: 1300,
        };
      case 'finish':
        return { ...base, holdMs: 400 };
      default:
        return { ...base, holdMs: 1500 };
    }
  });
}

// ---------- Bước 1: đọc graph ----------

export const READ = (() => {
  const total = EDGES.length;
  const frames = traceRead(GRAPH, TABLES).map((f, k, all): F => {
    const e = f.event;
    const edgesRead = all
      .slice(0, k + 1)
      .reduce((n, x) => n + (x.event.kind === 'read' ? x.event.children.length : 0), 0);
    const metrics: Metric[] = [
      { label: 'Số bảng (V)', value: String(TABLES.length) },
      { label: 'Cạnh đã đọc (E)', value: `${edgesRead}/${total}` },
      { label: 'Đang đọc', value: e.kind === 'read' ? e.node : '—' },
      { label: 'Bảng con', value: e.kind === 'read' ? String(e.children.length) : '—' },
    ];
    if (e.kind === 'read') {
      const keyLine = KEYS.indexOf(e.node) + 2;
      return {
        ...f,
        metrics,
        codeLines: keyLine > 1 ? [keyLine, READ_LOOP, READ_LOOP + 1] : [READ_LOOP, READ_LOOP + 1],
        say:
          e.children.length > 0
            ? `${e.node} → ${e.children.join(', ')}`
            : `${e.node}: không bảng nào dùng nó, graph.get trả về []`,
        holdMs: 1300,
      };
    }
    return {
      ...f,
      metrics,
      codeLines: e.kind === 'start' ? [1] : [],
      say:
        e.kind === 'start'
          ? `lineage: ${TABLES.length} bảng, mũi tên chỉ hướng dữ liệu chảy`
          : `${TABLES.length} bảng, ${total} cạnh, lưu trong một dict`,
      sayTone: e.kind === 'done' ? 'good' : undefined,
      holdMs: 1400,
    };
  });
  // Câu đoán ở bảng đầu tiên không có bảng con nhưng có từ hai bảng nguồn trở lên.
  const k = frames.findIndex(
    (f) =>
      f.event.kind === 'read' &&
      f.event.children.length === 0 &&
      parentsOf(GRAPH, f.event.node).length >= 2,
  );
  const node = (frames[k].event as Extract<WalkEvent, { kind: 'read' }>).node;
  const parents = parentsOf(GRAPH, node);
  return withAsk(frames, k, {
    prompt: `graph.get('${node}', []) trả về [], nhưng ${node} lấy dữ liệu từ ${parents.length} bảng. Muốn biết các bảng nguồn đó thì làm sao?`,
    choices: [
      'Duyệt danh sách của mọi bảng, hoặc dựng thêm một graph đảo chiều',
      `Đọc graph['${node}']`,
      'Không biết được từ graph này',
    ],
    correct: 0,
    explain: `graph chỉ lưu mũi tên đi ra. Mũi tên đi vào ${node} nằm trong danh sách của ${parents.join(' và ')}, nên phải duyệt mọi danh sách: O(V + E). Hay tra ngược thì nên dựng sẵn một graph đảo chiều.`,
  });
})();

// ---------- Bước 2: BFS ----------

const bfsMetrics = (f: F): Metric[] => {
  const cur = currentOf(f.state);
  return [
    { label: 'Đang xử lý', value: cur ?? '—' },
    { label: 'Trong queue', value: String(f.state.pending.length) },
    { label: 'Lớp (số bước)', value: cur === undefined ? '—' : String(f.state.badges[cur]) },
    { label: 'Đã lấy ra', value: String(f.state.order.length) },
  ];
};

function bfsLines(e: WalkEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [4, 5, 6];
    case 'dequeue':
      return [7, 8];
    case 'discover':
      return [9, 10, 11, 12, 13];
    case 'skip':
      return [9, 10];
    case 'done':
      return [14];
    default:
      return [];
  }
}

const BFS_RAW = traceBfs(GRAPH, SOURCE);

export const BFS = (() => {
  const frames = narrateBfs(BFS_RAW, bfsLines, bfsMetrics);
  const order = BFS_RAW.at(-1)!.state.order;
  setSay(
    frames,
    frames.length - 1,
    `xong: ${order.length - 1} bảng bị ảnh hưởng, xa nhất ${Math.max(...Object.values(DIST))} bước`,
    {
      sayTone: 'good',
    },
  );
  // Câu đoán ở lần lấy ra đầu tiên mà đầu và cuối queue ở hai lớp khác nhau: lúc đó mới
  // phân biệt được queue (lấy đầu) với stack (lấy cuối).
  const k = frames.findIndex((f, i) => {
    if (f.event.kind !== 'dequeue' || i === 0) return false;
    const before = frames[i - 1].state;
    return before.pending.length >= 2 && DIST[before.pending[0]] !== DIST[before.pending.at(-1)!];
  });
  const before = frames[k - 1].state.pending;
  const [front, back] = [before[0], before.at(-1)!];
  return withAsk(frames, k, {
    prompt: `Queue đang là ${before.join(', ')}: ${front} cách nguồn ${DIST[front]} bước, ${back} cách ${DIST[back]} bước. BFS lấy bảng nào ra tiếp?`,
    choices: [front, back],
    correct: 0,
    explain: `Queue vào trước ra trước: ${front} vào trước nên ra trước. Bảng nào cũng vào queue sau mọi bảng gần nguồn hơn nó, nên BFS xong hết lớp ${DIST[front]} rồi mới tới lớp ${DIST[back]}. Lấy ở cuối như stack là bạn đang đi sâu, giống DFS ở bước sau.`,
  });
})();

// ---------- Bước 3: DFS ----------

function dfsLines(e: WalkEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [8, 9];
    case 'enter':
      return [2, 3];
    case 'skip':
      return [4, 5];
    case 'leave':
      return [4];
    case 'done':
      return [9];
    default:
      return [];
  }
}

const DFS_RAW = traceDfs(GRAPH, SOURCE);

export const DFS = (() => {
  const frames = DFS_RAW.map((f): F => {
    const e = f.event;
    const s = f.state;
    const cur = currentOf(s);
    const base = {
      ...f,
      codeLines: dfsLines(e),
      metrics: [
        { label: 'Đang ở', value: cur ?? '—' },
        { label: 'Độ sâu call stack', value: String(s.pending.length) },
        { label: 'Đã thăm', value: `${s.order.length}/${TABLES.length}` },
        { label: 'Bộ nhớ', value: 'O(độ sâu)' },
      ],
    };
    switch (e.kind) {
      case 'start':
        return { ...base, say: `gọi dfs('${e.source}')`, holdMs: 1100 };
      case 'enter':
        return {
          ...base,
          say: e.from === null ? `vào ${e.node}` : `${e.node} chưa thấy → gọi dfs('${e.node}')`,
          holdMs: 1100,
        };
      case 'skip':
        return { ...base, say: `${e.to} đã thấy rồi → bỏ qua`, holdMs: 1000 };
      case 'leave':
        return {
          ...base,
          say:
            e.back === null
              ? `${e.node} xong → hết đệ quy`
              : `${e.node} hết bảng con → return, quay lui về ${e.back}`,
          holdMs: 900,
        };
      default:
        return { ...base, say: `thăm đủ ${s.order.length} bảng`, sayTone: 'good', holdMs: 1500 };
    }
  });
  // Câu đoán ở lần đầu DFS đi xuống sâu hơn trong khi vẫn còn một bảng gần nguồn hơn chưa thăm.
  let waiting = '';
  const k = frames.findIndex((f, i) => {
    if (f.event.kind !== 'enter' || i === 0) return false;
    const node = f.event.node;
    const visited = frames[i - 1].state.order;
    waiting = TABLES.find((n) => !visited.includes(n) && DIST[n] < DIST[node]) ?? '';
    return waiting !== '';
  });
  const e = frames[k].event as Extract<WalkEvent, { kind: 'enter' }>;
  const stack = frames[k - 1].state.pending;
  const owner = parentsOf(GRAPH, waiting).find((p) => stack.includes(p))!;
  return withAsk(frames, k, {
    prompt: `DFS đang ở ${e.from}, bảng con của nó là ${e.node}. ${owner} vẫn còn ${waiting} chưa thăm. Bảng nào được thăm tiếp theo?`,
    choices: [e.node, waiting],
    correct: 0,
    explain: `DFS gọi đệ quy ngay khi gặp bảng con chưa thấy, nên đi tiếp xuống ${e.node}. ${waiting} phải đợi tới khi cả nhánh ${e.from} xong và call stack quay lui về ${owner}.`,
  });
})();

// ---------- Bước 4: bỏ seen ----------

const NO_SEEN_RAW = traceBfs(GRAPH, SOURCE, { seen: false });

function noSeenLines(e: WalkEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [4, 5];
    case 'dequeue':
      return [6, 7, 8];
    case 'discover':
      return [9, 10];
    case 'done':
      return [11];
    default:
      return [];
  }
}

export const NO_SEEN = (() => {
  const frames = narrateBfs(NO_SEEN_RAW, noSeenLines, (f) => {
    const n = f.state.order.length;
    const distinct = new Set(f.state.order).size;
    return [
      { label: 'Lần lấy ra', value: String(n) },
      { label: 'Bảng khác nhau', value: String(distinct) },
      { label: 'Lấy trùng', value: String(n - distinct), tone: n > distinct ? 'bad' : undefined },
      { label: 'Trong queue', value: String(f.state.pending.length) },
    ];
  });
  const order = NO_SEEN_RAW.at(-1)!.state.order;
  const distinct = new Set(order).size;
  setSay(frames, 0, 'cùng BFS đó, nhưng bỏ tập seen');
  setSay(frames, frames.length - 1, `xong: lấy ra ${order.length} lần cho ${distinct} bảng`, {
    sayTone: 'bad',
  });
  const k = frames.findIndex((f) => f.event.kind === 'discover' && f.event.again);
  const e = frames[k].event as Extract<WalkEvent, { kind: 'discover' }>;
  return withAsk(frames, k, {
    prompt: `${e.from} cũng trỏ tới ${e.to}, mà ${e.to} đã vào queue từ trước. Không có seen thì chuyện gì xảy ra?`,
    choices: [
      `${e.to} vào queue lần nữa và bị xử lý hai lần`,
      `Bỏ qua, vì ${e.to} đã có trong queue`,
      'Python báo lỗi',
    ],
    correct: 0,
    explain: `Code không kiểm tra gì nên cứ thêm. Ở đây chỉ tốn thêm một lần, nhưng mỗi chỗ tách nhánh rồi nhập lại nhân số đường đi lên. Nếu đồ thị có vòng thì queue không bao giờ rỗng.`,
  });
})();

// ---------- Bước 5: giới hạn n bước ----------

const LIMIT_RAW = traceBfs(GRAPH, SOURCE, { maxDepth: LIMIT });

function limitLines(e: WalkEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [4, 5];
    case 'dequeue':
      return [6, 7, 8];
    case 'cut':
      return [8, 9];
    case 'discover':
      return [10, 11, 12, 13, 14];
    case 'skip':
      return [10, 11];
    case 'done':
      return [15];
    default:
      return [];
  }
}

export const LIMITED = (() => {
  const frames = narrateBfs(LIMIT_RAW, limitLines, (f) => {
    const cur = currentOf(f.state);
    return [
      { label: 'Đã chọn', value: String(f.state.order.length) },
      { label: 'Giới hạn', value: `n = ${LIMIT}` },
      { label: 'Lớp (số bước)', value: cur === undefined ? '—' : String(f.state.badges[cur]) },
      { label: 'Trong queue', value: String(f.state.pending.length) },
    ];
  });
  const order = LIMIT_RAW.at(-1)!.state.order;
  setSay(frames, 0, `dbt run --select "${SOURCE}+${LIMIT}"`);
  setSay(
    frames,
    frames.length - 1,
    `chọn ${order.length} bảng, bỏ ${TABLES.length - order.length} bảng ở xa hơn ${LIMIT} bước`,
    { sayTone: 'good' },
  );
  const k = frames.findIndex((f) => f.event.kind === 'cut');
  const e = frames[k].event as Extract<WalkEvent, { kind: 'cut' }>;
  const kids = childrenOf(GRAPH, e.node);
  return withAsk(frames, k, {
    prompt: `${e.node} cách ${SOURCE} ${e.depth} bước. Với --select "${SOURCE}+${LIMIT}", có đưa các bảng con của ${e.node} vào queue không?`,
    choices: [
      `Không, đã đủ ${LIMIT} bước nên dừng ở đây`,
      `Có, đưa ${kids.join(' và ')} vào`,
      `Chỉ đưa ${kids.at(-1)} vào`,
    ],
    correct: 0,
    explain: `Các bảng con của ${e.node} cách nguồn ${e.depth + 1} bước, vượt giới hạn ${LIMIT}. Vì BFS đi theo lớp, bảng đầu tiên chạm giới hạn là lúc mọi bảng trong phạm vi đã được tìm thấy.`,
  });
})();

// ---------- Bước 6: tóm tắt ----------

type RowEvent = { kind: 'row'; index: number };

export const RECAP = (() => {
  const bfs = BFS_RAW.at(-1)!.state;
  const dfs = DFS_RAW.at(-1)!.state;
  const cell = (s: WalkState, i: number) => `${s.order[i]} (${s.badges[s.order[i]]})`;
  return Array.from({ length: TABLES.length + 1 }, (_, n): Frame<CodeTraceState, RowEvent> => ({
    state: {
      rows: Array.from({ length: n }, (_, i) => [String(i + 1), cell(bfs, i), cell(dfs, i)]),
    },
    event: { kind: 'row', index: n },
    codeLines: n === 0 ? [] : [5, 14],
    holdMs: n === 0 ? 900 : 800,
    metrics: [
      { label: 'Số bảng (V)', value: String(TABLES.length) },
      { label: 'Số cạnh (E)', value: String(EDGES.length) },
      { label: 'BFS', value: 'O(V + E)', tone: 'good' },
      { label: 'DFS', value: 'O(V + E)', tone: 'good' },
    ],
  }));
})();

// ---------- Scene ----------

const scene = (pendingTitle: string, orderTitle: string, file: string, lines: readonly string[]) =>
  graphScene({ layout: WIDE, narrow: NARROW, pendingTitle, orderTitle, code: { file, lines } });

const ReadScene = scene('graph.get(table, [])', 'ĐÃ ĐỌC', 'lineage.py', CODE_GRAPH);
const BfsScene = scene('QUEUE (LẤY RA Ở ĐẦU BÊN TRÁI)', 'THỨ TỰ LẤY RA', 'bfs.py', CODE_BFS);
const DfsScene = scene('CALL STACK (ĐỈNH BÊN PHẢI)', 'THỨ TỰ THĂM', 'dfs.py', CODE_DFS);
const NoSeenScene = scene(
  'QUEUE (LẤY RA Ở ĐẦU BÊN TRÁI)',
  'THỨ TỰ LẤY RA (CÓ LẶP)',
  'bfs_no_seen.py',
  CODE_NO_SEEN,
);
const LimitScene = scene(
  'QUEUE (LẤY RA Ở ĐẦU BÊN TRÁI)',
  'ĐƯỢC CHỌN',
  'select_plus.py',
  CODE_LIMIT,
);
const RecapScene = codeTraceScene({
  file: 'bfs_dfs.py',
  code: CODE_BOTH,
  columns: ['#', 'BFS (số bước)', 'DFS (số bước)'],
  title: `HAI THỨ TỰ TRÊN CÙNG LINEAGE`,
});

// ---------- Các bước ----------

const steps = [
  defineStep<WalkState, WalkEvent>({
    id: 'do-thi',
    short: 'Đồ thị',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Lineage là một đồ thị có hướng',
    Scene: ReadScene,
    build: () => READ,
    Body: () => (
      <>
        <p>
          Mỗi bảng là một <b>node</b>, mỗi mũi tên là một <b>cạnh</b> chỉ hướng dữ liệu chảy:{' '}
          <code>raw_events → stg_sessions</code> nghĩa là stg_sessions được build từ raw_events.
          Không có vòng nên đây là một DAG, giống mọi project dbt hay DAG của Airflow.
        </p>
        <p>
          Trong Python, cách lưu hay dùng nhất là <b>danh sách kề</b>: một dict từ mỗi bảng tới list
          các bảng dùng nó. Bảng cuối như retention không có bảng con nên không cần khoá;{' '}
          <code>graph.get(table, [])</code> trả về list rỗng.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          dbt lưu lineage trong <code>manifest.json</code> theo cả hai chiều: <code>child_map</code>{' '}
          (bảng → các bảng dùng nó) và <code>parent_map</code> (bảng → các bảng nguồn của nó), để
          tra chiều nào cũng nhanh.
        </>
      ),
    },
  }),

  defineStep<WalkState, WalkEvent>({
    id: 'bfs',
    short: 'BFS',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'BFS: lan ra từng lớp bằng queue',
    Scene: BfsScene,
    build: () => BFS,
    Body: ({ frames }) => {
      const { order } = frames.at(-1)!.state;
      return (
        <>
          <p>
            raw_events vừa đổi schema, cần tìm mọi bảng phía sau để chạy lại. BFS (breadth-first
            search) giữ một <b>queue</b>: lấy bảng ở đầu, đưa các bảng con chưa thấy vào cuối. Tập{' '}
            <code>seen</code> nhớ bảng nào đã vào queue.
          </p>
          <p>
            Số nhỏ ở góc mỗi bảng là số bước từ raw_events. Thứ tự lấy ra: {order.join(', ')}. Mỗi
            bảng vào queue một lần, mỗi cạnh được xét một lần: <b>O(V + E)</b>, với V là số bảng, E
            là số cạnh.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Queue làm BFS đi theo lớp: xong mọi bảng cách nguồn 1 bước rồi mới tới bảng cách 2 bước. Vì vậy số bước BFS tìm thấy luôn là số bước ít nhất.',
    },
  }),

  defineStep<WalkState, WalkEvent>({
    id: 'dfs',
    short: 'DFS',
    tag: 'THAO TÁC',
    tone: 'lav',
    title: 'DFS: đi sâu tới cùng rồi quay lui',
    Scene: DfsScene,
    build: () => DFS,
    Body: ({ frames }) => {
      const { order } = frames.at(-1)!.state;
      return (
        <>
          <p>
            DFS (depth-first search) gặp bảng con chưa thấy là đi xuống ngay, tới khi hết đường mới
            quay lui. Viết bằng đệ quy thì <b>call stack</b> của Python nhớ luôn đường về, đúng như
            bài Stack.
          </p>
          <p>
            Thứ tự thăm: {order.join(', ')}. stg_clicks phải đợi cả nhánh stg_sessions xong. Vẫn{' '}
            <b>O(V + E)</b>, nhưng chỉ cần nhớ đường đang đi chứ không phải cả một lớp.
          </p>
        </>
      );
    },
    callout: {
      kind: 'warn',
      title: 'CHÚ Ý',
      text: 'Python mặc định cho đệ quy sâu khoảng 1000 lời gọi (bài Stack). Lineage sâu hơn thế thì DFS đệ quy báo RecursionError; khi đó dùng một list làm stack thay cho call stack.',
    },
  }),

  defineStep<WalkState, WalkEvent>({
    id: 'seen',
    short: 'Vì sao cần seen',
    tag: 'BẪY',
    tone: 'rose',
    title: 'Bỏ seen đi thì sao?',
    Scene: NoSeenScene,
    build: () => NO_SEEN,
    Body: ({ frames }) => {
      const { order } = frames.at(-1)!.state;
      return (
        <>
          <p>
            Cùng BFS ở bước 2 nhưng bỏ tập <code>seen</code>. dau_report tới được bằng hai đường,
            qua fct_sessions và qua fct_clicks, nên nó vào queue hai lần và bị xử lý hai lần:{' '}
            {order.length} lần lấy ra cho {new Set(order).size} bảng.
          </p>
          <p>
            Trên lineage thật, mỗi chỗ tách nhánh rồi nhập lại nhân số đường đi lên, và chạy lại một
            bảng có thể mất hàng giờ. Đồ thị có vòng thì tệ hơn: queue không bao giờ rỗng.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>WITH RECURSIVE</code> trong SQL chạy giống BFS: mỗi vòng lấy các dòng mới của vòng
          trước, JOIN với bảng cạnh để ra lớp tiếp theo. Viết <code>UNION ALL</code> là không có
          seen: bảng tới được bằng hai đường ra hai dòng. <code>UNION</code> bỏ dòng trùng hệt một
          dòng đã có, nhưng chỉ khi mọi cột giống nhau. PostgreSQL 14 trở lên có thêm mệnh đề{' '}
          <code>CYCLE</code> để phát hiện vòng.
        </>
      ),
    },
  }),

  defineStep<WalkState, WalkEvent>({
    id: 'gioi-han',
    short: 'dbt +n',
    tag: 'ỨNG DỤNG',
    tone: 'sun',
    title: `Chỉ đi ${LIMIT} bước: dbt "+${LIMIT}"`,
    Scene: LimitScene,
    build: () => LIMITED,
    Body: ({ frames }) => {
      const { order } = frames.at(-1)!.state;
      return (
        <>
          <p>
            Đôi khi chỉ cần các bảng gần: chạy lại bảng vừa đổi và vài lớp sau nó, chưa động tới báo
            cáo. Vì BFS đi theo lớp, chỉ cần thêm một điều kiện: bảng đã cách nguồn đủ n bước thì
            không đưa con của nó vào queue.
          </p>
          <p>
            Với n = {LIMIT}: chọn {order.join(', ')}. DFS không làm gọn như vậy được, vì nó có thể
            tới một bảng bằng đường dài trước, đánh dấu đã thấy, rồi bỏ lỡ đường ngắn.
          </p>
        </>
      );
    },
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>
            dbt run --select &quot;{SOURCE}+{LIMIT}&quot;
          </code>{' '}
          chọn {SOURCE} và các bảng cách nó tối đa {LIMIT} bước về phía sau;{' '}
          <code>&quot;2+dau_report&quot;</code> đi ngược 2 bước về phía nguồn. Bỏ số đi (
          <code>{SOURCE}+</code>) là chọn hết, đúng như BFS ở bước 2.
        </>
      ),
    },
  }),

  defineStep<CodeTraceState, RowEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'peach',
    title: 'BFS hay DFS?',
    Scene: RecapScene,
    build: () => RECAP,
    Body: () => (
      <>
        <p>
          Bảng so hai thứ tự trên cùng lineage, số trong ngoặc là số bước từ raw_events. Cột BFS
          tăng dần theo lớp; cột DFS xuống sâu rồi quay về.
        </p>
        <p>
          Cần số bước ít nhất hay đi theo lớp: dùng <b>BFS</b>. Cần đi hết từng nhánh, hay cần thứ
          tự quay lui như topological sort ở bài sau: dùng <b>DFS</b>. Cả hai đều <b>O(V + E)</b> và
          đều cần <code>seen</code>. PostgreSQL 14 trở lên cho chọn ngay trong{' '}
          <code>WITH RECURSIVE</code>: <code>SEARCH BREADTH FIRST</code> hoặc{' '}
          <code>SEARCH DEPTH FIRST</code>.
        </p>
      </>
    ),
  }),
];

export const bfsDfsLesson: Lesson = {
  slug: 'bfs-dfs',
  steps,
  legend: [
    { swatch: 'ash', label: 'chưa tới' },
    { swatch: 'peach', label: 'trong queue, chờ quay lui' },
    { swatch: 'sun', label: 'đang xử lý' },
    { swatch: 'mint', label: 'đã xử lý' },
  ],
  objectives: [
    { text: 'Đọc lineage như một đồ thị có hướng', step: 0 },
    { text: 'Duyệt theo lớp bằng BFS và queue', step: 1 },
    { text: 'Đi sâu, quay lui bằng DFS và đệ quy', step: 2 },
    { text: 'Hiểu vì sao cần tập seen', step: 3 },
    { text: 'Giới hạn số bước như dbt +n', step: 4 },
  ],
  quiz: QUIZ,
};
